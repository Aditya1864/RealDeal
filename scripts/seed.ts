// Seeds sample leads through the REAL pipeline: each lead is inserted, then
// analyzed by the AI and scored by lib/scoring.ts (nothing is faked).
// Run: npm run db:seed
// Safe to re-run: a lead whose name and location already exist is skipped.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { analyzeAndStoreLead } from "@/lib/lead-analysis";
import type { IntakeInput } from "@/lib/ai/schemas";

// A deliberate spread: two clearly hot, two ambiguous, two clearly cold.
const SEED_LEADS: IntakeInput[] = [
  {
    name: "Ananya Reddy",
    location: "Gachibowli, Hyderabad",
    propertyRequirement:
      "3 BHK ready-to-move apartment in a gated community, close to the IT corridor",
    budget: "₹1.4 to 1.6 crore, home loan already pre-approved",
    buyingTimeline: "immediate",
    customerMessage:
      "Hi, I'm relocating to Hyderabad for a job at a company near Financial District and join in three weeks. " +
      "We need a ready-to-move 3 BHK in Gachibowli or Nanakramguda, gated community with a good school nearby for our 7-year-old. " +
      "Our loan is pre-approved up to 1.6 crore and I can pay the token amount as soon as we like a place. " +
      "We land this Friday and can see as many options as possible on Saturday and Sunday. Please send me what you have.",
  },
  {
    name: "Vikram Singh",
    location: "Koramangala, Bangalore",
    propertyRequirement: "2 BHK apartment, ready to move, with covered parking",
    budget: "Up to 95 lakhs, cash buyer, no loan needed",
    buyingTimeline: "immediate",
    customerMessage:
      "I sold my previous flat last month and the money is with me, so I'm paying fully in cash. " +
      "Looking for a 2 BHK in Koramangala or HSR Layout, anything ready to move into with covered parking, up to 95 lakhs. " +
      "My wife and I are flying in this Saturday specifically to finalise something and I would like to close within two weeks if the paperwork is clean. " +
      "Can you line up 4-5 properties for Saturday?",
  },
  {
    name: "Meera Iyer",
    location: "Velachery, Chennai",
    propertyRequirement: "2 BHK, ideally ready-to-move, near the MRTS station",
    budget: "70 to 90 lakhs depending on what we find",
    buyingTimeline: "medium_term",
    customerMessage:
      "We're exploring options for a 2 BHK, mainly Velachery but we're also looking at OMR and Pallikaranai, so I'm not fully decided on the area. " +
      "Budget is somewhere between 70 and 90 lakhs depending on what we find. We'd like to buy sometime in the next six months or so. " +
      "My husband travels a lot and will make the final call, so I'd like to see a few places and share details with him first. " +
      "Could you send some options and prices?",
  },
  {
    name: "Farhan Qureshi",
    location: "Whitefield, Bangalore",
    propertyRequirement: "A villa or a plot, not sure which yet",
    budget: "Around 1.5 to 2 crore, will know better after the March bonus",
    buyingTimeline: "medium_term",
    customerMessage:
      "I'm thinking of investing in either a villa or a plot in Whitefield or somewhere nearby, I haven't decided which one makes more sense. " +
      "I should know my budget better after my bonus comes in March, somewhere around 1.5 to 2 crore. " +
      "I don't need it immediately but I don't want to miss a good deal either. Can you tell me what's available and how the prices have been moving?",
  },
  {
    name: "Rahul Bose",
    location: "Salt Lake, Kolkata",
    propertyRequirement: "Not decided yet, maybe a flat",
    budget: "Not sure",
    buyingTimeline: "long_term",
    customerMessage:
      "Just browsing for now. Maybe in a couple of years when I am more settled I will think about buying something. " +
      "Please send me some brochures so I can get an idea of prices. No rush at all.",
  },
  {
    name: "Deepa Nair",
    location: "Kottara Chowki, Mangalore",
    propertyRequirement:
      "4 BHK sea-facing villa with a private garden and a swimming pool",
    budget: "40 lakhs",
    buyingTimeline: "immediate",
    customerMessage:
      "I want to buy a 4 BHK sea-facing villa with a garden and a private pool, and I want to move in next month. " +
      "My budget is 40 lakhs, not a rupee more, and I am not willing to negotiate on any of the features. " +
      "Please show me what you have right away.",
  },
];

const PAUSE_BETWEEN_LEADS_MS = 1500; // be gentle with free-tier rate limits

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const intake of SEED_LEADS) {
    const label = `${intake.name} (${intake.location})`;

    const [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(eq(leads.name, intake.name), eq(leads.location, intake.location)),
      );
    if (existing) {
      console.log(`skip     ${label}: already exists (id ${existing.id})`);
      skipped++;
      continue;
    }

    const [lead] = await db.insert(leads).values(intake).returning();
    try {
      const analysis = await analyzeAndStoreLead(lead);
      console.log(
        `created  ${label}: score ${analysis.priorityScore}, ${analysis.priorityTag}`,
      );
      created++;
    } catch (error) {
      // The lead is kept; "Retry analysis" in the app can analyze it later.
      console.error(`FAILED   ${label}: lead saved, analysis failed`, error);
      failed++;
    }
    await sleep(PAUSE_BETWEEN_LEADS_MS);
  }

  console.log(
    `\nDone: ${created} created, ${skipped} skipped, ${failed} failed.`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main();
