import { parseICS, type CalendarResponse, type VEvent } from "node-ical";
import type { CalendarEvent } from "../domain/calendar.js";

const parameterValueToString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "val" in value) {
    const inner = (value as { val: unknown }).val;
    return typeof inner === "string" ? inner.trim() : String(inner).trim();
  }
  return String(value ?? "").trim();
};

const toJsDate = (value: unknown): Date | undefined => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "object" && value !== null && "toJSDate" in value) {
    const js = (value as { toJSDate: () => Date }).toJSDate();
    if (js instanceof Date && !Number.isNaN(js.getTime())) return js;
  }
  return undefined;
};

const isAllDayEvent = (event: VEvent): boolean => event.datetype === "date";

const structuredLocationTitle = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const parameters = (value as { params?: unknown }).params;
  if (typeof parameters !== "object" || parameters === null) return undefined;

  for (const [key, paramValue] of Object.entries(parameters)) {
    if (key.toLowerCase() !== "x-title") continue;
    const title = parameterValueToString(paramValue);
    if (title.length > 0) return title;
  }

  return undefined;
};

const locationFromVEvent = (event: VEvent): string | undefined => {
  const direct = parameterValueToString(event.location);
  if (direct.length > 0) return direct;

  for (const [key, value] of Object.entries(event)) {
    const normalized = key.toLowerCase();
    if (!normalized.includes("location")) continue;

    const title = structuredLocationTitle(value);
    if (title !== undefined) return title;

    const candidate = parameterValueToString(value);
    if (candidate.length > 0 && !candidate.toLowerCase().startsWith("geo:")) return candidate;
  }

  return undefined;
};

export const veventToCalendarEvent = (
  event: VEvent,
  calendarId: string,
  calendarName: string,
): CalendarEvent | undefined => {
  const uid = event.uid?.trim();
  const start = toJsDate(event.start);
  if (!uid || uid.length === 0 || start === undefined) return undefined;

  const summary = parameterValueToString(event.summary);
  const end = toJsDate(event.end);
  const location = locationFromVEvent(event);

  return {
    uid,
    calendarId,
    calendarName,
    summary: summary.length > 0 ? summary : "(no title)",
    start,
    end,
    allDay: isAllDayEvent(event),
    location,
  };
};

export const parseIcsCalendarEvents = (
  ics: string,
  calendarId: string,
  calendarName: string,
): ReadonlyArray<CalendarEvent> => {
  const parsed: CalendarResponse = parseICS(ics);
  const events: Array<CalendarEvent> = [];

  for (const value of Object.values(parsed)) {
    if (value === undefined || value.type !== "VEVENT") continue;
    const mapped = veventToCalendarEvent(value, calendarId, calendarName);
    if (mapped !== undefined) events.push(mapped);
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return events;
};
