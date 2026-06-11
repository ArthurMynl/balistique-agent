import * as Schema from "effect/Schema";
import { Tool } from "effect/unstable/ai";

export const CalendarListCalendarsTool = Tool.make("calendar_list_calendars", {
  description: "Liste les calendriers iCloud via CalDAV (identifiant et nom affiché).",
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const CalendarListEventsTool = Tool.make("calendar_list_events", {
  description:
    "Liste les événements d'un jour (fuseau configuré). Sans date = aujourd'hui. Pour plusieurs jours, utilise calendar_query_events.",
  parameters: Schema.Struct({
    date: Schema.optionalKey(Schema.String),
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const CalendarQueryEventsTool = Tool.make("calendar_query_events", {
  description:
    "Interroge les événements iCloud entre deux dates incluses (fuseau configuré). Pour aujourd'hui, demain, la semaine ou une plage AAAA-MM-JJ (max 31 jours).",
  parameters: Schema.Struct({
    start: Schema.String,
    end: Schema.optionalKey(Schema.String),
  }),
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);

export const CalendarCreateEventTool = Tool.make("calendar_create_event", {
  description:
    "Crée un événement sur un calendrier iCloud. Fuseau selon calendar/RULES.md. AAAA-MM-JJ pour toute la journée, AAAA-MM-JJTHH:mm pour horaire. Appelle calendar_list_calendars si le calendrier est incertain.",
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
