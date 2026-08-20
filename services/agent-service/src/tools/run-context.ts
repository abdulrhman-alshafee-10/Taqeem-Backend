import type { RunnableConfig } from "@langchain/core/runnables";

export function getRunConfig(cfg?: RunnableConfig) {
  const c = cfg?.configurable ?? {};
  return {
    userId: (c.userId ?? null) as string | null,
    role:   (c.userRole ?? null) as string | null,
    threadId: (c.thread_id ?? null) as string | null,
  };
}
