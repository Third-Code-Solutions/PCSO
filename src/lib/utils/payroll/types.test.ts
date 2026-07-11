import { describe, it, expect } from "vitest";
import {
  isRegularEmployee,
  isJobOrderOrCOS,
  type AppointmentType,
} from "./types";

describe("appointment-type benefit gates (fail-safe allowlist)", () => {
  const ORGANIC: AppointmentType[] = [
    "permanent",
    "temporary",
    "coterminous",
    "casual",
  ];
  const NON_ORGANIC: AppointmentType[] = [
    "job_order",
    "contract_of_service",
    "confidential_agent",
  ];

  it("treats the four organic types as regular (benefit-eligible)", () => {
    for (const t of ORGANIC) {
      expect(isRegularEmployee(t)).toBe(true);
      expect(isJobOrderOrCOS(t)).toBe(false);
    }
  });

  it("treats JO / COS / confidential agent as non-organic (no benefits)", () => {
    for (const t of NON_ORGANIC) {
      expect(isRegularEmployee(t)).toBe(false);
      expect(isJobOrderOrCOS(t)).toBe(true);
    }
  });

  it("fails SAFE for any future non-organic enum value (allowlist, not denylist)", () => {
    // A newly-added enum value not yet whitelisted must be treated as
    // non-organic (no mandatory-benefit deductions, bonuses, RATA, etc.).
    const future = "consultant" as AppointmentType;
    expect(isRegularEmployee(future)).toBe(false);
    expect(isJobOrderOrCOS(future)).toBe(true);
  });

  it("isRegularEmployee and isJobOrderOrCOS are exact complements", () => {
    for (const t of [...ORGANIC, ...NON_ORGANIC]) {
      expect(isRegularEmployee(t)).toBe(!isJobOrderOrCOS(t));
    }
  });
});
