import * as Schema from "effect/Schema";

export class DiscordError extends Schema.TaggedErrorClass<DiscordError>()("DiscordError", {
  reason: Schema.Literals(["LoginFailed", "ReplyFailed", "InvalidConfig", "ApiFailed"]),
  message: Schema.String,
}) {}

export const DiscordMessageLimit = 2000;
