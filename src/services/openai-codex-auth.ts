import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import {
  OpenAiCodexAuthError,
  OpenAiCodexAuthStore,
  type OpenAiCodexCredentials,
  OpenAiCodexOAuth,
} from "../domain/openai-codex.js";
import { generatePkceChallenge, randomState } from "../lib/pkce.js";

const JwtClaimPath = "https://api.openai.com/auth";

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(atob(parts[1]!)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const accountIdFromAccessToken = (access: string): string | null => {
  const payload = decodeJwtPayload(access);
  const auth = payload?.[JwtClaimPath];
  if (!auth || typeof auth !== "object" || auth === null) return null;
  const accountId = (auth as Record<string, unknown>).chatgpt_account_id;
  return typeof accountId === "string" && accountId.length > 0 ? accountId : null;
};

const emailFromAccessToken = (access: string): string | undefined => {
  const payload = decodeJwtPayload(access);
  const profile = payload?.["https://api.openai.com/profile"];
  if (!profile || typeof profile !== "object" || profile === null) return undefined;
  const email = (profile as Record<string, unknown>).email;
  return typeof email === "string" ? email : undefined;
};

const parseAuthorizationInput = (input: string): { code?: string; state?: string } => {
  const value = input.trim();
  if (value.length === 0) return {};

  try {
    const url = new URL(value);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    return {
      ...(code ? { code } : {}),
      ...(state ? { state } : {}),
    };
  } catch {
    // not a URL
  }

  if (value.includes("#")) {
    const [code, state] = value.split("#", 2);
    return {
      ...(code ? { code } : {}),
      ...(state ? { state } : {}),
    };
  }

  if (value.includes("code=")) {
    const params = new URLSearchParams(value);
    const code = params.get("code");
    const state = params.get("state");
    return {
      ...(code ? { code } : {}),
      ...(state ? { state } : {}),
    };
  }

  return { code: value };
};

const OpenClawAuthProfile = Schema.Struct({
  type: Schema.optional(Schema.String),
  provider: Schema.optional(Schema.String),
  access: Schema.optional(Schema.String),
  refresh: Schema.optional(Schema.String),
  expires: Schema.optional(Schema.Number),
  accountId: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
});

const OpenClawAuthProfiles = Schema.Struct({
  version: Schema.optional(Schema.Number),
  profiles: Schema.Record(Schema.String, OpenClawAuthProfile),
});

const toCredentials = (input: {
  readonly access: string;
  readonly refresh: string;
  readonly expires: number;
  readonly accountId?: string | undefined;
  readonly email?: string | undefined;
}): Effect.Effect<OpenAiCodexCredentials, OpenAiCodexAuthError> =>
  Effect.gen(function* () {
    const accountId = input.accountId ?? accountIdFromAccessToken(input.access);
    if (!accountId) {
      return yield* new OpenAiCodexAuthError({
        reason: "InvalidAuthFile",
        message: "Failed to extract ChatGPT account id from access token",
      });
    }

    return {
      access: input.access,
      refresh: input.refresh,
      expires: input.expires,
      accountId,
      email: input.email ?? emailFromAccessToken(input.access),
    };
  });

const exchangeAuthorizationCode = Effect.fn("OpenAiCodexAuth.exchangeAuthorizationCode")(function* (
  code: string,
  verifier: string,
) {
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(OpenAiCodexOAuth.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: OpenAiCodexOAuth.clientId,
          code,
          code_verifier: verifier,
          redirect_uri: OpenAiCodexOAuth.redirectUri,
        }),
      }),
    catch: (cause) =>
      new OpenAiCodexAuthError({
        reason: "LoginFailed",
        message: `Token exchange request failed: ${String(cause)}`,
      }),
  });

  if (!response.ok) {
    const text = yield* Effect.tryPromise(() => response.text()).pipe(
      Effect.orElseSucceed(() => ""),
    );
    return yield* new OpenAiCodexAuthError({
      reason: "LoginFailed",
      message: `OpenAI token exchange failed (${response.status}): ${text || response.statusText}`,
    });
  }

  const json = (yield* Effect.tryPromise(() => response.json())) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
    return yield* new OpenAiCodexAuthError({
      reason: "LoginFailed",
      message: "OpenAI token exchange response missing fields",
    });
  }

  return yield* toCredentials({
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
  });
});

const refreshAccessToken = Effect.fn("OpenAiCodexAuth.refreshAccessToken")(function* (
  refresh: string,
) {
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(OpenAiCodexOAuth.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refresh,
          client_id: OpenAiCodexOAuth.clientId,
        }),
      }),
    catch: (cause) =>
      new OpenAiCodexAuthError({
        reason: "TokenRefreshFailed",
        message: `Token refresh request failed: ${String(cause)}`,
      }),
  });

  if (!response.ok) {
    const text = yield* Effect.tryPromise(() => response.text()).pipe(
      Effect.orElseSucceed(() => ""),
    );
    return yield* new OpenAiCodexAuthError({
      reason: "TokenRefreshFailed",
      message: `OpenAI token refresh failed (${response.status}): ${text || response.statusText}`,
    });
  }

  const json = (yield* Effect.tryPromise(() => response.json())) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
    return yield* new OpenAiCodexAuthError({
      reason: "TokenRefreshFailed",
      message: "OpenAI token refresh response missing fields",
    });
  }

  return yield* toCredentials({
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
  });
});

const buildAuthorizeUrl = (params: {
  readonly challenge: string;
  readonly state: string;
  readonly originator?: string | undefined;
}): string => {
  const url = new URL(OpenAiCodexOAuth.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", OpenAiCodexOAuth.clientId);
  url.searchParams.set("redirect_uri", OpenAiCodexOAuth.redirectUri);
  url.searchParams.set("scope", OpenAiCodexOAuth.scope);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", params.originator ?? "balistique-agent");
  return url.toString();
};

const oauthSuccessHtml =
  "<html><body><h1>Authentication complete</h1><p>You can close this window.</p></body></html>";

const oauthErrorHtml = (message: string) =>
  `<html><body><h1>Authentication failed</h1><p>${message}</p></body></html>`;

const waitForOAuthCallback = (expectedState: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      let resolveCode: ((code: string | null) => void) | undefined;
      const codePromise = new Promise<string | null>((resolve) => {
        resolveCode = resolve;
      });

      const server = Bun.serve({
        hostname: OpenAiCodexOAuth.callbackHost,
        port: OpenAiCodexOAuth.callbackPort,
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname !== "/auth/callback") {
            return new Response(oauthErrorHtml("Callback route not found."), {
              status: 404,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }

          if (url.searchParams.get("state") !== expectedState) {
            return new Response(oauthErrorHtml("State mismatch."), {
              status: 400,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }

          const code = url.searchParams.get("code");
          if (!code) {
            return new Response(oauthErrorHtml("Missing authorization code."), {
              status: 400,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }

          resolveCode?.(code);
          return new Response(oauthSuccessHtml, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        },
      });

      return { server, codePromise, resolveCode };
    }),
    ({ codePromise }) =>
      Effect.tryPromise({
        try: () => codePromise,
        catch: (cause) =>
          new OpenAiCodexAuthError({
            reason: "LoginFailed",
            message: `OAuth callback failed: ${String(cause)}`,
          }),
      }),
    ({ server, resolveCode }) =>
      Effect.sync(() => {
        resolveCode?.(null);
        server.stop();
      }),
  );

const promptForManualCode = Effect.callback<string>((resume) => {
  process.stdout.write(
    "\nPaste the authorization code or full redirect URL from your browser:\n> ",
  );
  process.stdin.setEncoding("utf8");
  process.stdin.once("data", (chunk) => {
    resume(Effect.succeed(String(chunk).trim()));
  });
});

const openBrowser = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const platform = process.platform;
      if (platform === "darwin") {
        await Bun.spawn(["open", url]).exited;
      } else if (platform === "win32") {
        await Bun.spawn(["cmd", "/c", "start", "", url]).exited;
      } else {
        await Bun.spawn(["xdg-open", url]).exited;
      }
    },
    catch: () => undefined,
  }).pipe(Effect.ignore);

class OpenAiCodexAuthConfig extends Context.Service<OpenAiCodexAuthConfig>()(
  "@app/OpenAiCodexAuthConfig",
  {
    make: Effect.gen(function* () {
      const path = yield* Path.Path;
      const home = yield* Config.string("HOME");
      const stateDir = yield* Config.string("BALISTIQUE_STATE_DIR").pipe(
        Config.orElse(() => Config.succeed(path.join(home, ".balistique-agent"))),
      );
      const openClawAuthPath = yield* Config.string("OPENCLAW_AUTH_PATH").pipe(
        Config.orElse(() =>
          Config.succeed(
            path.join(home, ".openclaw", "agents", "main", "agent", "auth-profiles.json"),
          ),
        ),
      );

      return { stateDir, openClawAuthPath } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

export class OpenAiCodexAuth extends Context.Service<OpenAiCodexAuth>()("@app/OpenAiCodexAuth", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const config = yield* OpenAiCodexAuthConfig;

    const authFilePath = path.join(config.stateDir, "openai-codex-auth.json");

    const ensureStateDir = Effect.fn("OpenAiCodexAuth.ensureStateDir")(function* () {
      const exists = yield* fs.exists(config.stateDir);
      if (!exists) {
        yield* fs.makeDirectory(config.stateDir, { recursive: true });
      }
    });

    const saveCredentials = Effect.fn("OpenAiCodexAuth.saveCredentials")(function* (
      credentials: OpenAiCodexCredentials,
    ) {
      yield* ensureStateDir();
      const store: OpenAiCodexAuthStore = { version: 1, credentials };
      const encoded = yield* Schema.encodeEffect(OpenAiCodexAuthStore)(store);
      yield* fs.writeFileString(authFilePath, `${JSON.stringify(encoded, null, 2)}\n`);
    });

    const loadFromAuthFile = Effect.fn("OpenAiCodexAuth.loadFromAuthFile")(function* () {
      const exists = yield* fs.exists(authFilePath);
      if (!exists) return Option.none<OpenAiCodexCredentials>();

      const contents = yield* fs.readFileString(authFilePath);
      const decoded = yield* Schema.decodeEffect(OpenAiCodexAuthStore)(JSON.parse(contents)).pipe(
        Effect.mapError(
          (error) =>
            new OpenAiCodexAuthError({
              reason: "InvalidAuthFile",
              message: error.message,
            }),
        ),
      );

      return Option.some(decoded.credentials);
    });

    const loadFromOpenClaw = Effect.fn("OpenAiCodexAuth.loadFromOpenClaw")(function* () {
      const exists = yield* fs.exists(config.openClawAuthPath);
      if (!exists) return Option.none<OpenAiCodexCredentials>();

      const contents = yield* fs.readFileString(config.openClawAuthPath);
      const decoded = yield* Schema.decodeEffect(OpenClawAuthProfiles)(JSON.parse(contents)).pipe(
        Effect.mapError(
          (error) =>
            new OpenAiCodexAuthError({
              reason: "InvalidAuthFile",
              message: error.message,
            }),
        ),
      );

      for (const profile of Object.values(decoded.profiles)) {
        if (profile.provider !== "openai-codex") continue;
        if (!profile.access || !profile.refresh || typeof profile.expires !== "number") continue;

        const credentials = yield* toCredentials({
          access: profile.access,
          refresh: profile.refresh,
          expires: profile.expires,
          accountId: profile.accountId,
          email: profile.email,
        });

        return Option.some(credentials);
      }

      return Option.none<OpenAiCodexCredentials>();
    });

    let cached = Option.none<OpenAiCodexCredentials>();

    const loadCredentials = Effect.fn("OpenAiCodexAuth.loadCredentials")(function* () {
      if (Option.isSome(cached)) return cached.value;

      const fromFile = yield* loadFromAuthFile();
      if (Option.isSome(fromFile)) {
        cached = fromFile;
        return fromFile.value;
      }

      const fromOpenClaw = yield* loadFromOpenClaw();
      if (Option.isSome(fromOpenClaw)) {
        cached = fromOpenClaw;
        return fromOpenClaw.value;
      }

      return yield* new OpenAiCodexAuthError({
        reason: "MissingCredentials",
        message:
          "No OpenAI Codex credentials found. Run `bun run auth:login` or sign in with OpenClaw first.",
      });
    });

    const getCredentials = Effect.fn("OpenAiCodexAuth.getCredentials")(function* () {
      const credentials = yield* loadCredentials();
      const refreshBufferMs = 60_000;

      if (credentials.expires - refreshBufferMs > Date.now()) {
        return credentials;
      }

      const refreshed = yield* refreshAccessToken(credentials.refresh);
      yield* saveCredentials(refreshed);
      cached = Option.some(refreshed);
      return refreshed;
    });

    const login = Effect.fn("OpenAiCodexAuth.login")(function* () {
      const { verifier, challenge } = yield* generatePkceChallenge;
      const state = randomState();
      const authorizeUrl = buildAuthorizeUrl({ challenge, state });

      yield* Effect.log("Opening browser for OpenAI sign-in…");
      yield* Effect.log(`If the browser does not open, visit:\n${authorizeUrl}`);
      yield* openBrowser(authorizeUrl);

      const callbackCode = yield* Effect.catch(waitForOAuthCallback(state), () =>
        Effect.succeed(null),
      );

      let code = callbackCode;
      if (!code) {
        yield* Effect.log("Paste the redirect URL if the browser callback did not complete.");
        const manual = yield* promptForManualCode;
        const parsed = parseAuthorizationInput(manual);
        if (parsed.state && parsed.state !== state) {
          return yield* new OpenAiCodexAuthError({
            reason: "LoginFailed",
            message: "OAuth state mismatch",
          });
        }
        code = parsed.code ?? null;
      }

      if (!code) {
        return yield* new OpenAiCodexAuthError({
          reason: "LoginFailed",
          message: "Missing authorization code",
        });
      }

      const credentials = yield* exchangeAuthorizationCode(code, verifier);
      yield* saveCredentials(credentials);
      cached = Option.some(credentials);
      yield* Effect.log(`Signed in as ${credentials.email ?? credentials.accountId}`);
      return credentials;
    });

    return {
      getCredentials,
      login,
    } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(OpenAiCodexAuthConfig.layer),
  );
}
