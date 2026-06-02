import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AgentToolkit } from "../connectors/agent-toolkit.js";
import { connectorManifests } from "../connectors/registry.js";

export class ConnectorRegistry extends Context.Service<ConnectorRegistry>()(
  "@app/ConnectorRegistry",
  {
    make: Effect.gen(function* () {
      const toolkit = yield* AgentToolkit;

      return {
        toolkit,
        manifests: connectorManifests,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
