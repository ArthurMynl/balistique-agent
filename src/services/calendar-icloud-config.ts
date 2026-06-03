import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { CalendarError, IcloudCalDavDefaults } from "../domain/calendar.js";

const resolveCalDavUsername = (login: string, email: string | undefined): string => {
  const loginTrimmed = login.trim();
  if (loginTrimmed.includes("@")) return loginTrimmed;
  const emailTrimmed = email?.trim();
  if (emailTrimmed !== undefined && emailTrimmed.length > 0) return emailTrimmed;
  return `${loginTrimmed}@icloud.com`;
};

export class IcloudCalendarConfig extends Context.Service<IcloudCalendarConfig>()(
  "@app/IcloudCalendarConfig",
  {
    make: Effect.gen(function* () {
      const login = yield* Config.string("ICLOUD_IMAP_LOGIN");
      const appPassword = yield* Config.redacted("ICLOUD_APP_PASSWORD");
      const email = yield* Config.string("ICLOUD_EMAIL").pipe(Config.option);
      const caldavLogin = yield* Config.string("ICLOUD_CALDAV_LOGIN").pipe(Config.option);
      const serverUrl = yield* Config.string("ICLOUD_CALDAV_URL").pipe(
        Config.withDefault(IcloudCalDavDefaults.host),
      );

      const loginTrimmed = login.trim();
      if (loginTrimmed.length === 0) {
        return yield* new CalendarError({
          reason: "InvalidConfig",
          message:
            "ICLOUD_IMAP_LOGIN is required for iCloud CalDAV (short name or full Apple ID email)",
        });
      }

      const password = Redacted.value(appPassword).trim();
      if (password.length === 0) {
        return yield* new CalendarError({
          reason: "InvalidConfig",
          message: "ICLOUD_APP_PASSWORD is required (same app-specific password as iCloud Mail)",
        });
      }

      const username =
        caldavLogin._tag === "Some" && caldavLogin.value.trim().length > 0
          ? caldavLogin.value.trim()
          : resolveCalDavUsername(loginTrimmed, email._tag === "Some" ? email.value : undefined);

      const url = serverUrl.trim().length > 0 ? serverUrl.trim() : IcloudCalDavDefaults.host;

      return {
        username,
        appPassword,
        serverUrl: url.endsWith("/") ? url : `${url}/`,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
