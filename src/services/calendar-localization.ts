import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import {
  DEFAULT_LOCALIZATION,
  type ResolvedLocalization,
} from "../domain/calendar-localization.js";
import type { CalendarError } from "../domain/calendar.js";
import { WeatherError } from "../domain/weather.js";
import {
  defaultPlaceQuery,
  findLocalizationEvent,
  placeQueryFromLocalizationEvent,
  type PlaceQuery,
} from "../lib/calendar-localization.js";
import { isoDateKey, zonedDateParts } from "../lib/calendar-context.js";
import { Calendar } from "./calendar.js";
import { CalendarRulesConfig } from "./calendar-rules-config.js";

const GeocodeResponse = Schema.Struct({
  results: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        country: Schema.optional(Schema.String),
        latitude: Schema.Number,
        longitude: Schema.Number,
        timezone: Schema.optional(Schema.String),
      }),
    ),
  ),
});

export type ResolveLocalizationInput = {
  readonly date?: Date | undefined;
};

export type CalendarLocalizationService = {
  readonly resolveForDay: (
    input: ResolveLocalizationInput,
  ) => Effect.Effect<ResolvedLocalization, WeatherError | CalendarError>;
};

export class CalendarLocalization extends Context.Service<
  CalendarLocalization,
  CalendarLocalizationService
>()("@app/CalendarLocalization") {}

export const CalendarLocalizationLive = Layer.effect(
  CalendarLocalization,
  Effect.gen(function* () {
    const calendar = yield* Calendar;
    const rules = yield* CalendarRulesConfig;
    const http = yield* HttpClient.HttpClient;

    const geocodePlace = Effect.fn("CalendarLocalization.geocodePlace")(function* (
      place: PlaceQuery,
      fallbackTimeZone: string,
    ) {
      const query = new URLSearchParams({
        count: "1",
        language: "en",
        format: "json",
      });
      const full = place.geocodeQuery?.trim() ?? "";
      if (full.length > 0) {
        query.set("name", full);
      } else {
        query.set("name", place.city.trim());
        if (place.country.trim().length > 0) {
          query.set("country", place.country.trim());
        }
      }

      const request = HttpClientRequest.get(
        `https://geocoding-api.open-meteo.com/v1/search?${query.toString()}`,
      );

      const response = yield* http.execute(request).pipe(
        Effect.mapError(
          (error) =>
            new WeatherError({
              reason: "GeocodeFailed",
              message: error instanceof Error ? error.message : String(error),
            }),
        ),
      );

      const body = yield* HttpClientResponse.schemaBodyJson(GeocodeResponse)(response).pipe(
        Effect.mapError(
          () =>
            new WeatherError({ reason: "GeocodeFailed", message: "Geocoding response invalid" }),
        ),
      );

      const hit = body.results?.[0];
      if (hit === undefined) {
        return yield* new WeatherError({
          reason: "GeocodeFailed",
          message: `No geocoding result for "${full.length > 0 ? full : place.city}"`,
        });
      }

      const label =
        hit.country !== undefined && hit.country.length > 0
          ? `${hit.name}, ${hit.country}`
          : hit.name;

      return {
        label,
        timeZone: hit.timezone?.trim() || fallbackTimeZone,
        latitude: hit.latitude,
        longitude: hit.longitude,
      };
    });

    const resolveDefault = (): ResolvedLocalization => ({
      label: DEFAULT_LOCALIZATION.label,
      timeZone: rules.localization.defaultTimeZone,
      latitude: DEFAULT_LOCALIZATION.latitude,
      longitude: DEFAULT_LOCALIZATION.longitude,
      fromCalendarEvent: false,
    });

    const resolveForDay = Effect.fn("CalendarLocalization.resolveForDay")(function* (
      input: ResolveLocalizationInput,
    ) {
      const scheduleTimeZone = rules.timezone;
      const ref = input.date ?? new Date();
      const events = yield* calendar.listEventsForDay({
        timeZone: scheduleTimeZone,
        date: ref,
      });

      const dayKey = isoDateKey(zonedDateParts(ref, scheduleTimeZone));
      const marker = findLocalizationEvent(events, rules.localization);
      if (marker === undefined) {
        yield* Effect.log(
          `[localization] no event on ${dayKey} (${events.length} events that day) — default ${rules.localization.defaultCity}`,
        );
        return resolveDefault();
      }

      const place = placeQueryFromLocalizationEvent(marker, rules.localization);
      if (place === undefined || place.city.length === 0) {
        return yield* new WeatherError({
          reason: "InvalidConfig",
          message:
            "Localization calendar event needs a place in the title (e.g. 📍 Lyon) or in the LOCATION field",
        });
      }

      const defaultPlace = defaultPlaceQuery(rules.localization);
      const sameAsDefault =
        place.city.trim().toLowerCase() === defaultPlace.city.trim().toLowerCase() &&
        (place.country.length === 0 ||
          place.country.trim().toLowerCase() === defaultPlace.country.trim().toLowerCase());

      if (sameAsDefault) {
        return {
          label: `${defaultPlace.city}, ${defaultPlace.country}`.replace(/,\s*$/, ""),
          timeZone: rules.localization.defaultTimeZone,
          latitude: DEFAULT_LOCALIZATION.latitude,
          longitude: DEFAULT_LOCALIZATION.longitude,
          fromCalendarEvent: true,
        } satisfies ResolvedLocalization;
      }

      const geocoded = yield* geocodePlace(place, rules.localization.defaultTimeZone);

      yield* Effect.log(
        `[localization] ${dayKey}: "${marker.summary}" → ${geocoded.label} (${geocoded.timeZone})`,
      );

      return {
        label: geocoded.label,
        timeZone: geocoded.timeZone,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        fromCalendarEvent: true,
      } satisfies ResolvedLocalization;
    });

    return { resolveForDay } as const;
  }),
);
