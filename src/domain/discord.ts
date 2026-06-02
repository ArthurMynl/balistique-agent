import * as Schema from "effect/Schema";

export class DiscordError extends Schema.TaggedErrorClass<DiscordError>()("DiscordError", {
  reason: Schema.Literals(["LoginFailed", "ReplyFailed", "InvalidConfig"]),
  message: Schema.String,
}) {}

export const DiscordMessageLimit = 2000;
