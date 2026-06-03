import {
  defaultWeatherRulesSettings,
  type WeatherRulesSettings,
} from "./weather-brief-settings.js";

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

type RulesBucket = {
  settings: Record<string, string>;
};

const emptyBucket = (): RulesBucket => ({
  settings: {},
});

const assignLine = (bucket: RulesBucket, section: string, line: string): void => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return;

  if (section === "agent-settings") {
    const kv = parseKeyValue(line);
    if (kv) bucket.settings[kv.key] = kv.value;
  }
};

export const parseWeatherRulesMarkdown = (markdown: string): WeatherRulesSettings => {
  const defaults = defaultWeatherRulesSettings();
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
  const enabled = parseBoolean(setting("enabled") ?? "") ?? defaults.enabled;
  const uvHighThreshold = parseNumber(setting("uvHighThreshold") ?? "") ?? defaults.uvHighThreshold;
  const precipChanceThresholdPercent =
    parseNumber(setting("precipChanceThresholdPercent") ?? "") ??
    defaults.precipChanceThresholdPercent;

  return {
    enabled,
    uvHighThreshold: Math.max(1, Math.min(uvHighThreshold, 11)),
    precipChanceThresholdPercent: Math.max(0, Math.min(precipChanceThresholdPercent, 100)),
  };
};
