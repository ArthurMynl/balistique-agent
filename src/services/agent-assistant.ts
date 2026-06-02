import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Prompt from "effect/unstable/ai/Prompt";
import { assistantSystemInstructions } from "../connectors/registry.js";
import { ConnectorRegistry } from "./connector-registry.js";
import { codexGenerateText } from "./openai-subscription.js";

const assistantTimeout = "300 seconds";

const failureMessage = (error: unknown): string => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (message.toLowerCase().includes("timeout")) {
    return "Sorry, that took too long. Please try again.";
  }
  const short = message.length > 300 ? `${message.slice(0, 300)}…` : message;
  return `Sorry, something went wrong: ${short}`;
};

export class AgentAssistant extends Context.Service<AgentAssistant>()("@app/AgentAssistant", {
  make: Effect.gen(function* () {
    const registry = yield* ConnectorRegistry;
    const instructions = assistantSystemInstructions(registry.manifests);

    const respond = Effect.fn("AgentAssistant.respond")(function* (prompt: string) {
      const trimmed = prompt.trim();
      if (trimmed.length === 0) return "";

      const response = yield* codexGenerateText({
        prompt: Prompt.make([
          { role: "system", content: instructions },
          { role: "user", content: trimmed },
        ]),
        toolkit: registry.toolkit,
        toolChoice: "auto",
      }).pipe(
        Effect.timeout(assistantTimeout),
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logError(`[assistant] reply failed: ${String(error)}`);
            return { text: failureMessage(error) };
          }),
        ),
      );

      const text = response.text.trim();
      return text.length > 0 ? text : "…";
    });

    return { respond } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
