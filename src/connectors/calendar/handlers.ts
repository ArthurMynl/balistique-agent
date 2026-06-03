import * as Effect from "effect/Effect";
import {
  addMinutesToLocalDateTime,
  caldavFetchWindow,
  filterEventsByCalendarNames,
  filterEventsInIsoDateRange,
  formatCalendarList,
  formatCreatedEvent,
  formatEventList,
  formatEventQueryResult,
  isoDateKey,
  nextLocalDate,
  parseEventDateTime,
  parseIsoDateKey,
  daysBetweenIsoDateKeys,
  resolveCalendarForCreate,
  systemTimeZone,
  zonedDateParts,
} from "../../lib/calendar-context.js";
import type { IcalLocalDate, IcalLocalDateTime } from "../../lib/ical-create.js";
import { Calendar } from "../../services/calendar.js";
import { CalendarRulesConfig } from "../../services/calendar-rules-config.js";
import { CalendarToolkit } from "./toolkit.js";

const maxQueryRangeDays = 31;

const todayKey = (timeZone: string): string => isoDateKey(zonedDateParts(new Date(), timeZone));

const parseDay = (
  value: string | undefined,
  timeZone: string,
  label: string,
): Effect.Effect<string, string> => {
  if (value === undefined || value.trim().length === 0) {
    return Effect.succeed(todayKey(timeZone));
  }
  const key = parseIsoDateKey(value, timeZone);
  if (key === undefined) {
    return Effect.fail(`invalid ${label} (use YYYY-MM-DD): ${value}`);
  }
  return Effect.succeed(key);
};

export const CalendarToolkitHandlersLive = CalendarToolkit.toLayer(
  Effect.gen(function* () {
    const calendar = yield* Calendar;
    const rules = yield* CalendarRulesConfig;

    return {
      calendar_list_calendars: () =>
        calendar.listCalendars().pipe(
          Effect.map((calendars) => formatCalendarList(calendars)),
          Effect.mapError((error) => error.message),
        ),

      calendar_list_events: (params: { date?: string | undefined }) =>
        parseDay(params.date, rules.timezone, "date").pipe(
          Effect.flatMap((startKey) =>
            calendar
              .listEventsForDay({
                timeZone: rules.timezone,
                date: new Date(`${startKey}T12:00:00Z`),
              })
              .pipe(
                Effect.map((events) => {
                  const filtered = filterEventsByCalendarNames(events, rules.includeCalendarNames);
                  return formatEventList(`Events on ${startKey}`, filtered);
                }),
                Effect.mapError((error) => error.message),
              ),
          ),
        ),

      calendar_query_events: (params: { start: string; end?: string | undefined }) =>
        Effect.gen(function* () {
          const startKey = yield* parseDay(params.start, rules.timezone, "start");
          const endKey = yield* parseDay(params.end ?? params.start, rules.timezone, "end");

          if (endKey < startKey) {
            return yield* Effect.fail(`end date must be on or after start (${startKey})`);
          }

          const spanDays = daysBetweenIsoDateKeys(startKey, endKey);
          if (spanDays > maxQueryRangeDays) {
            return yield* Effect.fail(
              `date range is ${spanDays} days; maximum is ${maxQueryRangeDays}`,
            );
          }

          const window = caldavFetchWindow(startKey, endKey);
          const events = yield* calendar
            .listEventsInRange(window)
            .pipe(Effect.mapError((error) => error.message));

          const inRange = filterEventsInIsoDateRange(events, startKey, endKey, rules.timezone);
          const filtered = filterEventsByCalendarNames(inRange, rules.includeCalendarNames);
          return formatEventQueryResult(startKey, endKey, filtered, rules.timezone);
        }),

      calendar_create_event: (params: {
        summary: string;
        start: string;
        end?: string | undefined;
        allDay?: boolean | undefined;
        calendar?: string | undefined;
        location?: string | undefined;
        description?: string | undefined;
      }) =>
        Effect.gen(function* () {
          const timeZone = systemTimeZone();
          const summary = params.summary.trim();
          if (summary.length === 0) {
            return yield* Effect.fail("summary is required");
          }

          const startParsed = parseEventDateTime(params.start, timeZone, "start");
          if (!startParsed.ok) return yield* Effect.fail(startParsed.error);

          const allDay = params.allDay ?? startParsed.value.allDay;
          if (params.allDay === false && startParsed.value.allDay) {
            return yield* Effect.fail("start is date-only but allDay=false");
          }
          if (params.allDay === true && !startParsed.value.allDay) {
            return yield* Effect.fail("start includes a time but allDay=true");
          }
          if (allDay !== startParsed.value.allDay) {
            return yield* Effect.fail("start format does not match allDay flag");
          }

          let start: IcalLocalDate | IcalLocalDateTime;
          let endLocal: IcalLocalDate | IcalLocalDateTime;

          if (allDay) {
            if (!startParsed.value.allDay) {
              return yield* Effect.fail("start must be date-only for all-day events");
            }
            start = startParsed.value.date;

            if (params.end !== undefined && params.end.trim().length > 0) {
              const endParsed = parseEventDateTime(params.end, timeZone, "end");
              if (!endParsed.ok) return yield* Effect.fail(endParsed.error);
              if (!endParsed.value.allDay) {
                return yield* Effect.fail("end must be date-only for all-day events");
              }
              endLocal = endParsed.value.date;
            } else {
              endLocal = startParsed.value.date;
            }

            const startKey = isoDateKey(start);
            const endKey = isoDateKey(endLocal as IcalLocalDate);
            if (endKey < startKey) {
              return yield* Effect.fail("end date must be on or after start date");
            }
          } else {
            if (startParsed.value.allDay) {
              return yield* Effect.fail("start must include a time for timed events");
            }
            start = startParsed.value.dateTime;

            if (params.end !== undefined && params.end.trim().length > 0) {
              const endParsed = parseEventDateTime(params.end, timeZone, "end");
              if (!endParsed.ok) return yield* Effect.fail(endParsed.error);
              if (endParsed.value.allDay) {
                return yield* Effect.fail("end must include a time for timed events");
              }
              endLocal = endParsed.value.dateTime;
            } else {
              endLocal = addMinutesToLocalDateTime(startParsed.value.dateTime, 60);
            }

            const startDt = start as IcalLocalDateTime;
            const endDt = endLocal as IcalLocalDateTime;
            const startMs = Date.UTC(
              startDt.year,
              startDt.month - 1,
              startDt.day,
              startDt.hour,
              startDt.minute,
            );
            const endMs = Date.UTC(
              endDt.year,
              endDt.month - 1,
              endDt.day,
              endDt.hour,
              endDt.minute,
            );
            if (endMs <= startMs) {
              return yield* Effect.fail("end time must be after start time");
            }
          }

          const calendars = yield* calendar
            .listCalendars()
            .pipe(Effect.mapError((error) => error.message));
          const target = resolveCalendarForCreate(
            calendars,
            rules.includeCalendarNames,
            params.calendar,
          );
          if (!target.ok) return yield* Effect.fail(target.error);

          const icalEnd = allDay ? nextLocalDate(endLocal as IcalLocalDate) : endLocal;

          const created = yield* calendar
            .createEvent({
              calendarId: target.calendar.id,
              summary,
              timeZone,
              allDay,
              start,
              end: icalEnd,
              location: params.location,
              description: params.description,
            })
            .pipe(Effect.mapError((error) => error.message));

          return formatCreatedEvent(created, timeZone);
        }),
    };
  }),
);
