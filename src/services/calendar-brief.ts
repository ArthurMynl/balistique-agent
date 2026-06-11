import { BunServices } from "@effect/platform-bun";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  filterEventsByCalendarNames,
  formatEventList,
  isoDateKey,
  parseBriefTime,
  zonedDateParts,
} from "../lib/calendar-context.js";
import { formatWeatherBriefSection, weatherInsights } from "../lib/weather-open-meteo.js";
import { Calendar } from "./calendar.js";
import { CalendarBriefSentStore } from "./calendar-brief-sent-store.js";
import { CalendarRulesConfig } from "./calendar-rules-config.js";
import { DiscordChannelSend } from "./discord-channel-send.js";
import { DiscordConfig } from "./discord-config.js";
import { AiLive, generateText } from "./openai-subscription.js";
import { Weather } from "./weather.js";
import { WeatherRulesConfig } from "./weather-rules-config.js";

const BriefPlatformLive = Layer.mergeAll(BunServices.layer, BunHttpClient.layer);
const BriefAiLive = AiLive.pipe(Layer.provide(BriefPlatformLive));

const buildBriefPrompt = (
  dateKey: string,
  eventsText: string,
  weatherText: string,
  guide: string,
  timeZone: string,
): string => {
  const sections = [
    `Compose the daily calendar brief for ${dateKey} (${timeZone}).`,
    "",
    "Events:",
    eventsText,
  ];

  if (weatherText.length > 0) {
    sections.push("", "Weather:", weatherText);
  }

  sections.push("", "Instructions:", guide);
  return sections.join("\n");
};

export class CalendarBrief extends Context.Service<CalendarBrief>()("@app/CalendarBrief", {
  make: Effect.gen(function* () {
    const calendar = yield* Calendar;
    const rules = yield* CalendarRulesConfig;
    const weatherRules = yield* WeatherRulesConfig;
    const weather = yield* Weather;
    const store = yield* CalendarBriefSentStore;
    const discord = yield* DiscordConfig;
    const channelSend = yield* DiscordChannelSend;

    const runOnce = Effect.fn("CalendarBrief.runOnce")(function* () {
      if (!rules.briefEnabled) return;

      const briefTime = parseBriefTime(rules.briefTime);
      if (briefTime === undefined) {
        yield* Effect.logError(`[calendar] invalid briefTime in rules: ${rules.briefTime}`);
        return;
      }

      const now = new Date();
      const parts = zonedDateParts(now, rules.timezone);
      const dateKey = isoDateKey(parts);

      if (parts.hour < briefTime.hour) return;
      if (parts.hour === briefTime.hour && parts.minute < briefTime.minute) return;

      if (yield* store.has(dateKey)) return;

      const events = yield* calendar.listEventsForDay({ timeZone: rules.timezone });
      const filtered = filterEventsByCalendarNames(events, rules.includeCalendarNames);
      const eventsText = formatEventList(`Today (${dateKey})`, filtered);

      const weatherText =
        weatherRules.enabled && weatherRules.configured
          ? yield* weather.today({}).pipe(
              Effect.map((snapshot) => {
                const insights = weatherInsights({
                  precipProbabilityMaxPercent: snapshot.precipProbabilityMaxPercent,
                  precipChanceThresholdPercent: weatherRules.precipChanceThresholdPercent,
                  uvIndexMax: snapshot.uvIndexMax,
                  uvHighThreshold: weatherRules.uvHighThreshold,
                  currentWeatherCode: snapshot.currentWeatherCode,
                  dailyWeatherCode: snapshot.dailyWeatherCode,
                });
                return formatWeatherBriefSection(snapshot, insights);
              }),
              Effect.tapError((error) =>
                Effect.logError(`[calendar] weather for brief failed: ${error.message}`),
              ),
              Effect.catch(() => Effect.succeed("")),
            )
          : "";

      const prompt = buildBriefPrompt(
        dateKey,
        eventsText,
        weatherText,
        rules.briefGuide,
        rules.timezone,
      );

      if (rules.dryRun) {
        yield* Effect.log(`[calendar] brief dry-run for ${dateKey}:\n${eventsText}`);
        yield* store.mark(dateKey);
        return;
      }

      if (discord.briefChannelId.length === 0) {
        yield* Effect.logError(
          "[calendar] DISCORD_BRIEF_CHANNEL_ID is not set; brief will not be posted",
        );
        return;
      }

      const aiPrompt = [
        "You write short, actionable daily calendar briefs for a private Discord channel.",
        "",
        prompt,
      ].join("\n");

      const text = (yield* generateText(aiPrompt).pipe(
        Effect.tapError((error) =>
          Effect.logError(`[calendar] brief generation failed: ${String(error)}`),
        ),
        Effect.catch(() => Effect.succeed("")),
        Effect.provide(BriefAiLive),
      )).trim();
      if (text.length === 0) {
        yield* Effect.logError(`[calendar] empty brief for ${dateKey}, not marking sent`);
        return;
      }

      const header = `**Daily brief — ${dateKey}**\n\n`;
      const sent = yield* channelSend.send(discord.briefChannelId, `${header}${text}`).pipe(
        Effect.as(true),
        Effect.tapError((error) =>
          Effect.logError(`[calendar] Discord send failed: ${error.message}`),
        ),
        Effect.catch(() => Effect.succeed(false)),
      );
      if (!sent) return;

      yield* store.mark(dateKey);
      yield* Effect.log(`[calendar] brief sent for ${dateKey} (${filtered.length} events)`);
    });

    const runLoop = Effect.fn("CalendarBrief.runLoop")(function* () {
      yield* Effect.log(
        `[calendar] brief scheduler started — check every ${rules.checkIntervalSeconds}s, time ${rules.briefTime} ${rules.timezone}, enabled=${rules.briefEnabled}`,
      );
      return yield* Effect.forever(
        Effect.gen(function* () {
          yield* runOnce();
          yield* Effect.sleep(`${rules.checkIntervalSeconds} seconds`);
        }),
      );
    });

    return { runOnce, runLoop } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
