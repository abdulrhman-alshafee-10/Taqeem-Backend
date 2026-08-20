import { ChatOpenAI } from "@langchain/openai";

export const fastLLM = () => new ChatOpenAI({
  model:       process.env.LLM_FAST_MODEL  ?? "gpt-4o-mini",
  temperature: 0.2,
  streaming:   true,
});

export const smartLLM = () => new ChatOpenAI({
  model:       process.env.LLM_SMART_MODEL ?? "gpt-4o",
  temperature: 0.3,
  streaming:   true,
});
