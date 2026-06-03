import type { CalendarEvent } from "../domain/calendar.js";
import { DEFAULT_LOCALIZATION } from "../domain/calendar-localization.js";

export type CalendarLocalizationRules = {
  readonly defaultCity: string;
  readonly defaultCountry: string;
  readonly defaultTimeZone: string;
  readonly localizationTitles: ReadonlyArray<string>;
};

export const defaultCalendarLocalizationRules = (): CalendarLocalizationRules => ({
  defaultCity: DEFAULT_LOCALIZATION.city,
  defaultCountry: DEFAULT_LOCALIZATION.country,
  defaultTimeZone: DEFAULT_LOCALIZATION.timeZone,
  localizationTitles: ["Localization", "Location", "Vacances", "Vacation", "Voyage"],
});

const normalize = (value: string): string => value.trim().toLowerCase();

const summaryMatchesTitle = (summary: string, titles: ReadonlyArray<string>): boolean => {
  const normalized = normalize(summary);
  return titles.some((title) => normalize(title) === normalized);
};

/** Calendar marker for where you are today (incl. multi-day vacation with a place). */
export const isLocalizationEvent = (
  event: CalendarEvent,
  rules: CalendarLocalizationRules,
): boolean => {
  const summary = event.summary.trim();
  if (summary.length === 0) return false;

  const hasLocation = (event.location?.trim() ?? "").length > 0;

  if (summary.startsWith("📍")) return true;
  if (/^location\s*:/i.test(summary)) return true;

  if (!summaryMatchesTitle(summary, rules.localizationTitles)) return false;

  if (hasLocation) return true;
  return event.allDay;
};

export type PlaceQuery = {
  readonly city: string;
  readonly country: string;
  /** Cleaned place name for geocoding when the raw calendar LOCATION has extra detail. */
  readonly geocodeQuery?: string | undefined;
};

/** City/region string from the localization event summary or LOCATION field. */
export const placeQueryFromLocalizationEvent = (
  event: CalendarEvent,
  rules: CalendarLocalizationRules,
): PlaceQuery | undefined => {
  const locationField = event.location?.trim() ?? "";
  if (locationField.length > 0) {
    const parsed = parsePlaceString(locationField);
    return { ...parsed, geocodeQuery: parsed.city };
  }

  let summary = event.summary.trim();
  if (summary.startsWith("📍")) {
    summary = summary.slice("📍".length).trim();
  }
  summary = summary.replace(/^location\s*:\s*/i, "").trim();

  if (summary.length === 0) return undefined;
  if (summaryMatchesTitle(summary, rules.localizationTitles)) return undefined;

  return parsePlaceString(summary);
};

const parsePlaceString = (raw: string): PlaceQuery => {
  const parts = raw
    .split(/[,\n\r]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { city: "", country: "" };
  }
  if (parts.length >= 3) {
    return { city: parts[0]!, country: parts[parts.length - 1]! };
  }
  if (parts.length === 2) {
    return { city: parts[0]!, country: parts[1]! };
  }
  return { city: parts[0]!, country: "" };
};

export const findLocalizationEvent = (
  events: ReadonlyArray<CalendarEvent>,
  rules: CalendarLocalizationRules,
): CalendarEvent | undefined => {
  const markers = events.filter((event) => isLocalizationEvent(event, rules));
  if (markers.length === 0) return undefined;
  const withLocation = markers.find((event) => (event.location?.trim() ?? "").length > 0);
  return withLocation ?? markers[0];
};

export const defaultPlaceQuery = (rules: CalendarLocalizationRules): PlaceQuery => ({
  city: rules.defaultCity,
  country: rules.defaultCountry,
});

export const excludeLocalizationEvents = (
  events: ReadonlyArray<CalendarEvent>,
  rules: CalendarLocalizationRules,
): ReadonlyArray<CalendarEvent> => events.filter((event) => !isLocalizationEvent(event, rules));
