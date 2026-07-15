/**
 * /api/documents/appointment/[id]/[doc] — on-demand renderer for the RPM-022
 * appointment package PDFs (CSC Appointment, Position Description, Oath of
 * Office, Assumption to Duty, ATAF).
 *
 * `generateAppointmentDocuments` stores URLs of the form
 *   /api/documents/appointment/<appointmentId>/<docType>.pdf
 * against each appointment. Previously no route served them, so every download
 * 404'd. This handler renders the requested document from the live appointment
 * / applicant / position / office records, authorization-gated to `employees`
 * viewers (the appointment package is HR-issued).
 */

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointments,
  applications,
  applicants,
} from "@/lib/db/schema/recruitment";
import { plantillaPositions } from "@/lib/db/schema/plantilla";
import { offices } from "@/lib/db/schema/offices";
import { employees } from "@/lib/db/schema/employees";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { CscAppointmentPdf } from "@/components/pdf/csc-appointment";
import { OathOfOfficePdf } from "@/components/pdf/oath-of-office";
import { AssumptionDutyPdf } from "@/components/pdf/assumption-duty";
import { PositionDescriptionPdf } from "@/components/pdf/position-description";
import { AtafPdf } from "@/components/pdf/ataf";

export const dynamic = "force-dynamic";

const DOC_TYPES = new Set([
  "csc_appointment",
  "position_description",
  "oath_of_office",
  "assumption_to_duty",
  "ataf",
]);

/** Signature lines are left blank — authenticity rides on the wet/e-signature. */
const SIGNATORY = (role: string) => ({
  name: "________________________",
  role,
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; doc: string }> },
) {
  const { id, doc } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(user.role, "employees", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docType = doc.replace(/\.pdf$/i, "");
  if (!DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 404 },
    );
  }

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  if (!appointment) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
  }

  const [application] = await db
    .select({ applicantId: applications.applicantId })
    .from(applications)
    .where(eq(applications.id, appointment.applicationId))
    .limit(1);
  const [applicant] = application
    ? await db
        .select({
          firstName: applicants.firstName,
          middleName: applicants.middleName,
          lastName: applicants.lastName,
        })
        .from(applicants)
        .where(eq(applicants.id, application.applicantId))
        .limit(1)
    : [undefined];
  if (!applicant) {
    return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  }

  const [position] = await db
    .select({ positionTitle: plantillaPositions.positionTitle })
    .from(plantillaPositions)
    .where(eq(plantillaPositions.id, appointment.positionId))
    .limit(1);
  const [office] = await db
    .select({ name: offices.name })
    .from(offices)
    .where(eq(offices.id, appointment.officeId))
    .limit(1);

  // Employee number is assigned at provisioning; show "PENDING" pre-assumption.
  let employeeNo = "PENDING";
  if (appointment.provisionedEmployeeId) {
    const [emp] = await db
      .select({ employeeNo: employees.employeeNo })
      .from(employees)
      .where(eq(employees.id, appointment.provisionedEmployeeId))
      .limit(1);
    if (emp?.employeeNo) employeeNo = emp.employeeNo;
  }

  const fullName = [
    applicant.firstName,
    applicant.middleName,
    applicant.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const positionTitle = position?.positionTitle ?? "N/A";
  const officeName = office?.name ?? "N/A";
  const serialNumber = appointment.appointmentNumber;
  const salaryGrade = appointment.salaryGrade;
  const step = appointment.stepIncrement ?? 1;
  const effectiveDate = appointment.effectiveDate;
  const itemNumber = appointment.itemNumber ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @react-pdf element types are module-scoped
  let element: any;
  switch (docType) {
    case "csc_appointment":
      element = CscAppointmentPdf({
        serialNumber,
        appointee: { fullName, employeeNo },
        positionTitle,
        itemNumber,
        salaryGrade,
        step,
        monthlySalary: String(appointment.monthlySalary),
        office: officeName,
        appointmentType: appointment.appointmentType,
        effectiveDate,
        signatories: [SIGNATORY("Appointing Authority")],
      });
      break;
    case "position_description":
      element = PositionDescriptionPdf({
        serialNumber,
        positionTitle,
        itemNumber,
        salaryGrade,
        office: officeName,
        reportsTo: "As per organizational structure",
        incumbent: fullName,
        duties: [],
        qualifications: {
          education: "As per CSC Qualification Standards",
          training: "As per CSC Qualification Standards",
          experience: "As per CSC Qualification Standards",
          eligibility: "As per CSC Qualification Standards",
        },
        signatories: [
          SIGNATORY("Appointing Authority"),
          SIGNATORY("Office Head"),
        ],
      });
      break;
    case "oath_of_office":
      element = OathOfOfficePdf({
        serialNumber,
        appointeeName: fullName,
        positionTitle,
        office: officeName,
        oathDate: effectiveDate,
        administeringOfficer: SIGNATORY("Administering Officer"),
      });
      break;
    case "assumption_to_duty":
      element = AssumptionDutyPdf({
        serialNumber,
        appointee: {
          fullName,
          employeeNo,
          positionTitle,
          salaryGrade,
          step,
          office: officeName,
        },
        assumptionDate: effectiveDate,
        attestedBy: SIGNATORY("Office Head"),
      });
      break;
    case "ataf":
      element = AtafPdf({
        serialNumber,
        appointee: { fullName, employeeNo, positionTitle },
        assignment: {
          office: officeName,
          effectiveDate,
          natureOfMovement: "new_appointment",
        },
        appointingAuthority: SIGNATORY("Appointing Authority"),
        officeHead: SIGNATORY("Office Head"),
      });
      break;
    default:
      return NextResponse.json(
        { error: "Unknown document type" },
        { status: 404 },
      );
  }

  const buffer = await renderToBuffer(element);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${serialNumber}_${docType}.pdf"`,
    },
  });
}
