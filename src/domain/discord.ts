import * as Schema from "effect/Schema";

export class DiscordError extends Schema.TaggedErrorClass<DiscordError>()("DiscordError", {
  reason: Schema.Literals(["LoginFailed", "ReplyFailed", "InvalidConfig", "ApiFailed"]),
  message: Schema.String,
}) {}

export const DiscordMessageLimit = 2000;

/** One user or assistant turn in a Discord thread conversation. */
export type DiscordConversationTurn = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

/** Cap thread history passed to the model (recent turns only). */
export const DiscordMaxConversationTurns = 40;

/** How many Discord messages to fetch when rebuilding thread context. */
export const DiscordHistoryFetchLimit = 100;
