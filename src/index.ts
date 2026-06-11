import { BunRuntime } from "@effect/platform-bun";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  AppLive,
  CalendarBriefLive,
  CoreMailLive,
  DiscordLive,
  MailAgentLive,
  PlatformLive,
} from "./app-layer.js";
import { CalendarBrief } from "./services/calendar-brief.js";
import { MailAutomation } from "./services/mail-automation.js";
import { OpenAiCodexAuth } from "./services/openai-codex-auth.js";
import { DiscordBot } from "./services/discord-bot.js";
import { Mail } from "./services/mail.js";
import { MailIcloudLive } from "./services/mail-icloud.js";
import { generateText, OpenAiSubscriptionLive } from "./services/openai-subscription.js";

const LoginLive = OpenAiCodexAuth.layer.pipe(Layer.provide(PlatformLive));

const ChatLive = OpenAiSubscriptionLive.pipe(Layer.provide(PlatformLive));

const MailLive = MailIcloudLive.pipe(Layer.provide(CoreMailLive), Layer.provide(PlatformLive));

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
} else if (mode === "discord") {
  BunRuntime.runMain(discordProgram.pipe(Effect.provide(DiscordLive)));
} else {
  BunRuntime.runMain(appProgram.pipe(Effect.provide(AppLive)));
}
