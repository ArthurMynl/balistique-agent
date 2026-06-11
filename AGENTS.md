# AGENTS.md

## Task Completion Requirements

- `bun run fmt`, `bun run lint`, and `bun run typecheck` must all pass before considering a task complete.
- Run `bun run fmt:check` in CI-style verification; use `bun run fmt` to fix formatting.
- NEVER run bare `bun test` unless a `test` script exists in `package.json`. (There is no test suite yet.)

## Project Snapshot

Balistique Agent is a personal AI assistant on **Effect v4** and **Bun** (`@effect/platform-bun`). It connects OpenAI (Codex subscription / ChatGPT OAuth) to Discord and iCloud mail: one process runs Discord, background inbox triage, and an **agent loop with connector tools** (mail today; more connectors later).

Package manager and runtime are both Bun. Follow [Effect Solutions](https://www.effect.solutions) patterns for production-ready code.

## Core Priorities

1. **Correctness and typed errors** — model expected failures with `Schema.TaggedErrorClass`; defects stay defects.
2. **Reliability** — Discord reconnects, partial streams, and auth refresh must fail predictably with clear logs.
3. **Maintainability** — extract shared logic instead of duplicating across services.

If a tradeoff is required, choose robustness and clear failure modes over shortcuts.

## IMPORTANT

- Use `Effect.gen` + `yield*` for sequential effectful logic; name handlers with `Effect.fn("Module.method")`.
- Compose dependencies with **Layers once at the entry point** — do not scatter `Effect.provide` through business code.
- DO NOT use bare `Promise` / `async` in core logic; wrap at boundaries or use Effect primitives.
- DO NOT catch errors with empty handlers or silently widen typed errors to `unknown`.
- DO NOT instantiate the same parameterized `Layer` inline in multiple places (breaks memoization).
- AVOID `any`; prefer `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Prefer Bun platform APIs via `@effect/platform-bun`, not `@effect/platform-node`.
- Relative imports use `.js` extensions (`NodeNext` + `rewriteRelativeImportExtensions`).

## Build / Dev Commands

- **Install**: `bun install` (runs `prepare` → Effect language-service patch)
- **Run (assistant — Discord + mail triage)**: `bun run dev`
- **Run (Discord only)**: `bun run dev:discord`
- **Run (one-shot chat)**: `bun run dev:chat`
- **Run (mail agent)**: `bun run dev:mail-agent`
- **Run (calendar brief only)**: `bun run dev:calendar-brief`
- **OAuth login**: `bun run auth:login`
- **Typecheck**: `bun run typecheck`
- **Lint**: `bun run lint` / `bun run lint:fix`
- **Format**: `bun run fmt` / `bun run fmt:check`
- **Effect patterns**: `bun run effect:docs`, `bun run effect:show <topic>`

## Code Style

- **Runtime**: Bun, TypeScript ESM (`"type": "module"`)
- **Lint / format**: Oxlint + Oxfmt (oxc) — not ESLint or Prettier
- **Services**: `Context.Service` with `@app/ServiceName` tags; method `R = never`
- **Layers**: `Layer.effect` + `Effect.fn`; shared parameterized layers as module-level constants
- **Domain**: `Schema.Class`, branded IDs, `Schema.TaggedErrorClass` at boundaries
- **Config**: Effect `Config` + Layers — not raw `process.env` in services
- **Pure helpers**: `src/lib/` only — no Effect imports

## Module Layout

```
src/
  index.ts                    # Entry — mode switch (app | discord | mail | login)
  app-layer.ts                # Shared Layer composition (AppLive, CoreMailLive, …)
  domain/                     # Schemas, tagged errors, connector ids (no I/O)
  connectors/                 # Tools per integration (OpenClaw-plugin / Hermes-MCP style)
    agent-toolkit.ts          # Toolkit.merge — register new connectors here
    registry.ts               # Manifests + assistant system instructions
    mail/                     # mail_list_* tools (read-only from chat)
    calendar/                 # calendar_* tools (list, query, create from chat)
    weather/                  # weather_today tool (Open-Meteo)
  lib/                        # Pure utilities (PKCE, mail-rules-md, mail-triage, mail-context)
mail/
  RULES.md                    # Mailbox triage policy (folders, triage guide, agent settings)
calendar/
  RULES.md                    # Morning brief schedule, timezone, calendar filter, brief guide
weather/
  RULES.md                    # Location, UV/rain thresholds (Open-Meteo, no API key)
  services/
    agent-assistant.ts        # LanguageModel.generateText + connector toolkit
    connector-registry.ts     # Merged toolkit for the assistant
    discord-config.ts         # Guild/channel allowlists from Config
    discord-bot.ts            # discord.js gateway
    openai-subscription.ts    # @effect/ai-openai subscription client + generateText
    openai-codex-auth.ts      # ChatGPT OAuth PKCE, credential store on disk
    mail.ts                   # Mail port (list/read/applyAction)
    mail-icloud-config.ts     # iCloud IMAP credentials from Config
    mail-icloud.ts            # Mail implementation via ImapFlow
    mail-rules-config.ts      # Loads mail/RULES.md at runtime
    mail-classifier.ts        # AI JSON triage → MailAction
    mail-processed-store.ts   # Idempotency store on disk
    mail-automation.ts        # Poll cycle orchestrator
    calendar.ts               # Calendar port (list calendars / events)
    calendar-icloud-caldav.ts # iCloud CalDAV via tsdav
    calendar-rules-config.ts  # Loads calendar/RULES.md
    calendar-brief.ts         # Proactive Discord morning brief (includes weather when configured)
    weather.ts                # Weather port (today snapshot)
    weather-open-meteo.ts     # Open-Meteo forecast (Paris)
    weather-rules-config.ts   # Loads weather/RULES.md (thresholds)
    discord-channel-send.ts   # Outbound Discord REST (brief channel)
```

### Entry modes (`src/index.ts`)

| Flag               | Mode                                   | Layers              |
| ------------------ | -------------------------------------- | ------------------- |
| (default)          | Discord + mail triage + calendar brief | `AppLive`           |
| `--discord-only`   | Discord only (no background loops)     | `DiscordLive`       |
| `--chat`           | One-shot `generateText` smoke test     | `ChatLive`          |
| `--login`          | Interactive Codex OAuth                | `LoginLive`         |
| `--mail`           | List recent iCloud INBOX envelopes     | `MailLive`          |
| `--mail-agent`     | Mail triage only                       | `MailAgentLive`     |
| `--calendar-brief` | Calendar morning brief loop only       | `CalendarBriefLive` |

## Effect Architecture

Boot with `BunRuntime.runMain`. Example shape:

```typescript
import { Effect, Layer } from "effect";
import { BunRuntime } from "@effect/platform-bun";

const program = Effect.gen(function* () {
  /* ... */
});
const MainLayer =
  /* compose all service layers */

  BunRuntime.runMain(program.pipe(Effect.provide(MainLayer)));
```

### Further reading (in-repo)

| Topic                 | When                                     |
| --------------------- | ---------------------------------------- |
| `basics`              | `Effect.gen`, `Effect.fn`, retry/timeout |
| `services-and-layers` | DI, layer composition, test layers       |
| `data-modeling`       | Schema, brands, variants                 |
| `error-handling`      | TaggedError, catch/match                 |
| `config`              | Environment configuration                |
| `testing`             | `@effect/vitest` patterns                |
| `cli`                 | Effect CLI module                        |

```bash
bun run effect:show basics services-and-layers error-handling
```

Local Effect v4 source (when docs are unclear):

```bash
# Reference clone
~/.local/share/effect-solutions/effect

# Update
git -C ~/.local/share/effect-solutions/effect pull --depth 1
```

## OpenAI Codex Auth

Subscription auth uses ChatGPT OAuth (PKCE). Credentials persist under the user config path via `OpenAiCodexAuth` / `OpenAiCodexAuthStore` in `domain/openai-codex.ts` and `services/openai-codex-auth.ts`.

- Run `bun run auth:login` before first use or when tokens expire.

## iCloud Mail

IMAP via `Mail` / `MailIcloudLive` (ImapFlow): list, read, and apply actions (`MarkRead`, `MoveToFolder`, `Delete`, `Leave`). Configure in `.env`:

- `ICLOUD_IMAP_LOGIN` — short mailbox name (e.g. `johnappleseed`, not full email)
- `ICLOUD_APP_PASSWORD` — [app-specific password](https://account.apple.com)
- Optional: `ICLOUD_EMAIL`, `ICLOUD_IMAP_FOLDER` (default `INBOX`), `ICLOUD_IMAP_HOST`

Smoke test: `bun run dev:mail`

### Mailbox automation (`--mail-agent` or default `dev`)

Long-running triage runs in the background when using `bun run dev` (default). It polls unread INBOX, reads each message, classifies with Codex from subject/body content, and applies IMAP actions. Discord-only: `bun run dev:discord`. Mail-only: `bun run dev:mail-agent`. Requires `bun run auth:login` for AI.

**Discord + mail:** In allowed channels, ask about email (e.g. “what’s unread?”, “summarize Waiting”). The assistant runs an agent loop with **mail connector tools** (`mail_list_folders`, `mail_list_envelopes`, `mail_read_message`) — same idea as OpenClaw `registerTool` plugins or Hermes MCP servers. Chat tools are read-only; background triage still moves mail via `mail-automation`.

## iCloud Calendar

CalDAV via `Calendar` / `CalendarIcloudLive` (tsdav): list calendars and day-scoped events. Reuses the same app-specific password as mail.

- `ICLOUD_IMAP_LOGIN` + `ICLOUD_APP_PASSWORD` (required)
- Optional: `ICLOUD_EMAIL` or `ICLOUD_CALDAV_LOGIN` (full Apple ID if login is not an email)
- Optional: `ICLOUD_CALDAV_URL` (default `https://caldav.icloud.com/`)
- `DISCORD_BRIEF_CHANNEL_ID` — channel for proactive morning briefs
- Optional: `CALENDAR_RULES_PATH` (default `calendar/RULES.md`)

**Discord + calendar:** Ask “what’s on my calendar today?” — the assistant uses `calendar_list_calendars`, `calendar_list_events`, and `calendar_query_events`. Ask to schedule something — it uses `calendar_create_event`. **Morning brief:** at `briefTime` in `calendar/RULES.md`, `calendar-brief` fetches today’s events and weather (when `weather/RULES.md` is enabled), asks Codex for a short summary, and posts to `DISCORD_BRIEF_CHANNEL_ID` (once per local day). Test loop only: `bun run dev:calendar-brief`.

**Rules live in [`calendar/RULES.md`](calendar/RULES.md)** — `briefTime`, `timezone` (default `Europe/Paris`), `briefEnabled`, `dryRun`, optional calendar filter, and the brief guide.

## Weather (Open-Meteo)

Forecast via `Weather` / `WeatherOpenMeteoLive` — no API key. **Location and timezone** are fixed to **Paris** (`Europe/Paris`).

- Optional: `WEATHER_RULES_PATH` (default `weather/RULES.md`) — UV/rain thresholds
- Optional: `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` in `.env` (coordinate override)
- **Discord:** `weather_today`. **Morning brief** includes weather when enabled.

### Connectors (agent tools)

| Piece                               | Role                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `src/connectors/<name>/tools.ts`    | `Tool.make` definitions (schema + description)       |
| `src/connectors/<name>/handlers.ts` | `Toolkit.toLayer` handlers (call `Mail`, etc.)       |
| `src/connectors/agent-toolkit.ts`   | `Toolkit.merge` — wire new connectors here           |
| `src/connectors/registry.ts`        | Manifest list + system prompt for the model          |
| `src/services/agent-assistant.ts`   | `LanguageModel.generateText({ toolkit })` agent loop |

**Add a connector:** create `src/connectors/foo/`, export `FooToolkit` + `FooToolkitHandlersLive`, merge in `agent-toolkit.ts`, add manifest in `registry.ts`, provide handler layer in `ConnectorRegistryLive` / `app-layer.ts`.

**Rollout (recommended):**

1. `dryRun: true` (default) — log AI classification decisions only
2. `dryRun: false`, keep `allowDelete: false`
3. Tune the **Triage guide** in `mail/RULES.md` when mis-sorts appear
4. Set `allowDelete: true` in Agent settings only after you trust classifications (optional; AI never deletes by default)

**Rules live in [`mail/RULES.md`](mail/RULES.md)** (gstack-style: human-readable policy the agent executes). Edit folders, triage guide, and agent settings there — not in `.env`. Only IMAP secrets and runtime knobs stay in `.env`.

**Triage:** AI reads each message and picks a folder using the **Triage guide**. Categories: `Action`, `Waiting`, `ReadLater`, `Notifications`, `Archive`. INBOX is unprocessed only — the agent empties it into a folder. `Leave` is fallback-only (classifier failure, AI disabled, or explicit `aiFallback: Leave`).

**Agent settings** (in `mail/RULES.md` § Agent settings): `dryRun`, `pollInterval`, `aiEnabled`, `allowDelete`, `aiFallback`, etc.

**Optional `.env` override:**

| Variable               | Default               | Purpose                      |
| ---------------------- | --------------------- | ---------------------------- |
| `MAIL_RULES_PATH`      | `mail/RULES.md`       | Path to rules markdown       |
| `BALISTIQUE_STATE_DIR` | `~/.balistique-agent` | Processed-message JSON store |

Processed UIDs/Message-IDs are stored in `mail-processed.json` (or `mail-processed-dry-run.json` when dry-run).

- Domain errors: `MailError`, `MailStoreError`, `OpenAiCodexAuthError` — surface them; do not swallow.

## Maintainability

Before adding behavior in a service, check whether it belongs in `domain/` (types/errors), `lib/` (pure), or an existing service. Duplicate Discord or auth logic across files is a smell — extract a module instead of patching locally.

## Reference Repos

- [OpenCode](https://github.com/anomalyco/opencode) — Bun/TS agent tooling; see `AGENTS.md` patterns for concise agent docs and Codex-adjacent workflows.
- [T3 Code](https://github.com/pingdotgg/t3code) — Effect + Schema contracts, reliability-first agent UI (structure of this file).
- [Effect](https://effect.website) — framework docs.
- [Effect Solutions](https://www.effect.solutions) — project patterns (`bun run effect:show`).

Use OpenCode and T3 Code as references for OAuth/session handling and agent UX — adapt to this repo’s Effect service layout, not copy their monorepo layout.

## Do Not

- Commit secrets (`.env`, credential files).
- Add ESLint/Prettier — use oxlint/oxfmt.
- Import from `@effect/platform-node`.
- Re-import Effect from deep paths inconsistently; match existing subpath style (`effect/Effect`, `effect/Context`, etc.).
