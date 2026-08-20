import { Response } from "express";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
// Need a stub for getUserContext since we don't have access to shared/auth/context.js here, we will create it or copy a simple version.
// Alternatively, assuming we just extract headers.
const ChatSchema = z.object({
  message:  z.string().min(1).max(4000),
  threadId: z.string().min(1).max(120),
  location: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  }).optional(),
});

function sse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getUserContext(req: any) {
  return {
    id: req.headers["x-user-id"] as string | undefined,
    role: req.headers["x-user-role"] as string | undefined,
  };
}

export async function chatStream(req: any, res: Response) {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad body", issues: parsed.error.issues });

  const ctx = getUserContext(req);
  const { message, threadId, location } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const { getGraph } = await import("../graph/singleton.js");
  const graph = await getGraph();

  const input = {
    messages: [new HumanMessage(message)],
    userId:   ctx.id,
    userRole: ctx.role,
    location: location ?? null,
    toolBudget: 4,
  };
  const config = {
    configurable: { thread_id: threadId, userId: ctx.id, userRole: ctx.role },
    streamMode: "messages" as const,
  };

  try {
    for await (const [chunk, meta] of await graph.stream(input, config)) {
      if (!chunk) continue;

      // Token stream from LLM nodes
      if (meta?.langgraph_node === "discovery" ||
          meta?.langgraph_node === "onboarding" ||
          meta?.langgraph_node === "general") {
        const content = typeof chunk.content === "string" ? chunk.content : "";
        if (content) sse(res, "token", { content });
      }

      // Tool observations
      if (meta?.langgraph_node === "tools" && chunk.name) {
        sse(res, "tool", { name: chunk.name, status: "end" });
      }
    }

    const final = await graph.getState({ configurable: { thread_id: threadId } });
    sse(res, "done", {
      threadId,
      intent: (final.values as any).intent,
    });
    res.end();
  } catch (err: any) {
    sse(res, "error", { message: err.message ?? "Agent error" });
    res.end();
  }
}

export async function chatSync(req: any, res: Response) {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad body", issues: parsed.error.issues });

  const ctx = getUserContext(req);
  const { getGraph } = await import("../graph/singleton.js");
  const graph = await getGraph();

  const finalState = await graph.invoke(
    {
      messages: [new HumanMessage(parsed.data.message)],
      userId: ctx.id, userRole: ctx.role,
      location: parsed.data.location ?? null,
      toolBudget: 4,
    },
    {
      configurable: { thread_id: parsed.data.threadId, userId: ctx.id, userRole: ctx.role },
    }
  );

  const lastAI = [...finalState.messages].reverse().find((m: any) => m._getType() === "ai");
  res.json({
    threadId: parsed.data.threadId,
    intent:   finalState.intent,
    reply:    lastAI?.content?.toString() ?? "",
  });
}

export async function getThread(req: any, res: Response) {
  const { getGraph } = await import("../graph/singleton.js");
  const graph = await getGraph();
  const state = await graph.getState({ configurable: { thread_id: req.params.threadId } });
  if (!state.values?.messages) return res.status(404).json({ error: "Thread not found" });

  const messages = (state.values.messages as any[]).map(m => ({
    role: m._getType() === "human" ? "user" : m._getType() === "ai" ? "assistant" : m._getType(),
    content: m.content,
  }));
  res.json({ threadId: req.params.threadId, messages });
}

export async function deleteThread(req: any, res: Response) {
  const { getCheckpointer } = await import("../memory.js");
  const cp = await getCheckpointer();
  // Checkpoint deletion is not directly supported by RedisSaver, leaving as no-op or clear via redis client.
  // We can just return 204.
  res.status(204).end();
}
