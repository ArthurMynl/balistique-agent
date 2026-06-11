import {
  defaultCalendarBriefSettings,
  type CalendarBriefSettings,
} from "./calendar-brief-settings.js";

const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

const parseKeyValue = (line: string): { key: string; value: string } | undefined => {
  const match = line.trim().match(/^([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+)$/);
  if (!match) return undefined;
  return { key: match[1]!, value: match[2]!.trim() };
};

const parseBoolean = (value: string): boolean | undefined => {
  const lower = value.trim().toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "1") return true;
  if (lower === "false" || lower === "no" || lower === "0") return false;
  return undefined;
};

const parseNumber = (value: string): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

type AgentBucket = {
  settings: Record<string, string>;
  briefGuideLines: Array<string>;
  includeCalendars: Array<string>;
};

const emptyBucket = (): AgentBucket => ({
  settings: {},
  briefGuideLines: [],
  includeCalendars: [],
});

const assignLine = (bucket: AgentBucket, section: string, line: string): void => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return;

  switch (section) {
    case "agent-settings": {
      const kv = parseKeyValue(line);
      if (kv) bucket.settings[kv.key] = kv.value;
      return;
    }
    case "brief-guide":
      bucket.briefGuideLines.push(trimmed);
      return;
    case "calendars":
      if (trimmed.startsWith("-")) {
        bucket.includeCalendars.push(trimmed.replace(/^-\s*/, "").trim());
      } else {
        const kv = parseKeyValue(line);
        if (kv) bucket.includeCalendars.push(kv.value);
      }
      return;
    default:
      return;
  }
};

export const parseCalendarRulesMarkdown = (markdown: string): CalendarBriefSettings => {
  const defaults = defaultCalendarBriefSettings();
  const bucket = emptyBucket();
  let section = "";

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      section = slug(heading[1]!);
      continue;
    }
    if (line.trim().startsWith("#")) continue;
    if (section.length === 0) continue;
    assignLine(bucket, section, line);
  }

  const setting = (key: string): string | undefined => bucket.settings[key];

  const briefEnabled = parseBoolean(setting("briefEnabled") ?? "") ?? defaults.briefEnabled;
  const dryRun = parseBoolean(setting("dryRun") ?? "") ?? defaults.dryRun;
  const checkIntervalSeconds =
    parseNumber(setting("checkIntervalSeconds") ?? "") ?? defaults.checkIntervalSeconds;

  const briefGuide =
    bucket.briefGuideLines.join("\n").trim().length > 0
      ? bucket.briefGuideLines.join("\n").trim()
      : defaults.briefGuide;

  return {
    briefEnabled,
    briefTime: setting("briefTime") ?? defaults.briefTime,
    timezone: setting("timezone") ?? defaults.timezone,
    dryRun,
    checkIntervalSeconds: Math.max(30, Math.min(checkIntervalSeconds, 3600)),
    briefGuide,
    includeCalendarNames: bucket.includeCalendars.filter((name) => name.length > 0),
  };
};
