"use server";

import { db } from "@/lib/db";
import {
  trainingCertificates,
  trainingParticipants,
} from "@/lib/db/schema/learning";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sign } from "jsonwebtoken";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GenerateCertificateSchema = z.object({
  participantId: z.string().uuid(),
  issuedByEmployeeId: z.string().uuid(),
});

// ─── Helper: Generate Serial Number ──────────────────────────────────────────

import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";

async function generateCertificateNumber(): Promise<string> {
  return await generateSerialNumber(DOCUMENT_TYPES.TRAINING_CERT);
}

// ─── Helper: Generate QR JWT Token ───────────────────────────────────────────

function generateQrToken(certificateData: {
  certificateNumber: string;
  participantId: string;
  issuedAt: Date;
  issuedBy: string;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Missing env: JWT_SECRET. Set a 32+ character random secret for certificate signing.",
    );
  }

  const payload = {
    document_type: "CT",
    serial_number: certificateData.certificateNumber,
    participant_id_hash: Buffer.from(certificateData.participantId).toString(
      "base64",
    ),
    issued_at: certificateData.issuedAt.toISOString(),
    issued_by: certificateData.issuedBy,
  };

  // 5-year expiry per PRD §6.1
  const token = sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: "5y",
  });

  return token;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function generateTrainingCertificate(
  input: z.infer<typeof GenerateCertificateSchema>,
) {
  const validated = GenerateCertificateSchema.parse(input);

  // Check if participant exists and has completed the training
  const participant = await db.query.trainingParticipants.findFirst({
    where: eq(trainingParticipants.id, validated.participantId),
    with: {
      employee: true,
      run: {
        with: {
          program: true,
          provider: true,
        },
      },
    },
  });

  if (!participant) {
    throw new Error("Participant not found");
  }

  if (participant.status !== "completed") {
    throw new Error(
      "Certificate can only be generated for completed participants",
    );
  }

  // Check if certificate already exists
  const existingCert = await db.query.trainingCertificates.findFirst({
    where: eq(trainingCertificates.participantId, validated.participantId),
  });

  if (existingCert) {
    throw new Error("Certificate already exists for this participant");
  }

  const certificateNumber = await generateCertificateNumber();
  const issuedAt = new Date();

  const qrTokenJwt = generateQrToken({
    certificateNumber,
    participantId: validated.participantId,
    issuedAt,
    issuedBy: validated.issuedByEmployeeId,
  });

  const [certificate] = await db
    .insert(trainingCertificates)
    .values({
      participantId: validated.participantId,
      certificateNumber,
      issuedAt,
      issuedByEmployeeId: validated.issuedByEmployeeId,
      qrTokenJwt,
      pdfUrl: null, // TODO: Generate PDF and upload to Supabase Storage
    })
    .returning();

  revalidatePath(`/learning/schedule/${participant.runId}`);
  revalidatePath("/learning/certificates");

  return { success: true, data: certificate };
}

export async function getCertificate(certificateId: string) {
  const validated = z.string().uuid().parse(certificateId);

  const certificate = await db.query.trainingCertificates.findFirst({
    where: eq(trainingCertificates.id, validated),
    with: {
      participant: {
        with: {
          employee: true,
          run: {
            with: {
              program: true,
              provider: true,
            },
          },
        },
      },
      issuedBy: true,
    },
  });

  if (!certificate) {
    throw new Error("Certificate not found");
  }

  return certificate;
}

export async function getCertificateByNumber(certificateNumber: string) {
  const certificate = await db.query.trainingCertificates.findFirst({
    where: eq(trainingCertificates.certificateNumber, certificateNumber),
    with: {
      participant: {
        with: {
          employee: true,
          run: {
            with: {
              program: true,
              provider: true,
            },
          },
        },
      },
      issuedBy: true,
    },
  });

  if (!certificate) {
    throw new Error("Certificate not found");
  }

  return certificate;
}

export async function listCertificates() {
  const certificates = await db.query.trainingCertificates.findMany({
    with: {
      participant: {
        with: {
          employee: true,
          run: {
            with: {
              program: true,
            },
          },
        },
      },
      issuedBy: true,
    },
    orderBy: (t, { desc }) => [desc(t.issuedAt)],
    limit: 200,
  });

  return certificates;
}
