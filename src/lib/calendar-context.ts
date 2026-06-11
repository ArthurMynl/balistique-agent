import type { CalendarEvent, CalendarInfo } from "../domain/calendar.js";
import type { IcalLocalDate, IcalLocalDateTime } from "./ical-create.js";

/** IANA timezone for the machine running the agent (e.g. `Europe/Paris`). */
export const systemTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const formatTime = (date: Date, allDay: boolean, timeZone: string): string => {
  if (allDay) return "all day";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
};

const formatEventLine = (event: CalendarEvent, timeZone: string): string => {
  const start = formatTime(event.start, event.allDay, timeZone);
  const end =
    event.end !== undefined && !event.allDay
      ? `–${formatTime(event.end, false, timeZone)}`
      : event.allDay
        ? ""
        : "";
  const location = event.location !== undefined ? ` @ ${event.location}` : "";
  const cal = event.calendarName.trim().length > 0 ? ` [${event.calendarName}]` : "";
  return `${start}${end} ${event.summary}${location}${cal}`;
};

export const formatCalendarList = (calendars: ReadonlyArray<CalendarInfo>): string => {
  if (calendars.length === 0) return "No calendars found.";
  return calendars.map((cal) => `- ${cal.name} (id: ${cal.id})`).join("\n");
};

export const formatEventList = (
  label: string,
  events: ReadonlyArray<CalendarEvent>,
  timeZone: string,
): string => {
  if (events.length === 0) return `${label}: no events.`;
  const lines = events.map((event) => `- ${formatEventLine(event, timeZone)}`);
  return `${label} (${events.length}):\n${lines.join("\n")}`;
};

export const filterEventsByCalendarNames = (
  events: ReadonlyArray<CalendarEvent>,
  includeNames: ReadonlyArray<string>,
): ReadonlyArray<CalendarEvent> => {
  if (includeNames.length === 0) return events;
  const allowed = new Set(includeNames.map((name) => name.trim().toLowerCase()));
  return events.filter((event) => allowed.has(event.calendarName.trim().toLowerCase()));
};

export const zonedDateParts = (
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

export const isoDateKey = (parts: { year: number; month: number; day: number }): string =>
  `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

/** Whether `dayKey` (YYYY-MM-DD in `timeZone`) falls on this event (incl. multi-day spans). */
export const eventOccursOnDay = (
  event: CalendarEvent,
  dayKey: string,
  timeZone: string,
): boolean => {
  const startKey = isoDateKey(zonedDateParts(event.start, timeZone));

  if (event.allDay) {
    if (event.end === undefined) return startKey === dayKey;
    const endKey = isoDateKey(zonedDateParts(event.end, timeZone));
    return dayKey >= startKey && dayKey < endKey;
  }

  const endKey = isoDateKey(zonedDateParts(event.end ?? event.start, timeZone));
  return dayKey >= startKey && dayKey <= endKey;
};

const isoDateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Validates `YYYY-MM-DD` and checks the date exists in `timeZone`. */
export const parseIsoDateKey = (value: string, timeZone: string): string | undefined => {
  const match = value.trim().match(isoDateKeyPattern);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const parts = zonedDateParts(noonUtc, timeZone);
  if (parts.year !== year || parts.month !== month || parts.day !== day) return undefined;
  return isoDateKey(parts);
};

export const daysBetweenIsoDateKeys = (startKey: string, endKey: string): number => {
  const start = Date.parse(`${startKey}T12:00:00Z`);
  const end = Date.parse(`${endKey}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const diff = Math.abs(end - start);
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
};

export const filterEventsInIsoDateRange = (
  events: ReadonlyArray<CalendarEvent>,
  startKey: string,
  endKey: string,
  timeZone: string,
): ReadonlyArray<CalendarEvent> =>
  events.filter((event) => {
    const key = isoDateKey(zonedDateParts(event.start, timeZone));
    return key >= startKey && key <= endKey;
  });

export const caldavFetchWindow = (startKey: string, endKey: string): { start: Date; end: Date } => {
  const startParts = startKey.split("-").map(Number) as [number, number, number];
  const endParts = endKey.split("-").map(Number) as [number, number, number];
  const startNoon = new Date(
    Date.UTC(startParts[0]!, startParts[1]! - 1, startParts[2]!, 12, 0, 0),
  );
  const endNoon = new Date(Date.UTC(endParts[0]!, endParts[1]! - 1, endParts[2]!, 12, 0, 0));
  return {
    start: new Date(startNoon.getTime() - 36 * 60 * 60 * 1000),
    end: new Date(endNoon.getTime() + 36 * 60 * 60 * 1000),
  };
};

/** Wide overlap window for one day (vacations starting weeks ago still load from CalDAV). */
export const dayEventsFetchWindow = (dayKey: string): { start: Date; end: Date } => {
  const parts = dayKey.split("-").map(Number) as [number, number, number];
  const noon = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, 12, 0, 0));
  const lookbackDays = 120;
  const lookaheadDays = 2;
  return {
    start: new Date(noon.getTime() - lookbackDays * 24 * 60 * 60 * 1000),
    end: new Date(noon.getTime() + lookaheadDays * 24 * 60 * 60 * 1000),
  };
};

export const formatEventQueryResult = (
  startKey: string,
  endKey: string,
  events: ReadonlyArray<CalendarEvent>,
  timeZone: string,
): string => {
  const label =
    startKey === endKey ? `Events on ${startKey}` : `Events from ${startKey} through ${endKey}`;
  if (events.length === 0) return `${label}: no events.`;
  const multiDay = startKey !== endKey;
  const lines = events.map((event) => {
    const dayKey = isoDateKey(zonedDateParts(event.start, timeZone));
    const body = formatEventLine(event, timeZone);
    return multiDay ? `- ${dayKey} ${body}` : `- ${body}`;
  });
  return `${label} (${events.length}):\n${lines.join("\n")}`;
};

export const parseBriefTime = (value: string): { hour: number; minute: number } | undefined => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return { hour, minute };
};

const eventDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

export type ParsedEventDateTime =
  | { readonly allDay: true; readonly date: IcalLocalDate }
  | { readonly allDay: false; readonly dateTime: IcalLocalDateTime };

export const parseEventDateTime = (
  value: string,
  timeZone: string,
  label: string,
): { ok: true; value: ParsedEventDateTime } | { ok: false; error: string } => {
  const match = value.trim().match(eventDateTimePattern);
  if (!match) {
    return {
      ok: false,
      error: `invalid ${label} (use YYYY-MM-DD or YYYY-MM-DDTHH:mm): ${value}`,
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hourRaw = match[4];
  const minuteRaw = match[5];

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { ok: false, error: `invalid ${label}: ${value}` };
  }

  const key = parseIsoDateKey(`${match[1]}-${match[2]}-${match[3]}`, timeZone);
  if (key === undefined) {
    return { ok: false, error: `invalid ${label} date in ${timeZone}: ${value}` };
  }

  if (hourRaw === undefined || minuteRaw === undefined) {
    return { ok: true, value: { allDay: true, date: { year, month, day } } };
  }

  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, error: `invalid ${label} time: ${value}` };
  }

  return {
    ok: true,
    value: { allDay: false, dateTime: { year, month, day, hour, minute } },
  };
};

export const addMinutesToLocalDateTime = (
  parts: IcalLocalDateTime,
  minutes: number,
): IcalLocalDateTime => {
  const base = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const shifted = new Date(base + minutes * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
};

export const nextLocalDate = (parts: IcalLocalDate): IcalLocalDate => {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

export const resolveCalendarForCreate = (
  calendars: ReadonlyArray<CalendarInfo>,
  includeNames: ReadonlyArray<string>,
  calendarRef: string | undefined,
): { ok: true; calendar: CalendarInfo } | { ok: false; error: string } => {
  const allowed =
    includeNames.length === 0
      ? calendars
      : calendars.filter((cal) =>
          includeNames.some((name) => name.trim().toLowerCase() === cal.name.trim().toLowerCase()),
        );

  if (allowed.length === 0) {
    return { ok: false, error: "no writable calendars match calendar/RULES.md filter" };
  }

  if (calendarRef === undefined || calendarRef.trim().length === 0) {
    if (allowed.length === 1) return { ok: true, calendar: allowed[0]! };
    return {
      ok: false,
      error: `multiple calendars available; specify calendar (names: ${allowed.map((c) => c.name).join(", ")})`,
    };
  }

  const ref = calendarRef.trim();
  const refLower = ref.toLowerCase();
  const byId = allowed.find((cal) => cal.id === ref || String(cal.id) === ref);
  if (byId !== undefined) return { ok: true, calendar: byId };

  const byName = allowed.find((cal) => cal.name.trim().toLowerCase() === refLower);
  if (byName !== undefined) return { ok: true, calendar: byName };

  return {
    ok: false,
    error: `calendar not found or not allowed: ${ref} (use calendar_list_calendars)`,
  };
};

export const formatCreatedEvent = (event: CalendarEvent, timeZone: string): string => {
  const dayKey = isoDateKey(zonedDateParts(event.start, timeZone));
  return `Created event on ${dayKey} (${timeZone}):\n- ${formatEventLine(event, timeZone)}\nuid: ${event.uid}\ncalendar: ${event.calendarName}`;
};
