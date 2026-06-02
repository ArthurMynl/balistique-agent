import type { MailEnvelope, MailMessage } from "../domain/mail.js";
import { truncateMailBody } from "./mail-action.js";

export const formatEnvelopeLine = (envelope: MailEnvelope): string => {
  const seen = envelope.seen ? "" : " [unread]";
  const date = envelope.date?.toISOString() ?? "unknown date";
  return `UID ${envelope.uid}${seen} | ${date} | ${envelope.from} | ${envelope.subject}`;
};

export const formatEnvelopeList = (
  label: string,
  folder: string,
  envelopes: ReadonlyArray<MailEnvelope>,
  error?: string,
): string => {
  if (error) return `## ${label} (${folder})\n(error: ${error})`;
  if (envelopes.length === 0) return `## ${label} (${folder})\n(no messages)`;
  return `## ${label} (${folder})\n${envelopes.map(formatEnvelopeLine).join("\n")}`;
};

export const formatMessageDetail = (message: MailMessage, maxBodyChars: number): string => {
  const date = message.date?.toISOString() ?? "unknown date";
  const body = truncateMailBody(message.text, maxBodyChars);
  return [
    `UID: ${message.uid}`,
    `From: ${message.from}`,
    `Subject: ${message.subject}`,
    `Date: ${date}`,
    `Message-ID: ${message.messageId ?? "(none)"}`,
    "",
    body.length > 0 ? body : "(no plain-text body)",
  ].join("\n");
};
