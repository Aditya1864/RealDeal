// Throwaway sanity check for the AI pipeline. Not part of the app.
// Run: npx tsx --env-file=.env.local scripts/test-analyze.ts
import { analyzeLead } from "@/lib/ai/analyze-lead";
import type { IntakeInput } from "@/lib/ai/schemas";

const sampleLead: IntakeInput = {
  name: "Priya Nair",
  location: "Whitefield, Bangalore",
  propertyRequirement: "3 BHK apartment, ready to move, gated community with parking",
  budget: "Around 1.2 Cr, can stretch to 1.35 Cr for the right place",
  buyingTimeline: "short_term",
  customerMessage:
    "Hi, I'm relocating to Bangalore for work in about six weeks and need to finalise a home before then. " +
    "We're a family of four, so a 3 BHK is a must, preferably in Whitefield since my office is near ITPL. " +
    "Our budget is roughly 1.2 crore, maybe a little more if the society has good amenities and a school nearby. " +
    "I'd like a ready-to-move flat, not under construction. I can visit this coming weekend if you have a few options to show. " +
    "My husband is still deciding between this and a villa plot, so we may need to discuss it with him first.",
};

async function main() {
  try {
    const result = await analyzeLead(sampleLead);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("analyzeLead failed:");
    console.dir(error, { depth: null });
    process.exit(1);
  }
}

main();
