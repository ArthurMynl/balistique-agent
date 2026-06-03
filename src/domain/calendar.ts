import * as Schema from "effect/Schema";

export const CalendarAccountId = Schema.Literals(["icloud"]);
export type CalendarAccountId = typeof CalendarAccountId.Type;

export const CalendarId = Schema.String.pipe(Schema.brand("CalendarId"));
export type CalendarId = typeof CalendarId.Type;

export const CalendarEvent = Schema.Struct({
  uid: Schema.String,
  calendarId: Schema.String,
  calendarName: Schema.String,
  summary: Schema.String,
  start: Schema.Date,
  end: Schema.optional(Schema.Date),
  allDay: Schema.Boolean,
  location: Schema.optional(Schema.String),
});

export type CalendarEvent = typeof CalendarEvent.Type;

export const CalendarInfo = Schema.Struct({
  id: CalendarId,
  name: Schema.String,
});

export type CalendarInfo = typeof CalendarInfo.Type;

export class CalendarError extends Schema.TaggedErrorClass<CalendarError>()("CalendarError", {
  reason: Schema.Literals([
    "InvalidConfig",
    "ConnectionFailed",
    "FetchFailed",
    "ParseFailed",
    "CreateFailed",
  ]),
  message: Schema.String,
}) {}

export class CalendarBriefStoreError extends Schema.TaggedErrorClass<CalendarBriefStoreError>()(
  "CalendarBriefStoreError",
  {
    reason: Schema.Literals(["ReadFailed", "WriteFailed", "DecodeFailed"]),
    message: Schema.String,
  },
) {}

export const CalendarBriefSentFile = Schema.Struct({
  version: Schema.Literal(1),
  /** ISO date keys (YYYY-MM-DD in configured timezone) already briefed. */
  sentDates: Schema.Array(Schema.String),
});

export type CalendarBriefSentFile = typeof CalendarBriefSentFile.Type;

export const IcloudCalDavDefaults = {
  host: "https://caldav.icloud.com/",
} as const;
