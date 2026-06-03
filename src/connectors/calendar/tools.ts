import * as Schema from "effect/Schema";
import { Tool } from "effect/unstable/ai";

export const CalendarListCalendarsTool = Tool.make("calendar_list_calendars", {
  description: "List iCloud calendars available via CalDAV (id and display name).",
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const CalendarListEventsTool = Tool.make("calendar_list_events", {
  description:
    "List calendar events for one day (configured timezone). Omit date for today. For multiple days use calendar_query_events.",
  parameters: Schema.Struct({
    date: Schema.optionalKey(Schema.String),
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const CalendarQueryEventsTool = Tool.make("calendar_query_events", {
  description:
    "Query iCloud calendar events between two dates (inclusive, configured timezone). Use for today, tomorrow, this week, or any YYYY-MM-DD range (max 31 days).",
  parameters: Schema.Struct({
    start: Schema.String,
    end: Schema.optionalKey(Schema.String),
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const CalendarCreateEventTool = Tool.make("calendar_create_event", {
  description:
    "Create a new event on an iCloud calendar. Times use the agent host's current timezone. Use YYYY-MM-DD for all-day, or YYYY-MM-DDTHH:mm for timed events. Call calendar_list_calendars first if unsure which calendar to use.",
  parameters: Schema.Struct({
    summary: Schema.String,
    start: Schema.String,
    end: Schema.optionalKey(Schema.String),
    allDay: Schema.optionalKey(Schema.Boolean),
    calendar: Schema.optionalKey(Schema.String),
    location: Schema.optionalKey(Schema.String),
    description: Schema.optionalKey(Schema.String),
  }),
  success: Schema.String,
  failure: Schema.String,
});
