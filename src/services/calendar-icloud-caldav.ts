import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { createDAVClient, type DAVCalendar } from "tsdav";
import { CalendarError, CalendarId, type CalendarInfo } from "../domain/calendar.js";
import {
  dayEventsFetchWindow,
  eventOccursOnDay,
  isoDateKey,
  zonedDateParts,
} from "../lib/calendar-context.js";
import { parseIcsCalendarEvents } from "../lib/ical-event.js";
import { buildVEventIcs, newEventUid } from "../lib/ical-create.js";
import {
  Calendar,
  type CreateCalendarEventInput,
  type ListEventsForDayInput,
  type ListEventsInRangeInput,
} from "./calendar.js";
import { IcloudCalendarConfig } from "./calendar-icloud-config.js";

const calendarIdFromUrl = (url: string): CalendarId =>
  CalendarId.make(
    (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })(),
  );

const displayNameToString = (displayName: DAVCalendar["displayName"]): string => {
  if (typeof displayName === "string") return displayName.trim();
  if (typeof displayName === "object" && displayName !== null && "_cdata" in displayName) {
    const cdata = (displayName as { _cdata?: unknown })._cdata;
    return typeof cdata === "string" ? cdata.trim() : "";
  }
  return "";
};

const wrapDavError = (reason: "ConnectionFailed" | "FetchFailed") => (cause: unknown) =>
  new CalendarError({
    reason,
    message: cause instanceof Error ? cause.message : String(cause),
  });

export const CalendarIcloudLive = Layer.effect(
  Calendar,
  Effect.gen(function* () {
    const config = yield* IcloudCalendarConfig;

    const withClient = <A>(
      use: (client: Awaited<ReturnType<typeof createDAVClient>>) => Promise<A>,
    ) =>
      Effect.tryPromise({
        try: async () => {
          const client = await createDAVClient({
            serverUrl: config.serverUrl,
            credentials: {
              username: config.username,
              password: Redacted.value(config.appPassword),
            },
            authMethod: "Basic",
            defaultAccountType: "caldav",
          });
          return use(client);
        },
        catch: (cause) => {
          if (cause instanceof CalendarError) return cause;
          return wrapDavError("ConnectionFailed")(cause);
        },
      });

    const listCalendars = Effect.fn("CalendarIcloud.listCalendars")(function* () {
      return yield* withClient(async (client) => {
        const calendars = await client.fetchCalendars();
        return calendars.map(
          (cal): CalendarInfo => ({
            id: calendarIdFromUrl(cal.url),
            name: displayNameToString(cal.displayName) || cal.url,
          }),
        );
      });
    });

    const listEventsInRange = Effect.fn("CalendarIcloud.listEventsInRange")(function* (
      input: ListEventsInRangeInput,
    ) {
      return yield* withClient(async (client) => {
        const calendars = await client.fetchCalendars();
        const events = [];

        for (const calendar of calendars) {
          const objects = await client.fetchCalendarObjects({
            calendar,
            timeRange: {
              start: input.start.toISOString(),
              end: input.end.toISOString(),
            },
            expand: true,
          });

          const calendarName = displayNameToString(calendar.displayName) || calendar.url;
          const calendarId = calendarIdFromUrl(calendar.url);

          for (const object of objects) {
            const data = object.data;
            if (typeof data !== "string" || data.trim().length === 0) continue;
            events.push(...parseIcsCalendarEvents(data, calendarId, calendarName));
          }
        }

        return events;
      });
    });

    const listEventsForDay = Effect.fn("CalendarIcloud.listEventsForDay")(function* (
      input: ListEventsForDayInput,
    ) {
      const ref = input.date ?? new Date();
      const dayKey = isoDateKey(zonedDateParts(ref, input.timeZone));
      const { start: windowStart, end: windowEnd } = dayEventsFetchWindow(dayKey);
      const inWindow = yield* listEventsInRange({ start: windowStart, end: windowEnd });
      return inWindow.filter((event) => eventOccursOnDay(event, dayKey, input.timeZone));
    });

    const createEvent = Effect.fn("CalendarIcloud.createEvent")(function* (
      input: CreateCalendarEventInput,
    ) {
      const uid = newEventUid();
      const ics = buildVEventIcs({
        uid,
        summary: input.summary,
        timeZone: input.timeZone,
        allDay: input.allDay,
        start: input.start,
        end: input.end,
        location: input.location,
        description: input.description,
      });

      return yield* withClient(async (client) => {
        const calendars = await client.fetchCalendars();
        const calendar = calendars.find((cal) => calendarIdFromUrl(cal.url) === input.calendarId);
        if (calendar === undefined) {
          throw new CalendarError({
            reason: "CreateFailed",
            message: `calendar not found: ${String(input.calendarId)}`,
          });
        }

        const calendarName = displayNameToString(calendar.displayName) || calendar.url;
        const response = await client.createCalendarObject({
          calendar,
          filename: `${uid}.ics`,
          iCalString: ics,
        });

        if (!response.ok) {
          const detail = `${response.status} ${response.statusText}`.trim();
          throw new CalendarError({
            reason: "CreateFailed",
            message: `CalDAV create failed (${detail})`,
          });
        }

        const parsed = parseIcsCalendarEvents(ics, input.calendarId, calendarName);
        const created = parsed.find((event) => event.uid === uid);
        if (created === undefined) {
          throw new CalendarError({
            reason: "CreateFailed",
            message: "created event could not be parsed from ICS",
          });
        }
        return created;
      });
    });

    return {
      listCalendars,
      listEventsInRange,
      listEventsForDay,
      createEvent,
    };
  }),
);
