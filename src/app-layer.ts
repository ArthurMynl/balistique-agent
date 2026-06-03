import { BunServices } from "@effect/platform-bun";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as Layer from "effect/Layer";
import { AgentAssistant } from "./services/agent-assistant.js";
import { CalendarBrief } from "./services/calendar-brief.js";
import { CalendarBriefSentStore } from "./services/calendar-brief-sent-store.js";
import { CalendarIcloudLive } from "./services/calendar-icloud-caldav.js";
import { CalendarRulesConfig } from "./services/calendar-rules-config.js";
import { IcloudCalendarConfig } from "./services/calendar-icloud-config.js";
import { ConnectorRegistry } from "./services/connector-registry.js";
import { DiscordBot } from "./services/discord-bot.js";
import { DiscordChannelSend } from "./services/discord-channel-send.js";
import { DiscordConfig } from "./services/discord-config.js";
import { MailAutomation } from "./services/mail-automation.js";
import { MailClassifierLive } from "./services/mail-classifier.js";
import { MailProcessedStore } from "./services/mail-processed-store.js";
import { MailRulesConfig } from "./services/mail-rules-config.js";
import { IcloudMailConfig } from "./services/mail-icloud-config.js";
import { MailIcloudLive } from "./services/mail-icloud.js";
import { AiLive } from "./services/openai-subscription.js";
import { AgentToolkitHandlersLive } from "./connectors/agent-toolkit.js";
import { CalendarLocalizationLive } from "./services/calendar-localization.js";
import { WeatherOpenMeteoLive } from "./services/weather-open-meteo.js";
import { WeatherRulesConfig } from "./services/weather-rules-config.js";

export const PlatformLive = Layer.mergeAll(BunServices.layer, BunHttpClient.layer);

export const MailRulesConfigLive = MailRulesConfig.layer.pipe(Layer.provide(PlatformLive));

/** IMAP + rules markdown (folders, triage guide, agent settings). */
export const CoreMailLive = Layer.mergeAll(
  IcloudMailConfig.layer,
  MailRulesConfigLive,
  MailIcloudLive,
);

export const CalendarRulesConfigLive = CalendarRulesConfig.layer.pipe(Layer.provide(PlatformLive));

const CalendarIcloudImplemented = CalendarIcloudLive.pipe(
  Layer.provide(IcloudCalendarConfig.layer),
);

/** CalDAV + calendar/RULES.md (brief schedule, timezone, calendar filter). */
export const CoreCalendarLive = Layer.mergeAll(CalendarRulesConfigLive, CalendarIcloudImplemented);

export const WeatherRulesConfigLive = WeatherRulesConfig.layer.pipe(Layer.provide(PlatformLive));

const CalendarLocalizationImplemented = CalendarLocalizationLive.pipe(
  Layer.provide(CalendarRulesConfigLive),
  Layer.provide(CalendarIcloudImplemented),
);

const WeatherOpenMeteoImplemented = WeatherOpenMeteoLive.pipe(
  Layer.provide(WeatherRulesConfigLive),
  Layer.provide(CalendarLocalizationImplemented),
);

/** Calendar localization event + Open-Meteo forecast (weather/RULES.md thresholds). */
export const CoreWeatherLive = Layer.mergeAll(
  WeatherRulesConfigLive,
  CalendarRulesConfigLive,
  CalendarLocalizationImplemented,
  WeatherOpenMeteoImplemented,
);

export const ConnectorRegistryLive = ConnectorRegistry.layer.pipe(
  Layer.provide(AgentToolkitHandlersLive),
  Layer.provide(CoreMailLive),
  Layer.provide(CoreCalendarLive),
  Layer.provide(CoreWeatherLive),
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

export const CalendarBriefLive = CalendarBrief.layer.pipe(
  Layer.provide(CalendarBriefSentStore.layer),
  Layer.provide(CoreCalendarLive),
  Layer.provide(CoreWeatherLive),
  Layer.provide(DiscordChannelSend.layer),
  Layer.provide(DiscordConfig.layer),
  Layer.provide(PlatformLive),
);

export const DiscordLive = DiscordBot.layer.pipe(
  Layer.provide(DiscordConfig.layer),
  Layer.provide(AiAssistantLive),
  Layer.provide(PlatformLive),
);

/** Discord + background mail triage + calendar morning brief. */
export const AppLive = Layer.mergeAll(MailAgentLive, CalendarBriefLive, DiscordLive);
