import { after } from "next/server";
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import {
  getChatMessages,
  getLeadById,
  saveChatExchange,
} from "@/lib/db/queries";
import { streamWithFallback } from "@/lib/ai/client";
import { buildChatSystemPrompt } from "@/lib/ai/chat";
import { chatRequestSchema } from "@/lib/ai/schemas";

// The answer streams for as long as the model takes.
export const maxDuration = 60;

// How many past messages the model sees. Keeps prompts small on free tiers.
const HISTORY_LIMIT = 20;

// Low temperature: answers should stick to the data, not get creative.
const TEMPERATURE = 0.3;

async function parseLeadId(ctx: RouteContext<"/api/chat/[id]">) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Saved chat history, in the shape useChat expects. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/[id]">,
) {
  const id = await parseLeadId(ctx);
  if (id === null) {
    return Response.json({ error: "Invalid lead id" }, { status: 400 });
  }
  const messages = await getChatMessages(id);
  return Response.json(
    messages.map((m) => ({
      id: String(m.id),
      role: m.role,
      parts: [{ type: "text", text: m.content }],
    })),
  );
}

/** Answers one question about a lead, grounded in that lead's current data. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/chat/[id]">,
) {
  const id = await parseLeadId(ctx);
  if (id === null) {
    return Response.json({ error: "Invalid lead id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const question = parsed.data.text;

  // Rebuilt from the database on every message (never cached), so a call
  // logged a moment ago is already reflected in the answer.
  const [lead, history] = await Promise.all([
    getLeadById(id),
    getChatMessages(id, HISTORY_LIMIT),
  ]);
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  let result;
  try {
    result = await streamWithFallback({
      system: buildChatSystemPrompt(lead),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: question },
      ],
      temperature: TEMPERATURE,
    });
  } catch (error) {
    console.error(`Chat failed for lead ${id}:`, error);
    return Response.json(
      { error: "The assistant is unavailable right now. Please try again." },
      { status: 502 },
    );
  }

  // Keep generating even if the client disconnects, then save the exchange.
  // Only a completed answer is saved, so history never holds a question
  // without a reply.
  void result.consumeStream();
  after(async () => {
    try {
      const answer = (await result.text).trim();
      if (answer) await saveChatExchange(id, question, answer);
    } catch (error) {
      console.error(`Saving chat for lead ${id} failed:`, error);
    }
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, sendReasoning: false }),
  });
}
