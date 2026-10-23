import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type LanguageModel, type ModelMessage } from "ai";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

const groqModel: LanguageModel = groq("openai/gpt-oss-120b");
// Lead analysis backup. gemini-3.8-flash and gemini-3.6-flash were both
// overloaded (HTTP 503 "high demand", or no response at all) when tested;
// gemini-3.1-flash-lite answered 5 of 5 in about 2.4s with valid output.
const geminiModel: LanguageModel = google("gemini-3.1-flash-lite");

// Lead analysis (withFallback): Groq first, Gemini as the backup.
export const primaryModel = groqModel;
export const fallbackModel = geminiModel;

// Chat uses its own Gemini backup: gemini-3.8-flash was overloaded and
// stalling when chat was built, while gemini-3.6-flash answered promptly.
const chatBackupModel: LanguageModel = google("gemini-3.6-flash");

// Each attempt (including the SDK's own retries) must finish within this, so
// a provider that stalls without erroring can't leave a lead stuck on
// "Analyzing…".
const ATTEMPT_TIMEOUT_MS = 30_000;

/**
 * Runs `run` against Groq first; if it throws (rate limit, provider error,
 * unparseable output, or no answer within the timeout), runs it again against
 * Gemini. Only if both fail does an error surface, carrying both causes.
 * `run` must pass the given `abortSignal` on to the model call.
 */
export async function withFallback<T>(
  run: (model: LanguageModel, abortSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  try {
    return await run(primaryModel, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS));
  } catch (primaryError) {
    console.warn("Groq call failed, falling back to Gemini:", primaryError);
    try {
      return await run(fallbackModel, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS));
    } catch (fallbackError) {
      throw new Error("Both Groq and Gemini failed", {
        cause: new AggregateError([primaryError, fallbackError]),
      });
    }
  }
}

type StreamParams = {
  system: string;
  messages: ModelMessage[];
  temperature?: number;
};

// How long each provider gets to produce its first output before we give up
// on it. A stalled provider (e.g. one reporting high demand) can otherwise
// hang the stream without ever erroring. The last resort gets longer.
const FIRST_OUTPUT_TIMEOUT_MS = { groq: 15_000, gemini: 30_000 };

// True once the model has produced real output; false if it errored, produced
// nothing, or took longer than `timeoutMs`. Reads its own copy of the stream,
// so the caller can still consume the full stream afterwards.
async function startedOk(
  result: ReturnType<typeof streamText>,
  timeoutMs: number,
) {
  const reader = result.stream.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const firstOutput = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || value.type === "error") return false;
        if (value.type === "text-delta" || value.type === "reasoning-delta") {
          return true;
        }
      }
    } catch {
      return false;
    }
  })();

  try {
    return await Promise.race([firstOutput, timeout]);
  } finally {
    clearTimeout(timer);
    reader.cancel().catch(() => {});
  }
}

/**
 * Chat streaming: Groq first, gemini-3.6-flash as the backup. Switches to the
 * backup if Groq fails or stalls before producing any output. A stream that
 * fails midway cannot be restarted, so it surfaces as an error to the caller's
 * client instead.
 */
export async function streamWithFallback(params: StreamParams) {
  const errors: unknown[] = [];
  const providers = [
    { name: "groq", model: groqModel },
    { name: "gemini", model: chatBackupModel },
  ] as const;

  for (const { name, model } of providers) {
    const controller = new AbortController();
    const result = streamText({
      ...params,
      model,
      abortSignal: controller.signal,
      onError: ({ error }) => {
        errors.push(error);
      },
    });
    if (await startedOk(result, FIRST_OUTPUT_TIMEOUT_MS[name])) return result;
    controller.abort(); // stop a stalled request from lingering
    console.warn(`Chat: ${name} failed or stalled before answering`, errors);
  }
  throw new Error("Both Groq and Gemini failed", {
    cause: new AggregateError(errors),
  });
}
