import { ImapFlow, type MessageAddressObject, type MessageEnvelopeObject } from "imapflow";
import { simpleParser } from "mailparser";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import {
  MailError,
  MailUid,
  type MailAction,
  type MailEnvelope,
  type MailMessage,
  type MailUid as MailUidType,
} from "../domain/mail.js";
import { formatMailAddresses } from "../lib/mail-address.js";
import {
  Mail,
  type ApplyActionInput,
  type ListEnvelopesInput,
  type ReadMessageInput,
} from "./mail.js";
import { IcloudMailConfig } from "./mail-icloud-config.js";

const defaultListLimit = 20;

/** iCloud (and most servers) return sequence numbers unless UID search is requested. */
const uidSearchOptions = { uid: true } as const;

const envelopeFrom = (envelope: MessageEnvelopeObject | undefined): string =>
  formatMailAddresses(envelope?.from as ReadonlyArray<MessageAddressObject> | undefined);

const envelopeSubject = (envelope: MessageEnvelopeObject | undefined): string =>
  envelope?.subject?.trim() ?? "(no subject)";

const isSeen = (flags: Set<string> | undefined): boolean => flags?.has("\\Seen") ?? false;

const toMailUid = (uid: number): Effect.Effect<MailUidType, MailError> =>
  Effect.try({
    try: () => MailUid.make(uid),
    catch: () =>
      new MailError({
        reason: "FetchFailed",
        message: `Invalid message UID: ${uid}`,
      }),
  });

const withImapClient = <A>(
  config: typeof IcloudMailConfig.Service,
  use: (client: ImapFlow) => Effect.Effect<A, MailError>,
): Effect.Effect<A, MailError> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: async () => {
        const client = new ImapFlow({
          host: config.host,
          port: config.port,
          secure: true,
          disableAutoIdle: true,
          logger: false,
          auth: {
            user: config.login,
            pass: Redacted.value(config.appPassword),
          },
        });
        await client.connect();
        return client;
      },
      catch: (cause) =>
        new MailError({
          reason: "ConnectionFailed",
          message: `iCloud IMAP connection failed: ${String(cause)}`,
        }),
    }),
    use,
    (client) =>
      Effect.tryPromise({
        try: () => client.logout(),
        catch: () => undefined,
      }).pipe(Effect.ignore),
  );

const withMailbox = <A>(
  config: typeof IcloudMailConfig.Service,
  folder: string,
  use: (client: ImapFlow) => Effect.Effect<A, MailError>,
): Effect.Effect<A, MailError> =>
  withImapClient(config, (client) =>
    Effect.gen(function* () {
      const lock = yield* Effect.tryPromise({
        try: () => client.getMailboxLock(folder),
        catch: (cause) =>
          new MailError({
            reason: "MailboxFailed",
            message: `Failed to open mailbox "${folder}": ${String(cause)}`,
          }),
      });

      return yield* use(client).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            lock.release();
          }),
        ),
      );
    }),
  );

const listEnvelopesImpl = Effect.fn("Mail.listEnvelopes")(function* (
  config: typeof IcloudMailConfig.Service,
  input: ListEnvelopesInput | undefined,
) {
  const folder = input?.folder?.trim() || config.folder;
  const limit = Math.max(1, Math.min(input?.limit ?? defaultListLimit, 100));
  const unreadOnly = input?.unreadOnly ?? false;

  return yield* withMailbox(config, folder, (client) =>
    Effect.gen(function* () {
      const uids = yield* Effect.tryPromise({
        try: () => client.search(unreadOnly ? { seen: false } : { all: true }, uidSearchOptions),
        catch: (cause) =>
          new MailError({
            reason: "SearchFailed",
            message: `Mailbox search failed: ${String(cause)}`,
          }),
      });

      if (!uids || uids.length === 0) {
        return [] as ReadonlyArray<MailEnvelope>;
      }

      const selected = uids.slice(-limit).slice().reverse();

      const envelopes: Array<MailEnvelope> = [];
      for (const uid of selected) {
        const message = yield* Effect.tryPromise({
          try: async () => {
            for await (const msg of client.fetch(
              uid,
              { uid: true, envelope: true, flags: true },
              { uid: true },
            )) {
              return msg;
            }
            return undefined;
          },
          catch: (cause) =>
            new MailError({
              reason: "FetchFailed",
              message: `Failed to fetch envelope UID ${uid}: ${String(cause)}`,
            }),
        });

        if (!message) continue;

        const brandedUid = yield* toMailUid(message.uid);
        envelopes.push({
          uid: brandedUid,
          subject: envelopeSubject(message.envelope),
          from: envelopeFrom(message.envelope),
          date: message.envelope?.date,
          seen: isSeen(message.flags),
        });
      }

      return envelopes;
    }),
  );
});

const readMessageImpl = Effect.fn("Mail.readMessage")(function* (
  config: typeof IcloudMailConfig.Service,
  input: ReadMessageInput,
) {
  const folder = input.folder?.trim() || config.folder;
  const uid = input.uid;

  return yield* withMailbox(config, folder, (client) =>
    Effect.gen(function* () {
      const fetched = yield* Effect.tryPromise({
        try: async () => {
          for await (const msg of client.fetch(
            uid,
            { uid: true, envelope: true, source: true },
            { uid: true },
          )) {
            return msg;
          }
          return undefined;
        },
        catch: (cause) =>
          new MailError({
            reason: "FetchFailed",
            message: `Failed to fetch message UID ${uid}: ${String(cause)}`,
          }),
      });

      const source = fetched?.source;
      if (!source) {
        return yield* new MailError({
          reason: "MessageNotFound",
          message: `No message with UID ${uid} in "${folder}"`,
        });
      }

      const parsed = yield* Effect.tryPromise({
        try: () => simpleParser(source),
        catch: (cause) =>
          new MailError({
            reason: "ParseFailed",
            message: `Failed to parse message UID ${uid}: ${String(cause)}`,
          }),
      });

      const to = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : []).flatMap(
        (entry) => {
          if (typeof entry === "object" && entry !== null && "address" in entry) {
            const address = (entry as { address?: string }).address?.trim() ?? "";
            return address.length > 0 ? [address] : [];
          }
          return [];
        },
      );

      const rawMessageId = parsed.messageId?.trim();
      const messageId = rawMessageId && rawMessageId.length > 0 ? rawMessageId : undefined;

      return {
        uid,
        messageId,
        subject: parsed.subject?.trim() ?? envelopeSubject(fetched.envelope),
        from: (() => {
          const parsedFrom = parsed.from?.text?.trim();
          if (parsedFrom && parsedFrom.length > 0) return parsedFrom;
          const envelopeFromLine = envelopeFrom(fetched.envelope);
          return envelopeFromLine.length > 0 ? envelopeFromLine : "unknown";
        })(),
        to,
        date: parsed.date ?? fetched.envelope?.date,
        text: parsed.text?.trim() || undefined,
        html: typeof parsed.html === "string" ? parsed.html : undefined,
      } satisfies MailMessage;
    }),
  );
});

const uidStoreOptions = { uid: true } as const;

const applyActionImpl = Effect.fn("Mail.applyAction")(function* (
  config: typeof IcloudMailConfig.Service,
  input: ApplyActionInput,
) {
  const folder = input.folder?.trim() || config.folder;
  const uid = input.uid;
  const action = input.action;

  if (action._tag === "Leave") {
    return;
  }

  return yield* withMailbox(config, folder, (client) =>
    Effect.gen(function* () {
      if (action._tag === "MarkRead") {
        yield* Effect.tryPromise({
          try: () => client.messageFlagsAdd(uid, ["\\Seen"], uidStoreOptions),
          catch: (cause) =>
            new MailError({
              reason: "ActionFailed",
              message: `Failed to mark UID ${uid} as read: ${String(cause)}`,
            }),
        });
        return;
      }

      if (action._tag === "MoveToFolder") {
        const destination = action.folder.trim();
        if (destination.length === 0) {
          return yield* new MailError({
            reason: "InvalidAction",
            message: "MoveToFolder requires a non-empty folder name",
          });
        }

        const moved = yield* Effect.tryPromise({
          try: () => client.messageMove(uid, destination, uidStoreOptions),
          catch: (cause) =>
            new MailError({
              reason: "ActionFailed",
              message: `Failed to move UID ${uid} to "${destination}": ${String(cause)}`,
            }),
        });

        if (!moved) {
          return yield* new MailError({
            reason: "ActionFailed",
            message: `Move UID ${uid} to "${destination}" returned no result`,
          });
        }
        return;
      }

      if (action._tag === "Delete") {
        yield* Effect.tryPromise({
          try: () => client.messageDelete(uid, uidStoreOptions),
          catch: (cause) =>
            new MailError({
              reason: "ActionFailed",
              message: `Failed to delete UID ${uid}: ${String(cause)}`,
            }),
        });
        return;
      }

      return yield* new MailError({
        reason: "InvalidAction",
        message: `Unknown mail action: ${(action as MailAction)._tag}`,
      });
    }),
  );
});

export const MailIcloudLive = Layer.effect(
  Mail,
  Effect.gen(function* () {
    const config = yield* IcloudMailConfig;

    return {
      listEnvelopes: (input) => listEnvelopesImpl(config, input),
      readMessage: (input) => readMessageImpl(config, input),
      applyAction: (input) => applyActionImpl(config, input),
    };
  }),
).pipe(Layer.provide(IcloudMailConfig.layer));
