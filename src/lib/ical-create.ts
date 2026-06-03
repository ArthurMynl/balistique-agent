export type IcalLocalDateTime = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
};

export type IcalLocalDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

export type BuildVEventIcsInput = {
  readonly uid: string;
  readonly summary: string;
  readonly timeZone: string;
  readonly allDay: boolean;
  readonly start: IcalLocalDateTime | IcalLocalDate;
  readonly end: IcalLocalDateTime | IcalLocalDate;
  readonly location?: string | undefined;
  readonly description?: string | undefined;
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

const icalEscape = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const icalDateValue = (parts: IcalLocalDate): string =>
  `${String(parts.year).padStart(4, "0")}${pad2(parts.month)}${pad2(parts.day)}`;

const icalDateTimeValue = (parts: IcalLocalDateTime): string =>
  `${icalDateValue(parts)}T${pad2(parts.hour)}${pad2(parts.minute)}00`;

const formatDtStamp = (instant: Date): string => {
  const y = instant.getUTCFullYear();
  const mo = instant.getUTCMonth() + 1;
  const d = instant.getUTCDate();
  const h = instant.getUTCHours();
  const mi = instant.getUTCMinutes();
  const s = instant.getUTCSeconds();
  return `${String(y).padStart(4, "0")}${pad2(mo)}${pad2(d)}T${pad2(h)}${pad2(mi)}${pad2(s)}Z`;
};

export const buildVEventIcs = (input: BuildVEventIcsInput): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//balistique-agent//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${formatDtStamp(new Date())}`,
    `SUMMARY:${icalEscape(input.summary)}`,
  ];

  if (input.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${icalDateValue(input.start as IcalLocalDate)}`);
    lines.push(`DTEND;VALUE=DATE:${icalDateValue(input.end as IcalLocalDate)}`);
  } else {
    const start = input.start as IcalLocalDateTime;
    const end = input.end as IcalLocalDateTime;
    lines.push(`DTSTART;TZID=${input.timeZone}:${icalDateTimeValue(start)}`);
    lines.push(`DTEND;TZID=${input.timeZone}:${icalDateTimeValue(end)}`);
  }

  if (input.location !== undefined && input.location.trim().length > 0) {
    lines.push(`LOCATION:${icalEscape(input.location.trim())}`);
  }
  if (input.description !== undefined && input.description.trim().length > 0) {
    lines.push(`DESCRIPTION:${icalEscape(input.description.trim())}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
};

export const newEventUid = (): string => crypto.randomUUID();
