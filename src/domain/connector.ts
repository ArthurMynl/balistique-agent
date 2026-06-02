import * as Schema from "effect/Schema";

/** Registered connector identifiers (extend when adding calendar, notes, etc.). */
export const ConnectorId = Schema.Literals(["mail"]);
export type ConnectorId = typeof ConnectorId.Type;

export const ConnectorManifest = Schema.Struct({
  id: ConnectorId,
  description: Schema.String,
  tools: Schema.Array(Schema.String),
});

export type ConnectorManifest = typeof ConnectorManifest.Type;
