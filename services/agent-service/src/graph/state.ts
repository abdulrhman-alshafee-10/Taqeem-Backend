import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

export type Intent = "discovery" | "onboarding" | "general";

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  intent: Annotation<Intent | null>({
    reducer: (_prev, next) => next ?? _prev ?? null,
    default: () => null,
  }),
  userId: Annotation<string | null>({
    reducer: (_p, n) => n ?? _p,
    default: () => null,
  }),
  userRole: Annotation<string | null>({
    reducer: (_p, n) => n ?? _p,
    default: () => null,
  }),
  location: Annotation<{ lat: number; lng: number } | null>({
    reducer: (_p, n) => n ?? _p,
    default: () => null,
  }),
  toolBudget: Annotation<number>({
    reducer: (_p, n) => n,
    default: () => 4,             // hard cap: 4 tool calls per turn
  }),
});

export type AgentStateType = typeof AgentState.State;
