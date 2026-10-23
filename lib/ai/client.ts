import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

export const primaryModel: LanguageModel = groq("openai/gpt-oss-120b");
export const fallbackModel: LanguageModel = google("gemini-3.8-flash");

/**
 * Runs `run` against Groq first; if it throws (rate limit, provider error,
 * unparseable output), runs it again against Gemini. Only if both fail does
 * an error surface, carrying both causes.
 */
export async function withFallback<T>(
  run: (model: LanguageModel) => Promise<T>,
): Promise<T> {
  try {
    return await run(primaryModel);
  } catch (primaryError) {
    console.warn("Groq call failed, falling back to Gemini:", primaryError);
    try {
      return await run(fallbackModel);
    } catch (fallbackError) {
      throw new Error("Both Groq and Gemini failed", {
        cause: new AggregateError([primaryError, fallbackError]),
      });
    }
  }
}
