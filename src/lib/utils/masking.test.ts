import { describe, it, expect } from "vitest";
import {
  maskValue,
  maskTin,
  maskGsis,
  maskPhilhealth,
  maskPagibig,
  maskSss,
  maskBankAccount,
  maskEmail,
  maskEmployeeSensitiveFields,
} from "./masking";

describe("maskValue", () => {
  it("masks all but the last 4 alphanumerics, preserving separators", () => {
    expect(maskValue("123-456-1234")).toBe("***-***-1234");
  });

  it("preserves dots and slashes as separators", () => {
    expect(maskValue("12.34/5678")).toBe("**.**/5678");
  });

  it("masks the ENTIRE value when it has 4 or fewer alphanumerics", () => {
    expect(maskValue("1234")).toBe("****");
    expect(maskValue("12-34")).toBe("**-**");
  });

  it("returns null for null, undefined, and blank strings", () => {
    expect(maskValue(null)).toBeNull();
    expect(maskValue(undefined)).toBeNull();
    expect(maskValue("   ")).toBeNull();
  });

  it("respects a custom visible count", () => {
    expect(maskValue("ABCDEFGH", 2)).toBe("******GH");
  });

  it("never reveals more characters than exist", () => {
    expect(maskValue("12345", 4)).toBe("*2345");
  });
});

describe("ID-specific maskers", () => {
  it("maskTin keeps the last 4 digits", () => {
    expect(maskTin("123-456-789-000")).toBe("***-***-**9-000");
    expect(maskTin("123-456-1234")).toBe("***-***-1234");
  });

  it("maskGsis keeps the last 4 digits of an 11-digit BP number", () => {
    expect(maskGsis("12345678901")).toBe("*******8901");
  });

  it("maskPhilhealth keeps the last 4 digits", () => {
    expect(maskPhilhealth("12-345678901-2")).toBe("**-******901-2");
  });

  it("maskPagibig keeps the last 4 digits", () => {
    expect(maskPagibig("1234-5678-9012")).toBe("****-****-9012");
  });

  it("maskSss keeps the last 4 digits", () => {
    expect(maskSss("34-5678901-2")).toBe("**-****901-2");
  });

  it("maskBankAccount keeps the last 4 digits", () => {
    expect(maskBankAccount("001234567890")).toBe("********7890");
  });

  it("all ID maskers pass through null", () => {
    expect(maskTin(null)).toBeNull();
    expect(maskGsis(undefined)).toBeNull();
    expect(maskPhilhealth("")).toBeNull();
    expect(maskPagibig(null)).toBeNull();
    expect(maskSss(null)).toBeNull();
    expect(maskBankAccount(null)).toBeNull();
  });
});

describe("maskEmail", () => {
  it("keeps the first local character and the full domain", () => {
    expect(maskEmail("nicole@pcso.gov.ph")).toBe("n*****@pcso.gov.ph");
  });

  it("pads very short local parts so length is not leaked", () => {
    expect(maskEmail("a@pcso.gov.ph")).toBe("a**@pcso.gov.ph");
  });

  it("falls back to suffix masking for values without @", () => {
    expect(maskEmail("not-an-email")).toBe("***-**-**ail");
  });

  it("passes through nullish values", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("  ")).toBeNull();
  });
});

describe("maskEmployeeSensitiveFields", () => {
  const employee = {
    id: "emp-1",
    firstName: "Juan",
    tin: "123-456-789-000",
    gsisNo: "12345678901",
    philhealthNo: "12-345678901-2",
    pagibigNo: "1234-5678-9012",
    sssNo: null as string | null,
    bankAccountNumber: "001234567890",
  };

  it("returns the SAME object untouched when canViewFull is true", () => {
    const result = maskEmployeeSensitiveFields(employee, true);
    expect(result).toBe(employee);
    expect(result.tin).toBe("123-456-789-000");
  });

  it("returns a NEW object with masked IDs when canViewFull is false", () => {
    const result = maskEmployeeSensitiveFields(employee, false);
    expect(result).not.toBe(employee);
    expect(result.tin).toBe("***-***-**9-000");
    expect(result.gsisNo).toBe("*******8901");
    expect(result.philhealthNo).toBe("**-******901-2");
    expect(result.pagibigNo).toBe("****-****-9012");
    expect(result.bankAccountNumber).toBe("********7890");
  });

  it("does not mutate the original object", () => {
    maskEmployeeSensitiveFields(employee, false);
    expect(employee.tin).toBe("123-456-789-000");
    expect(employee.gsisNo).toBe("12345678901");
  });

  it("leaves non-sensitive fields alone and null IDs as null", () => {
    const result = maskEmployeeSensitiveFields(employee, false);
    expect(result.firstName).toBe("Juan");
    expect(result.sssNo).toBeNull();
  });

  it("only touches fields present on the input (narrow projections)", () => {
    const narrow = { id: "x", gsisNo: "12345678901" };
    const result = maskEmployeeSensitiveFields(narrow, false);
    expect(result).toEqual({ id: "x", gsisNo: "*******8901" });
    expect(Object.keys(result)).toEqual(["id", "gsisNo"]);
  });
});
