import { Toolkit } from "effect/unstable/ai";
import {
  CalendarListCalendarsTool,
  CalendarListEventsTool,
  CalendarQueryEventsTool,
  CalendarCreateEventTool,
} from "./tools.js";

export const CalendarToolkit = Toolkit.make(
  CalendarListCalendarsTool,
  CalendarListEventsTool,
  CalendarQueryEventsTool,
  CalendarCreateEventTool,
);
