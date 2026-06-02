import type { LanguageModel } from "effect/unstable/ai";
import type { ChatAgent } from "./openai-subscription.js";

export type DiscordAiRequirements = ChatAgent | LanguageModel.LanguageModel;
