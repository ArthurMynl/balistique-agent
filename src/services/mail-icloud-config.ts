import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { IcloudImapDefaults, MailError } from "../domain/mail.js";

export class IcloudMailConfig extends Context.Service<IcloudMailConfig>()("@app/IcloudMailConfig", {
  make: Effect.gen(function* () {
    const login = yield* Config.string("ICLOUD_IMAP_LOGIN");
    const appPassword = yield* Config.redacted("ICLOUD_APP_PASSWORD");
    const email = yield* Config.string("ICLOUD_EMAIL").pipe(Config.option);
    const folder = yield* Config.string("ICLOUD_IMAP_FOLDER").pipe(
      Config.withDefault(IcloudImapDefaults.folder),
    );
    const host = yield* Config.string("ICLOUD_IMAP_HOST").pipe(
      Config.withDefault(IcloudImapDefaults.host),
    );

    const loginTrimmed = login.trim();
    if (loginTrimmed.length === 0) {
      return yield* new MailError({
        reason: "InvalidConfig",
        message:
          "ICLOUD_IMAP_LOGIN is required (short iCloud Mail name, not the full @icloud.com address)",
      });
    }

    const password = Redacted.value(appPassword).trim();
    if (password.length === 0) {
      return yield* new MailError({
        reason: "InvalidConfig",
        message:
          "ICLOUD_APP_PASSWORD is required (generate an app-specific password at https://account.apple.com)",
      });
    }

    return {
      login: loginTrimmed,
      appPassword,
      email: email._tag === "Some" ? email.value.trim() : undefined,
      folder: folder.trim().length > 0 ? folder.trim() : IcloudImapDefaults.folder,
      host: host.trim().length > 0 ? host.trim() : IcloudImapDefaults.host,
      port: IcloudImapDefaults.port,
    } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
