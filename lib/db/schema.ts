import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const buyingTimelineEnum = pgEnum("buying_timeline", [
  "immediate",
  "short_term",
  "medium_term",
  "long_term",
  "unspecified",
]);

export const stageEnum = pgEnum("stage", ["new", "qualified"]);

export const priorityTagEnum = pgEnum("priority_tag", ["hot", "warm", "cold"]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

// Raw intake data, entered once.
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  propertyRequirement: text("property_requirement").notNull(),
  budget: text("budget").notNull(),
  buyingTimeline: buyingTimelineEnum("buying_timeline")
    .notNull()
    .default("unspecified"),
  customerMessage: text("customer_message").notNull(),
  // Manual workflow state, salesperson-controlled.
  stage: stageEnum("stage").notNull().default("new"),
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// History table: one new row per analysis run, never overwritten.
export const leadAnalyses = pgTable("lead_analyses", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  intent: text("intent").notNull(),
  keyRequirements: text("key_requirements").array().notNull(),
  objections: text("objections").array().notNull(),
  recommendedNextAction: text("recommended_next_action").notNull(),
  suggestedResponse: text("suggested_response").notNull(),
  missingOrAmbiguousInfo: text("missing_or_ambiguous_info").array().notNull(),
  buyingTimelineRating: integer("buying_timeline_rating").notNull(),
  buyingTimelineEvidence: text("buying_timeline_evidence").notNull(),
  budgetFitRating: integer("budget_fit_rating").notNull(),
  budgetFitEvidence: text("budget_fit_evidence").notNull(),
  locationFitRating: integer("location_fit_rating").notNull(),
  locationFitEvidence: text("location_fit_evidence").notNull(),
  propertyRequirementFitRating: integer(
    "property_requirement_fit_rating",
  ).notNull(),
  propertyRequirementFitEvidence: text(
    "property_requirement_fit_evidence",
  ).notNull(),
  // Computed by code (lib/scoring.ts), not by the AI.
  priorityScore: integer("priority_score").notNull(),
  priorityTag: priorityTagEnum("priority_tag").notNull(),
  suggestedFollowUpDate: date("suggested_follow_up_date", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Per-lead grounded chat history.
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Post-call outcome logging.
export const callOutcomes = pgTable("call_outcomes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  notes: text("notes").notNull(),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
