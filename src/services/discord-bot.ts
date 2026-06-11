import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { AiAssistantLive } from "../app-layer.js";
import type { DiscordConversationTurn } from "../domain/discord.js";
import { makeDiscordClient } from "./discord-gateway.js";
import { DiscordConfig } from "./discord-config.js";
import { AgentAssistant } from "./agent-assistant.js";

const replyEffect = (prompt: string, history: ReadonlyArray<DiscordConversationTurn>) =>
  Effect.gen(function* () {
    const assistant = yield* AgentAssistant;
    return yield* assistant.respond(prompt, history);
  });

export class DiscordBot extends Context.Service<DiscordBot>()("@app/DiscordBot", {
  make: Effect.acquireRelease(
    Effect.gen(function* () {
      const config = yield* DiscordConfig;
      const runtime = ManagedRuntime.make(AiAssistantLive);
      const runReply = (prompt: string, history: ReadonlyArray<DiscordConversationTurn>) =>
        runtime.runPromiseExit(replyEffect(prompt, history));

      const bot = yield* makeDiscordClient(config, runReply);
      return { ...bot, runtime };
    }),
    ({ client, runtime }) =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () => client.destroy(),
          catch: () => undefined,
        }).pipe(Effect.ignore);
        yield* Effect.tryPromise({
          try: () => runtime.dispose(),
          catch: () => undefined,
        }).pipe(Effect.ignore);
      }),
  ),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
