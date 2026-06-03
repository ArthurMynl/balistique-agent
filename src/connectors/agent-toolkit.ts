import * as Layer from "effect/Layer";
import { Toolkit } from "effect/unstable/ai";
import { CalendarToolkitHandlersLive } from "./calendar/index.js";
import {
  CalendarCreateEventTool,
  CalendarListCalendarsTool,
  CalendarListEventsTool,
  CalendarQueryEventsTool,
} from "./calendar/tools.js";
import { MailToolkitHandlersLive } from "./mail/index.js";
import { MailListEnvelopesTool, MailListFoldersTool, MailReadMessageTool } from "./mail/tools.js";
import { WeatherToolkitHandlersLive } from "./weather/index.js";
import { WeatherTodayTool } from "./weather/tools.js";

/**
 * Merged agent toolkits. Register connector tools in {@link AgentToolkit} and handler layers below.
 */
export const AgentToolkit = Toolkit.make(
  MailListFoldersTool,
  MailListEnvelopesTool,
  MailReadMessageTool,
  CalendarListCalendarsTool,
  CalendarListEventsTool,
  CalendarQueryEventsTool,
  CalendarCreateEventTool,
  WeatherTodayTool,
);

/** Handler layers for all tools in {@link AgentToolkit}. */
export const AgentToolkitHandlersLive = Layer.mergeAll(
  MailToolkitHandlersLive,
  CalendarToolkitHandlersLive,
  WeatherToolkitHandlersLive,
);
