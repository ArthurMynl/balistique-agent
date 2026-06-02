import * as Effect from "effect/Effect";
import { MailUid } from "../../domain/mail.js";
import { formatEnvelopeList, formatMessageDetail } from "../../lib/mail-context.js";
import { Mail } from "../../services/mail.js";
import { IcloudMailConfig } from "../../services/mail-icloud-config.js";
import { MailRulesConfig } from "../../services/mail-rules-config.js";
import { MailToolkit } from "./toolkit.js";

const defaultListLimit = 15;
const readBodyMaxChars = 12_000;

const folderCatalog = (
  inboxFolder: string,
  triageFolders: {
    action: string;
    waiting: string;
    readLater: string;
    notifications: string;
    archive: string;
  },
): string =>
  [
    `INBOX: ${inboxFolder}`,
    `Action: ${triageFolders.action}`,
    `Waiting: ${triageFolders.waiting}`,
    `Read later: ${triageFolders.readLater}`,
    `Notifications: ${triageFolders.notifications}`,
    `Archive: ${triageFolders.archive}`,
  ].join("\n");

export const MailToolkitHandlersLive = MailToolkit.toLayer(
  Effect.gen(function* () {
    const mail = yield* Mail;
    const icloud = yield* IcloudMailConfig;
    const rules = yield* MailRulesConfig;
    const inboxFolder = icloud.folder;
    const triageFolders = rules.triageFolders;

    return {
      mail_list_folders: () => Effect.succeed(folderCatalog(inboxFolder, triageFolders)),

      mail_list_envelopes: (params: {
        folder: string;
        limit?: number | undefined;
        unreadOnly?: boolean | undefined;
      }) => {
        const folder = params.folder.trim();
        if (folder.length === 0) {
          return Effect.fail("folder is required");
        }

        const limit = Math.max(1, Math.min(params.limit ?? defaultListLimit, 50));
        return mail.listEnvelopes({ folder, limit, unreadOnly: params.unreadOnly ?? false }).pipe(
          Effect.map((envelopes) => formatEnvelopeList(folder, folder, envelopes)),
          Effect.mapError((error) => error.message),
        );
      },

      mail_read_message: (params: { folder: string; uid: number }) => {
        const folder = params.folder.trim();
        if (folder.length === 0) {
          return Effect.fail("folder is required");
        }

        return Effect.try({
          try: () => MailUid.make(params.uid),
          catch: () => `invalid UID: ${params.uid}`,
        }).pipe(
          Effect.flatMap((uid) =>
            mail.readMessage({ folder, uid }).pipe(
              Effect.map((message) => formatMessageDetail(message, readBodyMaxChars)),
              Effect.mapError((error) => error.message),
            ),
          ),
        );
      },
    };
  }),
);
