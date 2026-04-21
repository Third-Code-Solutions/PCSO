"use server";

import { db } from "@/lib/db";
import { trainingProviders } from "@/lib/db/schema/learning";
import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TrainerSchema = z.object({
  name: z.string().min(1, "Trainer name is required"),
  qualifications: z.string().optional(),
  expertise: z.array(z.string()).default([]),
});

const CreateProviderSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  accreditationNumber: z.string().max(60).optional().nullable(),
  accreditationExpires: z.string().optional().nullable(), // date as ISO string
  contactEmail: z.string().email("Valid email is required").max(200),
  contactNumber: z.string().min(1, "Contact number is required").max(30),
  address: z.string().optional().nullable(),
  trainers: z.array(TrainerSchema).default([]),
  programsOffered: z.array(z.string().uuid()).default([]),
});

const UpdateProviderSchema = CreateProviderSchema.partial().extend({
  id: z.string().uuid(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createTrainingProvider(
  input: z.infer<typeof CreateProviderSchema>,
) {
  const validated = CreateProviderSchema.parse(input);

  const [provider] = await db
    .insert(trainingProviders)
    .values({
      ...validated,
      accreditationNumber: validated.accreditationNumber || null,
      accreditationExpires: validated.accreditationExpires || null,
      address: validated.address || null,
    })
    .returning();

  revalidatePath("/learning/providers");
  revalidatePath("/learning");

  return { success: true, data: provider };
}

export async function updateTrainingProvider(
  input: z.infer<typeof UpdateProviderSchema>,
) {
  const validated = UpdateProviderSchema.parse(input);
  const { id, ...updates } = validated;

  const [provider] = await db
    .update(trainingProviders)
    .set(updates)
    .where(eq(trainingProviders.id, id))
    .returning();

  if (!provider) {
    throw new Error("Training provider not found");
  }

  revalidatePath("/learning/providers");
  revalidatePath(`/learning/providers/${id}`);
  revalidatePath("/learning");

  return { success: true, data: provider };
}

export async function deactivateTrainingProvider(providerId: string) {
  const validated = z.string().uuid().parse(providerId);

  const [provider] = await db
    .update(trainingProviders)
    .set({ deletedAt: new Date() })
    .where(eq(trainingProviders.id, validated))
    .returning();

  if (!provider) {
    throw new Error("Training provider not found");
  }

  revalidatePath("/learning/providers");
  revalidatePath("/learning");

  return { success: true, data: provider };
}

export async function getTrainingProvider(providerId: string) {
  const validated = z.string().uuid().parse(providerId);

  const provider = await db.query.trainingProviders.findFirst({
    where: (t, { eq, isNull, and }) =>
      and(eq(t.id, validated), isNull(t.deletedAt)),
  });

  if (!provider) {
    throw new Error("Training provider not found");
  }

  return provider;
}

export async function listActiveProviders() {
  const providers = await db.query.trainingProviders.findMany({
    where: isNull(trainingProviders.deletedAt),
    orderBy: (t, { asc }) => [asc(t.companyName)],
  });

  return providers;
}
