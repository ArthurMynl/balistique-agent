export type CalendarBriefSettings = {
  readonly briefEnabled: boolean;
  readonly briefTime: string;
  readonly timezone: string;
  readonly dryRun: boolean;
  readonly checkIntervalSeconds: number;
  readonly briefGuide: string;
  readonly includeCalendarNames: ReadonlyArray<string>;
};

export const defaultCalendarBriefSettings = (): CalendarBriefSettings => ({
  briefEnabled: true,
  briefTime: "07:00",
  timezone: "Europe/Paris",
  dryRun: false,
  checkIntervalSeconds: 60,
  briefGuide: [
    "Write a concise morning brief for Discord (under 1800 characters).",
    "Lead with a one-line overview of how busy the day is.",
    "List events in chronological order with start times.",
    "Call out conflicts, back-to-back blocks, and large gaps.",
    "Use plain text; no markdown headings.",
  ].join("\n"),
  includeCalendarNames: [],
});
