import * as Schema from "effect/Schema";

export const OpenAiCodexCredentials = Schema.Struct({
  access: Schema.String,
  refresh: Schema.String,
  expires: Schema.Number,
  accountId: Schema.String,
  email: Schema.optional(Schema.String),
});

export type OpenAiCodexCredentials = typeof OpenAiCodexCredentials.Type;

export const OpenAiCodexAuthStore = Schema.Struct({
  version: Schema.Literal(1),
  credentials: OpenAiCodexCredentials,
});

export type OpenAiCodexAuthStore = typeof OpenAiCodexAuthStore.Type;

export class OpenAiCodexAuthError extends Schema.TaggedErrorClass<OpenAiCodexAuthError>()(
  "OpenAiCodexAuthError",
  {
    reason: Schema.Literals([
      "MissingCredentials",
      "TokenRefreshFailed",
      "LoginFailed",
      "InvalidAuthFile",
    ]),
    message: Schema.String,
  },
) {}

export const OpenAiCodexResponsesBaseUrl = "https://chatgpt.com/backend-api/codex";

export const OpenAiCodexOAuth = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  redirectUri: "http://localhost:1455/auth/callback",
  scope: "openid profile email offline_access",
  callbackHost: "127.0.0.1",
  callbackPort: 1455,
} as const;
