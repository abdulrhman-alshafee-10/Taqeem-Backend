import crypto from "node:crypto";
import { AgentStateType } from "./state.js";
import { publishEvent } from "../events/publisher.js";

export async function finalizeNode(state: AgentStateType) {
  const toolCalls = state.messages
    .flatMap((m: any) => m.tool_calls ?? [])
    .map((t: any) => t.name);

  await publishEvent("agent.query", {
    id:        crypto.randomUUID(),
    userId:    state.userId,
    intent:    state.intent,
    toolsUsed: [...new Set(toolCalls)],
    turns:     state.messages.length,
    at:        new Date().toISOString(),
  }).catch(() => {});

  return {};
}
