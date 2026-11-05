import { describe, expect, it } from "vitest";
import { promotionUpdate, type AppointmentIssueInput } from "./auto-provision";

const input: AppointmentIssueInput = {
  applicationId: "00000000-0000-0000-0000-000000000001",
  positionId: "00000000-0000-0000-0000-000000000002",
  officeId: "00000000-0000-0000-0000-000000000003",
  itemNumber: "PCSO-ITEM-001",
  salaryGrade: 18,
  stepIncrement: 1,
  appointmentType: "permanent",
  effectiveDate: "2026-12-01",
  positionTitle: "Administrative Officer V",
  appointingAuthorityEmployeeId: "00000000-0000-0000-0000-000000000004",
  existingEmployeeId: "00000000-0000-0000-0000-000000000005",
  issuedByUserId: "00000000-0000-0000-0000-000000000006",
  applicant: {
    firstName: "Juan",
    lastName: "Dela Cruz",
    birthDate: "1985-04-12",
    gender: "male",
    civilStatus: "married",
  },
};

describe("promotionUpdate", () => {
  it("restarts the step-increment clock at the promotion's effective date", () => {
    const update = promotionUpdate(input);
    expect(update.dateLastPromotion).toBe("2026-12-01");
    expect(update.dateLastIncrement).toBe("2026-12-01");
  });

  it("takes SG, step, position and office from the appointment", () => {
    expect(promotionUpdate(input)).toMatchObject({
      salaryGrade: 18,
      step: 1,
      positionTitle: "Administrative Officer V",
      officeId: input.officeId,
      appointmentType: "permanent",
    });
  });
});
