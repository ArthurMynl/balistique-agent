import * as Schema from "effect/Schema";
import { Tool } from "effect/unstable/ai";

export const MailListFoldersTool = Tool.make("mail_list_folders", {
  description:
    "Liste les dossiers iCloud configurés (INBOX et dossiers de tri : Action, Waiting, Read Later, Notifications, Archive).",
  success: Schema.String,
}).annotate(Tool.Readonly, true);

export const MailListEnvelopesTool = Tool.make("mail_list_envelopes", {
  description:
    "Liste les enveloppes récentes d'un dossier. Retourne UID, date, expéditeur, objet et indicateur non lu. À utiliser avant mail_read_message pour le corps complet.",
  parameters: Schema.Struct({
    folder: Schema.String,
    limit: Schema.optionalKey(Schema.Number),
    unreadOnly: Schema.optionalKey(Schema.Boolean),
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const MailReadMessageTool = Tool.make("mail_read_message", {
  description:
    "Lit un courriel par UID dans un dossier, y compris le corps en texte brut si disponible.",
  parameters: Schema.Struct({
    folder: Schema.String,
    uid: Schema.Number,
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);
