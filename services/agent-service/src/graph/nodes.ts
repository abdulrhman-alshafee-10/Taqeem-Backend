import { z } from "zod";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { fastLLM, smartLLM } from "../llm.js";
import { AgentStateType } from "./state.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  searchBusinessesTool, getBusinessDetailsTool,
  retrieveHelpDocsTool, submitBusinessDraftTool,
} from "../tools/index.js";

const IntentSchema = z.object({
  intent: z.enum(["discovery", "onboarding", "general"]),
  reason: z.string().max(160),
});

const CLASSIFY_SYS = `
You are the router for the Taqeem AI Agent. Classify the user's latest message into ONE of:

- "discovery"  — the user wants to find/compare/pick a business (restaurants, stores, services).
- "onboarding" — the user wants help using Taqeem itself (add a business, claim, replies, reviews).
- "general"    — greetings, thanks, or anything not covered above.

Respond as JSON only.
`;

export async function classifyNode(state: AgentStateType) {
  const last = state.messages.at(-1);
  if (!last) return { intent: "general" as const };

  const structured = fastLLM().withStructuredOutput(IntentSchema, { name: "intent" });
  const res = await structured.invoke([
    new SystemMessage(CLASSIFY_SYS),
    new HumanMessage(last.content.toString()),
  ]);

  return { intent: res.intent };
}

const DISCOVERY_TOOLS = [searchBusinessesTool, getBusinessDetailsTool];
const ONBOARDING_TOOLS = [retrieveHelpDocsTool, submitBusinessDraftTool];

const DISCOVERY_SYS = `
You are Taqeem's discovery assistant. Help users find businesses.

Rules:
- ALWAYS use the search_businesses tool for any find/near-me question.
- If the user gave a location, pass it. Otherwise ask once.
- Rank by rating × review count. Present up to 5 results, each with name, rating, distance, and a one-line reason.
- Never invent businesses. If nothing is found, say so and suggest broadening the search.
`;

const ONBOARDING_SYS = `
You are Taqeem's onboarding assistant. Help users use the platform.

Rules:
- ALWAYS call retrieve_help_docs first to ground your answer.
- Cite the relevant help doc titles at the end of your reply.
- If the user explicitly wants to create/claim a business AND is authenticated, use submit_business_draft to collect fields one at a time.
`;

function makeSubAgent(system: string, tools: any[]) {
  const model = smartLLM().bindTools(tools);
  return async (state: AgentStateType) => {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", system],
      new MessagesPlaceholder("messages"),
    ]);
    const msgs = await prompt.formatMessages({ messages: state.messages });
    const res = await model.invoke(msgs);
    return { messages: [res as AIMessage] };
  };
}

export const discoveryNode  = makeSubAgent(DISCOVERY_SYS,  DISCOVERY_TOOLS);
export const onboardingNode = makeSubAgent(ONBOARDING_SYS, ONBOARDING_TOOLS);

export async function generalNode(state: AgentStateType) {
  const res = await fastLLM().invoke([
    new SystemMessage(
      "You are a friendly assistant for Taqeem. Keep replies short. " +
      "If asked about finding businesses or using the platform, offer to help."
    ),
    ...state.messages,
  ]);
  return { messages: [res] };
}

export const toolNode = new ToolNode([
  searchBusinessesTool,
  getBusinessDetailsTool,
  retrieveHelpDocsTool,
  submitBusinessDraftTool,
]);

export function decrementBudget(state: AgentStateType) {
  return { toolBudget: state.toolBudget - 1 };
}
