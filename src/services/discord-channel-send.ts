import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { DiscordError } from "../domain/discord.js";
import { splitDiscordMessage } from "../lib/discord-message.js";
import { DiscordConfig } from "./discord-config.js";

export class DiscordChannelSend extends Context.Service<DiscordChannelSend>()(
  "@app/DiscordChannelSend",
  {
    make: Effect.gen(function* () {
      const config = yield* DiscordConfig;
      const http = yield* HttpClient.HttpClient;

      const send = Effect.fn("DiscordChannelSend.send")(function* (
        channelId: string,
        text: string,
      ) {
        const trimmedChannel = channelId.trim();
        if (trimmedChannel.length === 0) {
          return yield* new DiscordError({
            reason: "InvalidConfig",
            message: "Discord channel id is required to send a message",
          });
        }

        const chunks = splitDiscordMessage(text);
        for (const chunk of chunks) {
          const request = HttpClientRequest.post(
            `https://discord.com/api/v10/channels/${trimmedChannel}/messages`,
          ).pipe(
            HttpClientRequest.setHeader("Authorization", `Bot ${Redacted.value(config.token)}`),
            HttpClientRequest.bodyJsonUnsafe({ content: chunk, allowed_mentions: { parse: [] } }),
          );

          yield* http.execute(request).pipe(
            Effect.flatMap((response) =>
              HttpClientResponse.matchStatus(response, {
                "2xx": () => Effect.void,
                orElse: (failed) =>
                  Effect.gen(function* () {
                    const body = yield* failed.text;
                    return yield* new DiscordError({
                      reason: "ApiFailed",
                      message: `Discord API ${failed.status}: ${body}`,
                    });
                  }),
              }),
            ),
            Effect.mapError((error) =>
              error instanceof DiscordError
                ? error
                : new DiscordError({
                    reason: "ApiFailed",
                    message: error instanceof Error ? error.message : String(error),
                  }),
            ),
          );
        }
      });

      return { send } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
