import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import type { Concurrency } from "effect/Types";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { LanguageModel } from "effect/unstable/ai";
import type * as AiError from "effect/unstable/ai/AiError";
import type { LanguageModel as LanguageModelTypes } from "effect/unstable/ai";
import * as Prompt from "effect/unstable/ai/Prompt";
import type { AnyPart } from "effect/unstable/ai/Response";
import { OpenAiCodexResponsesBaseUrl } from "../domain/openai-codex.js";
import { balistiqueAssistantIdentity, respondInFrenchInstruction } from "../lib/agent-locale.js";
import { OpenAiCodexAuth } from "./openai-codex-auth.js";

const maxAgentTurns = 8;

export type CodexGenerateTextOptions = {
  readonly prompt: Prompt.RawInput;
  readonly toolkit?: unknown;
  readonly toolChoice?: "auto" | "none" | "required";
  readonly concurrency?: Concurrency;
  readonly disableToolCallResolution?: boolean;
};

const extractTextFromParts = (parts: ReadonlyArray<AnyPart>): string => {
  const history = Prompt.fromResponseParts([...parts]);
  const chunks: Array<string> = [];
  for (const message of history.content) {
    if (message.role !== "assistant") continue;
    for (const part of message.content) {
      if (part.type === "text") chunks.push(part.text);
    }
  }
  return chunks.join("");
};

const shouldContinueAfterTools = (parts: ReadonlyArray<AnyPart>, text: string): boolean => {
  if (text.trim().length > 0) return false;
  return parts.some((part) => part.type === "tool-result" && part.preliminary === false);
};

const collectStreamParts = (options: CodexGenerateTextOptions, prompt: Prompt.Prompt) => {
  if (options.toolkit !== undefined) {
    return LanguageModel.streamText({
      prompt,
      toolkit: options.toolkit,
      toolChoice: options.toolChoice,
      concurrency: options.concurrency,
      disableToolCallResolution: options.disableToolCallResolution,
    } as never).pipe(Stream.runCollect);
  }

  return LanguageModel.streamText({
    prompt,
    toolChoice: options.toolChoice ?? "none",
    concurrency: options.concurrency,
    disableToolCallResolution: options.disableToolCallResolution,
  } as never).pipe(Stream.runCollect);
};

const withCodexHeaders = (accountId: string) =>
  HttpClient.mapRequest(HttpClientRequest.setHeader("ChatGPT-Account-Id", accountId));

const defaultModel = Config.string("OPENAI_CODEX_MODEL").pipe(Config.withDefault("gpt-5.5"));

const codexModelConfig = {
  instructions: `${balistiqueAssistantIdentity} ${respondInFrenchInstruction}`,
  store: false,
} as const;

const OpenAiClientLive = Layer.unwrap(
  Effect.gen(function* () {
    const auth = yield* OpenAiCodexAuth;
    const credentials = yield* auth.getCredentials();

    return OpenAiClient.layer({
      apiKey: Redacted.make(credentials.access),
      apiUrl: OpenAiCodexResponsesBaseUrl,
      transformClient: withCodexHeaders(credentials.accountId),
    });
  }),
);

export const OpenAiSubscriptionLive = Layer.unwrap(
  Effect.gen(function* () {
    const model = yield* defaultModel;
    return OpenAiLanguageModel.model(model, codexModelConfig);
  }),
).pipe(Layer.provide(OpenAiClientLive), Layer.provide(OpenAiCodexAuth.layer));

/** Codex subscription API requires streaming (`stream: true`). */
export const codexGenerateText = (
  options: CodexGenerateTextOptions,
): Effect.Effect<{ readonly text: string }, AiError.AiError, LanguageModelTypes.LanguageModel> =>
  Effect.gen(function* () {
    let prompt = Prompt.make(options.prompt);

    for (let turn = 0; turn < maxAgentTurns; turn++) {
      const parts = yield* collectStreamParts(options, prompt);

      const collected = [...parts] as Array<AnyPart>;
      const text = extractTextFromParts(collected);

      if (text.trim().length > 0) {
        return { text } as const;
      }

      if (!shouldContinueAfterTools(collected, text)) {
        return { text } as const;
      }

      prompt = Prompt.concat(prompt, Prompt.fromResponseParts(collected));
    }

    return { text: "" } as const;
  });

export const generateText = (prompt: string) =>
  codexGenerateText({ prompt, toolChoice: "none" }).pipe(Effect.map((response) => response.text));

export class ChatAgent extends Context.Service<ChatAgent>()("@app/ChatAgent", {
  make: Effect.succeed({
    respond: Effect.fn("ChatAgent.respond")(function* (prompt: string) {
      return yield* generateText(prompt);
    }),
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}

export const AiLive = Layer.mergeAll(OpenAiSubscriptionLive, ChatAgent.layer);
