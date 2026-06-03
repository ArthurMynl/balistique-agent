import * as Schema from "effect/Schema";

/** Resolved place for weather and forecasts (from today's calendar or default). */
export const ResolvedLocalization = Schema.Struct({
  label: Schema.String,
  timeZone: Schema.String,
  latitude: Schema.Number,
  longitude: Schema.Number,
  fromCalendarEvent: Schema.Boolean,
});

export type ResolvedLocalization = typeof ResolvedLocalization.Type;

export const DEFAULT_LOCALIZATION = {
  city: "Paris",
  country: "France",
  timeZone: "Europe/Paris",
  latitude: 48.8566,
  longitude: 2.3522,
  label: "Paris, France (default)",
} as const;
