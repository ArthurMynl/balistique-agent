import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { CalendarError, CalendarEvent, CalendarId, CalendarInfo } from "../domain/calendar.js";
import type { IcalLocalDate, IcalLocalDateTime } from "../lib/ical-create.js";

export type ListEventsInRangeInput = {
  readonly start: Date;
  readonly end: Date;
};

export type ListEventsForDayInput = {
  readonly timeZone: string;
  readonly date?: Date | undefined;
};

export type CreateCalendarEventInput = {
  readonly calendarId: CalendarId;
  readonly summary: string;
  readonly timeZone: string;
  readonly allDay: boolean;
  readonly start: IcalLocalDateTime | IcalLocalDate;
  readonly end: IcalLocalDateTime | IcalLocalDate;
  readonly location?: string | undefined;
  readonly description?: string | undefined;
};

export type CalendarService = {
  readonly listCalendars: () => Effect.Effect<ReadonlyArray<CalendarInfo>, CalendarError>;
  readonly listEventsInRange: (
    input: ListEventsInRangeInput,
  ) => Effect.Effect<ReadonlyArray<CalendarEvent>, CalendarError>;
  readonly listEventsForDay: (
    input: ListEventsForDayInput,
  ) => Effect.Effect<ReadonlyArray<CalendarEvent>, CalendarError>;
  readonly createEvent: (
    input: CreateCalendarEventInput,
  ) => Effect.Effect<CalendarEvent, CalendarError>;
};

export class Calendar extends Context.Service<Calendar, CalendarService>()("@app/Calendar") {}
