import { BunServices } from "@effect/platform-bun";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as Layer from "effect/Layer";
import { AgentAssistant } from "./services/agent-assistant.js";
import { ConnectorRegistry } from "./services/connector-registry.js";
import { DiscordBot } from "./services/discord-bot.js";
import { DiscordConfig } from "./services/discord-config.js";
import { MailAutomation } from "./services/mail-automation.js";
import { MailClassifierLive } from "./services/mail-classifier.js";
import { MailProcessedStore } from "./services/mail-processed-store.js";
import { MailRulesConfig } from "./services/mail-rules-config.js";
import { IcloudMailConfig } from "./services/mail-icloud-config.js";
import { MailIcloudLive } from "./services/mail-icloud.js";
import { AiLive } from "./services/openai-subscription.js";
import { AgentToolkitHandlersLive } from "./connectors/agent-toolkit.js";

export const PlatformLive = Layer.mergeAll(BunServices.layer, BunHttpClient.layer);

export const MailRulesConfigLive = MailRulesConfig.layer.pipe(Layer.provide(PlatformLive));

/** IMAP + rules markdown (folders, triage guide, agent settings). */
export const CoreMailLive = Layer.mergeAll(
  IcloudMailConfig.layer,
  MailRulesConfigLive,
  MailIcloudLive,
);

export const ConnectorRegistryLive = ConnectorRegistry.layer.pipe(
  Layer.provide(AgentToolkitHandlersLive),
  Layer.provide(CoreMailLive),
  Layer.provide(PlatformLive),
);

export const AiAssistantLive = Layer.provideMerge(AgentAssistant.layer, AiLive).pipe(
  Layer.provide(ConnectorRegistryLive),
  Layer.provide(PlatformLive),
);

export const MailAgentLive = MailAutomation.layer.pipe(
  Layer.provide(MailClassifierLive),
  Layer.provide(MailProcessedStore.layer),
  Layer.provide(CoreMailLive),
  Layer.provide(PlatformLive),
);

export const DiscordLive = DiscordBot.layer.pipe(
  Layer.provide(DiscordConfig.layer),
  Layer.provide(AiAssistantLive),
  Layer.provide(PlatformLive),
);

/** Discord + background mail triage (single VPS process). */
export const AppLive = Layer.merge(MailAgentLive, DiscordLive);
