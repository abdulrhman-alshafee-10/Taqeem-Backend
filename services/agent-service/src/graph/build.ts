import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import {
  classifyNode, discoveryNode, onboardingNode, generalNode,
  toolNode, decrementBudget,
} from "./nodes.js";
import { routeByIntent, routeAfterAgent, routeAfterTools } from "./router.js";
import { finalizeNode } from "./finalize.js";
import { getCheckpointer } from "../memory.js";

export async function buildAgentGraph() {
  const g = new StateGraph(AgentState)
    .addNode("classify",   classifyNode)
    .addNode("discovery",  discoveryNode)
    .addNode("onboarding", onboardingNode)
    .addNode("general",    generalNode)
    .addNode("tools",      toolNode)
    .addNode("budget",     decrementBudget)
    .addNode("finalize",   finalizeNode);

  g.addEdge(START, "classify");

  g.addConditionalEdges("classify", routeByIntent, {
    discovery:  "discovery",
    onboarding: "onboarding",
    general:    "general",
  });

  g.addConditionalEdges("discovery",  routeAfterAgent, { tools: "budget",   finalize: "finalize" });
  g.addConditionalEdges("onboarding", routeAfterAgent, { tools: "budget",   finalize: "finalize" });
  g.addConditionalEdges("general",    routeAfterAgent, { tools: "finalize", finalize: "finalize" });

  g.addEdge("budget", "tools");

  g.addConditionalEdges("tools", routeAfterTools, {
    discovery:  "discovery",
    onboarding: "onboarding",
    general:    "general",
  });

  g.addEdge("finalize", END);

  return g.compile({ checkpointer: await getCheckpointer() });
}
