import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import type { Message } from "discord.js";
import { DiscordError } from "../domain/discord.js";
import { stripDiscordMentions } from "../lib/discord-message.js";

export class DiscordConfig extends Context.Service<DiscordConfig>()("@app/DiscordConfig", {
  make: Effect.gen(function* () {
    const token = yield* Config.redacted("DISCORD_BOT_TOKEN");
    const guildId = yield* Config.string("DISCORD_GUILD_ID");

    if (Redacted.value(token).trim().length === 0) {
      return yield* new DiscordError({
        reason: "InvalidConfig",
        message: "DISCORD_BOT_TOKEN is required",
      });
    }

    if (guildId.trim().length === 0) {
      return yield* new DiscordError({
        reason: "InvalidConfig",
        message: "DISCORD_GUILD_ID is required for private-server mode",
      });
    }

    return {
      token,
      guildId,
    } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}

const stripBotMention = (content: string, botUserId: string): string =>
  content.replaceAll(`<@${botUserId}>`, "").replaceAll(`<@!${botUserId}>`, "").trim();

export const extractPrompt = (message: Message, botUserId: string): string =>
  stripDiscordMentions(stripBotMention(message.content, botUserId));
