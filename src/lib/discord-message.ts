import { DiscordMessageLimit } from "../domain/discord.js";

const DiscordThreadNameLimit = 100;

/** Remove Discord mention markup (users, roles, channels) from plain text. */
export const stripDiscordMentions = (text: string): string =>
  text
    .replace(/<@[!&]?\d+>/g, "")
    .replace(/<#\d+>/g, "")
    .replace(/@everyone|@here/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Derive a thread title from the user's prompt or author name. */
export const makeDiscordThreadName = (prompt: string, authorName: string): string => {
  const normalized = stripDiscordMentions(prompt);
  if (normalized.length > 0) {
    return normalized.length <= DiscordThreadNameLimit
      ? normalized
      : `${normalized.slice(0, DiscordThreadNameLimit - 3)}...`;
  }

  const fallback = `Chat with ${authorName}`;
  return fallback.length <= DiscordThreadNameLimit
    ? fallback
    : `${fallback.slice(0, DiscordThreadNameLimit - 3)}...`;
};

/** Split text into chunks that fit Discord's message limit. */
export const splitDiscordMessage = (
  text: string,
  limit = DiscordMessageLimit,
): ReadonlyArray<string> => {
  if (text.length <= limit) return [text];

  const chunks: Array<string> = [];
  let remaining = text;

  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt <= 0) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
};
