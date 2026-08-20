import { AIMessage } from "@langchain/core/messages";
import { AgentStateType } from "./state.js";

// After classify → which agent node?
export function routeByIntent(state: AgentStateType): "discovery" | "onboarding" | "general" {
  return state.intent ?? "general";
}

// After an agent turn → tools or finalize?
export function routeAfterAgent(state: AgentStateType): "tools" | "finalize" {
  const last = state.messages.at(-1) as AIMessage | undefined;
  if (!last) return "finalize";
  const wantsTool = Array.isArray(last.tool_calls) && last.tool_calls.length > 0;
  if (!wantsTool) return "finalize";
  if (state.toolBudget <= 0) return "finalize";
  return "tools";
}

// After tools → which agent should read the tool output?
export function routeAfterTools(state: AgentStateType): "discovery" | "onboarding" | "general" {
  return state.intent ?? "general";
}
