"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { intakeSchema, type IntakeInput } from "@/lib/ai/schemas";

const TIMELINE_OPTIONS: {
  value: IntakeInput["buyingTimeline"];
  label: string;
}[] = [
  { value: "immediate", label: "Immediate" },
  { value: "short_term", label: "Short term" },
  { value: "medium_term", label: "Medium term" },
  { value: "long_term", label: "Long term" },
  { value: "unspecified", label: "Unspecified" },
];

// Validates with the shared intakeSchema.
const resolver: Resolver<IntakeInput> = async (values) => {
  const result = intakeSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };

  const errors: FieldErrors<IntakeInput> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof IntakeInput | undefined;
    if (key && !errors[key]) {
      errors[key] = { type: issue.code, message: issue.message };
    }
  }
  return { values: {}, errors };
};

export function LeadForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IntakeInput>({
    resolver,
    defaultValues: {
      name: "",
      location: "",
      propertyRequirement: "",
      budget: "",
      buyingTimeline: "unspecified",
      customerMessage: "",
    },
  });

  async function onSubmit(values: IntakeInput) {
    setSubmitError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong");
        return;
      }
      reset();
      router.push(`/?open=${data.id}`);
    } catch {
      setSubmitError("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.location}>
          <FieldLabel htmlFor="location">Location</FieldLabel>
          <Input
            id="location"
            aria-invalid={!!errors.location}
            {...register("location")}
          />
          <FieldError errors={[errors.location]} />
        </Field>

        <Field data-invalid={!!errors.propertyRequirement}>
          <FieldLabel htmlFor="propertyRequirement">
            Property requirement
          </FieldLabel>
          <Input
            id="propertyRequirement"
            aria-invalid={!!errors.propertyRequirement}
            {...register("propertyRequirement")}
          />
          <FieldError errors={[errors.propertyRequirement]} />
        </Field>

        <Field data-invalid={!!errors.budget}>
          <FieldLabel htmlFor="budget">Budget</FieldLabel>
          <Input
            id="budget"
            aria-invalid={!!errors.budget}
            {...register("budget")}
          />
          <FieldError errors={[errors.budget]} />
        </Field>

        <Field data-invalid={!!errors.buyingTimeline}>
          <FieldLabel htmlFor="buyingTimeline">Buying timeline</FieldLabel>
          <Controller
            name="buyingTimeline"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="buyingTimeline"
                  aria-invalid={!!errors.buyingTimeline}
                >
                  <SelectValue placeholder="Select a timeline" />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.buyingTimeline]} />
        </Field>

        <Field data-invalid={!!errors.customerMessage}>
          <FieldLabel htmlFor="customerMessage">Customer message</FieldLabel>
          <Textarea
            id="customerMessage"
            rows={6}
            aria-invalid={!!errors.customerMessage}
            {...register("customerMessage")}
          />
          <FieldError errors={[errors.customerMessage]} />
        </Field>

        {submitError && <FieldError>{submitError}</FieldError>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit lead"}
        </Button>
      </FieldGroup>
    </form>
  );
}
