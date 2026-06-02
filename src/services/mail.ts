import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { MailAction, MailEnvelope, MailError, MailMessage, MailUid } from "../domain/mail.js";

export type ListEnvelopesInput = {
  readonly folder?: string | undefined;
  readonly limit?: number | undefined;
  readonly unreadOnly?: boolean | undefined;
};

export type ReadMessageInput = {
  readonly uid: MailUid;
  readonly folder?: string | undefined;
};

export type ApplyActionInput = {
  readonly uid: MailUid;
  readonly folder?: string | undefined;
  readonly action: MailAction;
};

export type MailService = {
  readonly listEnvelopes: (
    input?: ListEnvelopesInput,
  ) => Effect.Effect<ReadonlyArray<MailEnvelope>, MailError>;
  readonly readMessage: (input: ReadMessageInput) => Effect.Effect<MailMessage, MailError>;
  readonly applyAction: (input: ApplyActionInput) => Effect.Effect<void, MailError>;
};

export class Mail extends Context.Service<Mail, MailService>()("@app/Mail") {}
