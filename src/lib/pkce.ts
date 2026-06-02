import * as Effect from "effect/Effect";

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");

export const generatePkceChallenge = Effect.gen(function* () {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = toBase64Url(verifierBytes);

  const digest = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );

  const challenge = toBase64Url(new Uint8Array(digest));
  return { verifier, challenge } as const;
});

export const randomState = (): string => toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
