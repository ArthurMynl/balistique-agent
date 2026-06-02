import * as Schema from "effect/Schema";

/** Supported mail accounts (extend when Outlook is added). */
export const MailAccountId = Schema.Literals(["icloud"]);
export type MailAccountId = typeof MailAccountId.Type;

export const MailUid = Schema.Number.pipe(Schema.brand("MailUid"));
export type MailUid = typeof MailUid.Type;

export const MailEnvelope = Schema.Struct({
  uid: MailUid,
  subject: Schema.String,
  from: Schema.String,
  date: Schema.optional(Schema.Date),
  seen: Schema.Boolean,
});

export type MailEnvelope = typeof MailEnvelope.Type;

export const MailMessage = Schema.Struct({
  uid: MailUid,
  messageId: Schema.optional(Schema.String),
  subject: Schema.String,
  from: Schema.String,
  to: Schema.Array(Schema.String),
  date: Schema.optional(Schema.Date),
  text: Schema.optional(Schema.String),
  html: Schema.optional(Schema.String),
});

export type MailMessage = typeof MailMessage.Type;

export const MailActionLeave = Schema.TaggedStruct("Leave", {});
export const MailActionMarkRead = Schema.TaggedStruct("MarkRead", {});
export const MailActionMoveToFolder = Schema.TaggedStruct("MoveToFolder", {
  folder: Schema.String,
});
export const MailActionDelete = Schema.TaggedStruct("Delete", {});

export const MailAction = Schema.Union([
  MailActionLeave,
  MailActionMarkRead,
  MailActionMoveToFolder,
  MailActionDelete,
]);

export type MailAction = typeof MailAction.Type;

/** Triage destinations — maps to MoveToFolder via {@link categoryToAction}. */
export const MailTriageCategory = Schema.Literals([
  "Action",
  "Waiting",
  "ReadLater",
  "Notifications",
  "Archive",
]);

export type MailTriageCategory = typeof MailTriageCategory.Type;

export const MailClassifierTriageResponse = Schema.Struct({
  category: MailTriageCategory,
  reason: Schema.String,
});

export type MailClassifierTriageResponse = typeof MailClassifierTriageResponse.Type;

export const MailProcessedEntry = Schema.Struct({
  messageId: Schema.optional(Schema.String),
  folder: Schema.String,
  uid: MailUid,
  actionTag: Schema.String,
  reason: Schema.optional(Schema.String),
  processedAt: Schema.String,
  dryRun: Schema.Boolean,
});

export type MailProcessedEntry = typeof MailProcessedEntry.Type;

export const MailProcessedStoreFile = Schema.Struct({
  version: Schema.Literal(1),
  entries: Schema.Array(MailProcessedEntry),
});

export type MailProcessedStoreFile = typeof MailProcessedStoreFile.Type;

export class MailError extends Schema.TaggedErrorClass<MailError>()("MailError", {
  reason: Schema.Literals([
    "InvalidConfig",
    "ConnectionFailed",
    "MailboxFailed",
    "SearchFailed",
    "FetchFailed",
    "ParseFailed",
    "MessageNotFound",
    "ActionFailed",
    "InvalidAction",
  ]),
  message: Schema.String,
}) {}

export class MailStoreError extends Schema.TaggedErrorClass<MailStoreError>()("MailStoreError", {
  reason: Schema.Literals(["ReadFailed", "WriteFailed", "DecodeFailed"]),
  message: Schema.String,
}) {}

export const IcloudImapDefaults = {
  host: "imap.mail.me.com",
  port: 993,
  folder: "INBOX",
} as const;
