import type { MailAction, MailMessage } from "../domain/mail.js";

export const mailActionTag = (action: MailAction): string =>
  action._tag === "MoveToFolder" ? `MoveToFolder:${action.folder}` : action._tag;

export const truncateMailBody = (text: string | undefined, maxChars: number): string => {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n…[truncated]`;
};

export const processedEntryKey = (
  folder: string,
  uid: number,
  messageId: string | undefined,
): string => (messageId && messageId.length > 0 ? `id:${messageId}` : `uid:${folder}:${uid}`);

export const extractJsonObject = (text: string): string => {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
};

export const formatMessageForClassifier = (message: MailMessage, maxBodyChars: number): string => {
  const date = message.date?.toISOString() ?? "unknown";
  const body = truncateMailBody(message.text, maxBodyChars);
  return [
    `From: ${message.from}`,
    `Subject: ${message.subject}`,
    `Date: ${date}`,
    `Message-ID: ${message.messageId ?? "(none)"}`,
    "",
    body.length > 0 ? body : "(no plain-text body)",
  ].join("\n");
};
