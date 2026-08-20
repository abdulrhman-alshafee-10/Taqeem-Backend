import { buildAgentGraph } from "./build.js";

let graphPromise: ReturnType<typeof buildAgentGraph> | null = null;

export function getGraph() {
  if (!graphPromise) graphPromise = buildAgentGraph();
  return graphPromise;
}
