import { BunRuntime } from "@effect/platform-bun";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  AppLive,
  CalendarBriefLive,
  CoreCalendarLive,
  CoreWeatherLive,
  CoreMailLive,
  DiscordLive,
  MailAgentLive,
  PlatformLive,
} from "./app-layer.js";
import { Calendar } from "./services/calendar.js";
import { CalendarBrief } from "./services/calendar-brief.js";
import { CalendarLocalization } from "./services/calendar-localization.js";
import { CalendarRulesConfig } from "./services/calendar-rules-config.js";
import { MailAutomation } from "./services/mail-automation.js";
import { OpenAiCodexAuth } from "./services/openai-codex-auth.js";
import { DiscordBot } from "./services/discord-bot.js";
import { Mail } from "./services/mail.js";
import { MailIcloudLive } from "./services/mail-icloud.js";
import { generateText, OpenAiSubscriptionLive } from "./services/openai-subscription.js";
import {
  dayEventsFetchWindow,
  eventOccursOnDay,
  isoDateKey,
  zonedDateParts,
} from "./lib/calendar-context.js";
import {
  isLocalizationEvent,
  placeQueryFromLocalizationEvent,
} from "./lib/calendar-localization.js";

const LoginLive = OpenAiCodexAuth.layer.pipe(Layer.provide(PlatformLive));

const ChatLive = OpenAiSubscriptionLive.pipe(Layer.provide(PlatformLive));

const MailLive = MailIcloudLive.pipe(Layer.provide(CoreMailLive), Layer.provide(PlatformLive));

const LocalizationDebugLive = Layer.mergeAll(CoreCalendarLive, CoreWeatherLive).pipe(
  Layer.provide(PlatformLive),
);

const loginProgram = Effect.gen(function* () {
  const auth = yield* OpenAiCodexAuth;
  yield* auth.login();
});

const discordProgram = Effect.gen(function* () {
  const bot = yield* DiscordBot;
  return yield* bot.run;
});

const chatProgram = Effect.gen(function* () {
  const text = yield* generateText("Say hello in one short sentence.");
  yield* Effect.log(`OpenAI: ${text}`);
});

const mailProgram = Effect.gen(function* () {
  const mail = yield* Mail;
  const envelopes = yield* mail.listEnvelopes({ limit: 10 });
  if (envelopes.length === 0) {
    yield* Effect.log("iCloud INBOX: (no messages)");
    return;
  }
  for (const envelope of envelopes) {
    const seen = envelope.seen ? "" : " [unread]";
    const date = envelope.date?.toISOString() ?? "unknown date";
    yield* Effect.log(`[${envelope.uid}] ${date}${seen} — ${envelope.from} — ${envelope.subject}`);
  }
});

const mailAgentProgram = Effect.gen(function* () {
  const automation = yield* MailAutomation;
  return yield* automation.runLoop();
});

const calendarBriefProgram = Effect.gen(function* () {
  const brief = yield* CalendarBrief;
  return yield* brief.runLoop();
});

const localizationDebugProgram = Effect.gen(function* () {
  const calendar = yield* Calendar;
  const rules = yield* CalendarRulesConfig;
  const localization = yield* CalendarLocalization;
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="))?.slice("--date=".length);
  const ref =
    dateArg === undefined || dateArg.trim().length === 0
      ? new Date()
      : new Date(`${dateArg.trim()}T12:00:00Z`);
  const dayKey = isoDateKey(zonedDateParts(ref, rules.timezone));
  const window = dayEventsFetchWindow(dayKey);
  const calendars = yield* calendar.listCalendars();
  const fetched = yield* calendar.listEventsInRange(window);
  const events = fetched.filter((event) => eventOccursOnDay(event, dayKey, rules.timezone));

  yield* Effect.log(
    `[localization-debug] calendars=${calendars.map((cal) => `"${cal.name}"`).join(", ") || "(none)"}`,
  );
  yield* Effect.log(
    `[localization-debug] day=${dayKey} timezone=${rules.timezone} window=${window.start.toISOString()}..${window.end.toISOString()} fetched=${fetched.length} onDay=${events.length}`,
  );

  for (const event of fetched) {
    const onDay = eventOccursOnDay(event, dayKey, rules.timezone);
    yield* Effect.log(
      [
        "[localization-debug:fetched]",
        `onDay=${String(onDay)}`,
        `summary="${event.summary}"`,
        `start=${event.start.toISOString()}`,
        `end=${event.end?.toISOString() ?? "(none)"}`,
        `calendar="${event.calendarName}"`,
      ].join(" "),
    );
  }

  for (const event of events) {
    const matches = isLocalizationEvent(event, rules.localization);
    const place = placeQueryFromLocalizationEvent(event, rules.localization);
    yield* Effect.log(
      [
        "[localization-debug]",
        `match=${String(matches)}`,
        `summary="${event.summary}"`,
        `allDay=${String(event.allDay)}`,
        `start=${event.start.toISOString()}`,
        `end=${event.end?.toISOString() ?? "(none)"}`,
        `location="${event.location ?? ""}"`,
        `calendar="${event.calendarName}"`,
        `place="${place?.geocodeQuery ?? place?.city ?? ""}"`,
      ].join(" "),
    );
  }

  const resolved = yield* localization.resolveForDay({ date: ref });
  yield* Effect.log(
    `[localization-debug] resolved label="${resolved.label}" timezone=${resolved.timeZone} coords=${resolved.latitude},${resolved.longitude} fromCalendar=${String(resolved.fromCalendarEvent)}`,
  );
});

const appProgram = Effect.gen(function* () {
  yield* Effect.log("[app] starting Discord + mail triage + calendar brief");
  const automation = yield* MailAutomation;
  yield* automation.runLoop().pipe(Effect.forkDetach);
  const brief = yield* CalendarBrief;
  yield* brief.runLoop().pipe(Effect.forkDetach);
  const bot = yield* DiscordBot;
  return yield* bot.run;
});

const mode = process.argv.includes("--login")
  ? "login"
  : process.argv.includes("--chat")
    ? "chat"
    : process.argv.includes("--calendar-brief")
      ? "calendar-brief"
      : process.argv.includes("--localization-debug")
        ? "localization-debug"
        : process.argv.includes("--mail-agent")
          ? "mail-agent"
          : process.argv.includes("--mail")
            ? "mail"
            : process.argv.includes("--discord-only")
              ? "discord"
              : "app";

if (mode === "login") {
  BunRuntime.runMain(loginProgram.pipe(Effect.provide(LoginLive)));
} else if (mode === "chat") {
  BunRuntime.runMain(chatProgram.pipe(Effect.provide(ChatLive)));
} else if (mode === "mail") {
  BunRuntime.runMain(mailProgram.pipe(Effect.provide(MailLive)));
} else if (mode === "mail-agent") {
  BunRuntime.runMain(mailAgentProgram.pipe(Effect.provide(MailAgentLive)));
} else if (mode === "calendar-brief") {
  BunRuntime.runMain(calendarBriefProgram.pipe(Effect.provide(CalendarBriefLive)));
} else if (mode === "localization-debug") {
  BunRuntime.runMain(localizationDebugProgram.pipe(Effect.provide(LocalizationDebugLive)));
} else if (mode === "discord") {
  BunRuntime.runMain(discordProgram.pipe(Effect.provide(DiscordLive)));
} else {
  BunRuntime.runMain(appProgram.pipe(Effect.provide(AppLive)));
}
