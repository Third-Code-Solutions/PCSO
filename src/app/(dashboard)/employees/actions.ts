"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  EmployeeSchema,
  EmployeeUpdateSchema,
  type EmployeeInput,
  type EmployeeUpdateInput,
} from "@/lib/validations/employees";
import { generateEmployeeNo } from "@/lib/utils/employee-no";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// createEmployee
// ---------------------------------------------------------------------------
export async function createEmployee(input: unknown) {
  const parsed = EmployeeSchema.parse(input) satisfies EmployeeInput;
  const user = await requirePermission("employees", "create");

  const employeeNo = await generateEmployeeNo();

  const inserted = await db
    .insert(employees)
    .values({
      employeeNo,
      firstName: parsed.firstName,
      middleName: parsed.middleName ?? null,
      lastName: parsed.lastName,
      suffix: parsed.suffix ?? null,
      birthDate: parsed.birthDate,
      gender: parsed.gender,
      civilStatus: parsed.civilStatus,
      nationality: parsed.nationality,
      religion: parsed.religion ?? null,
      bloodType: parsed.bloodType ?? null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      // Current address fields map to the address columns in the DB
      addressStreet:
        parsed.currentAddressStreet ?? parsed.permanentAddressStreet ?? null,
      addressBarangay:
        parsed.currentAddressBarangay ??
        parsed.permanentAddressBarangay ??
        null,
      addressCity:
        parsed.currentAddressCity ?? parsed.permanentAddressCity ?? null,
      addressProvince:
        parsed.currentAddressProvince ??
        parsed.permanentAddressProvince ??
        null,
      addressZipCode:
        parsed.currentAddressZip ?? parsed.permanentAddressZip ?? null,
      emergencyContactName: parsed.emergencyContactName ?? null,
      emergencyContactRelationship: parsed.emergencyContactRelation ?? null,
      emergencyContactPhone: parsed.emergencyContactPhone || null,
      appointmentType: parsed.appointmentType,
      positionTitle: parsed.positionTitle,
      salaryGrade: parsed.salaryGrade,
      step: parsed.step,
      officeId: parsed.officeId,
      dateHired: parsed.dateHired,
      dateRegularized: parsed.dateRegularized ?? null,
      status: parsed.status,
      tin: parsed.tin || null,
      gsisNo: parsed.gsisNo || null,
      philhealthNo: parsed.philhealthNo || null,
      pagibigNo: parsed.pagibigNo || null,
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new Error("Insert returned no rows");

  await auditLog({
    userId: user.id,
    action: "create",
    table: "employees",
    recordId: row.id,
    newValues: {
      employeeNo: row.employeeNo,
      name: `${row.firstName} ${row.lastName}`,
    },
  });

  revalidatePath("/employees");
  return row;
}

// ---------------------------------------------------------------------------
// updateEmployee
// ---------------------------------------------------------------------------
export async function updateEmployee(input: unknown) {
  const parsed = EmployeeUpdateSchema.parse(
    input,
  ) satisfies EmployeeUpdateInput;
  const user = await requirePermission("employees", "edit");

  const [existing] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, parsed.id), isNull(employees.deletedAt)))
    .limit(1);

  if (!existing) throw new Error("Employee not found");

  const updateValues: Partial<typeof employees.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.firstName !== undefined) updateValues.firstName = parsed.firstName;
  if (parsed.middleName !== undefined)
    updateValues.middleName = parsed.middleName ?? null;
  if (parsed.lastName !== undefined) updateValues.lastName = parsed.lastName;
  if (parsed.suffix !== undefined) updateValues.suffix = parsed.suffix ?? null;
  if (parsed.birthDate !== undefined) updateValues.birthDate = parsed.birthDate;
  if (parsed.gender !== undefined) updateValues.gender = parsed.gender;
  if (parsed.civilStatus !== undefined)
    updateValues.civilStatus = parsed.civilStatus;
  if (parsed.nationality !== undefined)
    updateValues.nationality = parsed.nationality;
  if (parsed.religion !== undefined)
    updateValues.religion = parsed.religion ?? null;
  if (parsed.bloodType !== undefined)
    updateValues.bloodType = parsed.bloodType ?? null;
  if (parsed.email !== undefined) updateValues.email = parsed.email || null;
  if (parsed.phone !== undefined) updateValues.phone = parsed.phone || null;
  if (parsed.currentAddressStreet !== undefined)
    updateValues.addressStreet = parsed.currentAddressStreet ?? null;
  if (parsed.currentAddressBarangay !== undefined)
    updateValues.addressBarangay = parsed.currentAddressBarangay ?? null;
  if (parsed.currentAddressCity !== undefined)
    updateValues.addressCity = parsed.currentAddressCity ?? null;
  if (parsed.currentAddressProvince !== undefined)
    updateValues.addressProvince = parsed.currentAddressProvince ?? null;
  if (parsed.currentAddressZip !== undefined)
    updateValues.addressZipCode = parsed.currentAddressZip ?? null;
  if (parsed.emergencyContactName !== undefined)
    updateValues.emergencyContactName = parsed.emergencyContactName ?? null;
  if (parsed.emergencyContactRelation !== undefined)
    updateValues.emergencyContactRelationship =
      parsed.emergencyContactRelation ?? null;
  if (parsed.emergencyContactPhone !== undefined)
    updateValues.emergencyContactPhone = parsed.emergencyContactPhone || null;
  if (parsed.appointmentType !== undefined)
    updateValues.appointmentType = parsed.appointmentType;
  if (parsed.positionTitle !== undefined)
    updateValues.positionTitle = parsed.positionTitle;
  if (parsed.salaryGrade !== undefined)
    updateValues.salaryGrade = parsed.salaryGrade;
  if (parsed.step !== undefined) updateValues.step = parsed.step;
  if (parsed.officeId !== undefined) updateValues.officeId = parsed.officeId;
  if (parsed.dateHired !== undefined) updateValues.dateHired = parsed.dateHired;
  if (parsed.dateRegularized !== undefined)
    updateValues.dateRegularized = parsed.dateRegularized ?? null;
  if (parsed.status !== undefined) updateValues.status = parsed.status;
  if (parsed.tin !== undefined) updateValues.tin = parsed.tin || null;
  if (parsed.gsisNo !== undefined) updateValues.gsisNo = parsed.gsisNo || null;
  if (parsed.philhealthNo !== undefined)
    updateValues.philhealthNo = parsed.philhealthNo || null;
  if (parsed.pagibigNo !== undefined)
    updateValues.pagibigNo = parsed.pagibigNo || null;

  const [updated] = await db
    .update(employees)
    .set(updateValues)
    .where(eq(employees.id, parsed.id))
    .returning();

  await auditLog({
    userId: user.id,
    action: "edit",
    table: "employees",
    recordId: parsed.id,
    oldValues: {
      status: existing.status,
      positionTitle: existing.positionTitle,
    },
    newValues: updateValues,
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${parsed.id}`);
  return updated;
}

// ---------------------------------------------------------------------------
// deactivateEmployee — soft delete (set deletedAt + status to resigned)
// ---------------------------------------------------------------------------
export async function deactivateEmployee(employeeId: string) {
  const user = await requirePermission("employees", "delete");

  const [existing] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), isNull(employees.deletedAt)))
    .limit(1);

  if (!existing) throw new Error("Employee not found");

  await db
    .update(employees)
    .set({
      deletedAt: new Date(),
      status: "resigned",
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));

  await auditLog({
    userId: user.id,
    action: "delete",
    table: "employees",
    recordId: employeeId,
    oldValues: { status: existing.status },
    newValues: { status: "resigned", deletedAt: new Date().toISOString() },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
}

// ---------------------------------------------------------------------------
// uploadDocument — upload to Supabase Storage; returns signed download URL
// ---------------------------------------------------------------------------
export type DocumentUploadResult = {
  storagePath: string;
  publicUrl: string;
};

export async function uploadDocument(
  employeeId: string,
  fileName: string,
  fileBase64: string,
  mimeType: string,
): Promise<DocumentUploadResult> {
  await requirePermission("employees", "edit");

  const supabase = supabaseAdmin;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `employees/${employeeId}/${Date.now()}_${safeName}`;

  // Decode base64 to Uint8Array
  const binaryStr = atob(fileBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from("employee-documents")
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Document upload failed: ${error.message}`);
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("employee-documents")
    .createSignedUrl(storagePath, 3600);

  if (signedError || !signedData) {
    throw new Error(
      `Failed to generate signed URL: ${signedError?.message ?? "unknown error"}`,
    );
  }

  return {
    storagePath,
    publicUrl: signedData.signedUrl,
  };
}

// ---------------------------------------------------------------------------
// bulkDeactivate — deactivate multiple employees at once
// ---------------------------------------------------------------------------
export async function bulkDeactivate(employeeIds: string[]) {
  if (employeeIds.length === 0) return { deactivated: 0 };

  const user = await requirePermission("employees", "delete");

  for (const id of employeeIds) {
    await db
      .update(employees)
      .set({ deletedAt: new Date(), status: "resigned", updatedAt: new Date() })
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)));
  }

  await auditLog({
    userId: user.id,
    action: "delete",
    table: "employees",
    recordId: "bulk",
    newValues: { employeeIds, status: "resigned" },
  });

  revalidatePath("/employees");
  return { deactivated: employeeIds.length };
}
