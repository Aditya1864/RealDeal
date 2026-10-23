import { z } from "zod";

const factorSchema = z.object({
  rating: z.number().int().min(0).max(10),
  evidence: z.string(),
});

// AI output contract. The AI never outputs a final score or Hot/Warm/Cold tag;
// it only rates four factors 0-10 with evidence (see lib/scoring.ts).
export const analysisSchema = z.object({
  summary: z.string(),
  intent: z.string(),
  keyRequirements: z.array(z.string()),
  objections: z.array(z.string()),
  recommendedNextAction: z.string(),
  suggestedResponse: z.string(),
  missingOrAmbiguousInfo: z.array(z.string()),
  scoringFactors: z.object({
    buyingTimeline: factorSchema,
    budgetFit: factorSchema,
    locationFit: factorSchema,
    propertyRequirementFit: factorSchema,
  }),
  // Used on re-analysis only.
  suggestedFollowUpDate: z.string().nullable(),
});

export type Analysis = z.infer<typeof analysisSchema>;

export const buyingTimelineValues = [
  "immediate",
  "short_term",
  "medium_term",
  "long_term",
  "unspecified",
] as const;

// Intake form (shared with the leads POST route).
export const intakeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  location: z.string().trim().min(1, "Location is required"),
  propertyRequirement: z
    .string()
    .trim()
    .min(1, "Property requirement is required"),
  budget: z.string().trim().min(1, "Budget is required"),
  buyingTimeline: z.enum(buyingTimelineValues),
  customerMessage: z.string().trim().min(1, "Customer message is required"),
});

export type IntakeInput = z.infer<typeof intakeSchema>;

// Chat message.
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// Post-call outcome log (POST /api/leads/[id]/outcome).
export const callOutcomeSchema = z.object({
  notes: z.string().trim().min(1, "Notes are required"),
});

export type CallOutcomeInput = z.infer<typeof callOutcomeSchema>;

// Manual stage change (PATCH /api/leads/[id]).
export const stageUpdateSchema = z.object({
  stage: z.enum(["new", "qualified"]),
});

export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;
