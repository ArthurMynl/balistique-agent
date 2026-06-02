import { MailToolkit, MailToolkitHandlersLive } from "./mail/index.js";

/**
 * Merged agent toolkits. Add connectors with `Toolkit.merge(MailToolkit, CalendarToolkit, …)`.
 */
export const AgentToolkit = MailToolkit;

/** Handler layers for all tools in {@link AgentToolkit}. */
export const AgentToolkitHandlersLive = MailToolkitHandlersLive;
