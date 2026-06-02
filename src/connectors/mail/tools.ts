import * as Schema from "effect/Schema";
import { Tool } from "effect/unstable/ai";

export const MailListFoldersTool = Tool.make("mail_list_folders", {
  description:
    "List configured iCloud mailbox folder names (INBOX and triage folders: Action, Waiting, Read later, Notifications, Archive).",
  success: Schema.String,
}).annotate(Tool.Readonly, true);

export const MailListEnvelopesTool = Tool.make("mail_list_envelopes", {
  description:
    "List recent email envelopes in a mailbox folder. Returns UID, date, from, subject, and unread flag. Use before mail_read_message when you need full body text.",
  parameters: Schema.Struct({
    folder: Schema.String,
    limit: Schema.optionalKey(Schema.Number),
    unreadOnly: Schema.optionalKey(Schema.Boolean),
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const MailReadMessageTool = Tool.make("mail_read_message", {
  description: "Read one email by UID in a folder, including plain-text body when available.",
  parameters: Schema.Struct({
    folder: Schema.String,
    uid: Schema.Number,
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);
