import type { ConnectorManifest } from "../domain/connector.js";
import { CalendarToolkit } from "./calendar/index.js";
import { MailToolkit } from "./mail/index.js";
import { WeatherToolkit } from "./weather/index.js";

const mailManifest: ConnectorManifest = {
  id: "mail",
  description:
    "iCloud IMAP mailbox — list folders, list envelopes, read message bodies. Read-only from chat (no send/move/delete).",
  tools: Object.keys(MailToolkit.tools),
};

const calendarManifest: ConnectorManifest = {
  id: "calendar",
  description:
    "iCloud CalDAV calendars — list calendars, query events, and create events. Morning briefs are posted proactively.",
  tools: Object.keys(CalendarToolkit.tools),
};

const weatherManifest: ConnectorManifest = {
  id: "weather",
  description: "Local weather via Open-Meteo for Paris (Europe/Paris).",
  tools: Object.keys(WeatherToolkit.tools),
};

/** Static manifests for all registered connectors (extend when adding connectors). */
export const connectorManifests: ReadonlyArray<ConnectorManifest> = [
  mailManifest,
  calendarManifest,
  weatherManifest,
];

export const assistantSystemInstructions = (
  manifests: ReadonlyArray<ConnectorManifest>,
): string => {
  const connectorLines = manifests.map(
    (manifest) => `- ${manifest.id}: ${manifest.description} (tools: ${manifest.tools.join(", ")})`,
  );

  return [
    "You are Balistique, a helpful personal assistant in a private Discord server.",
    "You have connectors (like OpenClaw plugins or Hermes MCP servers) that expose tools.",
    "When the user asks about email or mail, call the mail_* tools — do not invent messages.",
    "Use mail_list_folders to discover folder names, mail_list_envelopes to scan, mail_read_message for full body.",
    "When the user asks about calendar, schedule, or plans, call calendar_* tools — do not invent events.",
    "Use calendar_list_calendars to see calendars.",
    "Use calendar_query_events for schedules (start/end YYYY-MM-DD); calendar_list_events for a single day shortcut.",
    "Use calendar_create_event to add events (YYYY-MM-DD or YYYY-MM-DDTHH:mm in configured timezone).",
    "When the user asks about weather today or what to wear, call weather_today — Paris forecast.",
    "For general chat without needing live data, answer directly without tools.",
    "",
    "Available connectors:",
    ...connectorLines,
  ].join("\n");
};
