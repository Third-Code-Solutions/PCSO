import { describe, it, expect } from 'vitest';
import {
  EmployeePersonalSchema,
  EmployeeEmploymentSchema,
  EmployeeGovIdsSchema,
  EmployeeSchema,
} from './employees';

// ---------------------------------------------------------------------------
// Personal schema
// ---------------------------------------------------------------------------
describe('EmployeePersonalSchema', () => {
  const validPersonal = {
    firstName: 'Juan',
    lastName: 'dela Cruz',
    birthDate: '1985-03-15',
    gender: 'male' as const,
    civilStatus: 'single' as const,
    nationality: 'Filipino',
  };

  it('accepts a minimal valid personal record', () => {
    const result = EmployeePersonalSchema.safeParse(validPersonal);
    expect(result.success).toBe(true);
  });

  it('rejects missing firstName', () => {
    const result = EmployeePersonalSchema.safeParse({ ...validPersonal, firstName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('firstName');
    }
  });

  it('rejects missing lastName', () => {
    const result = EmployeePersonalSchema.safeParse({ ...validPersonal, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid gender value', () => {
    const result = EmployeePersonalSchema.safeParse({ ...validPersonal, gender: 'other' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid civil status', () => {
    const result = EmployeePersonalSchema.safeParse({
      ...validPersonal,
      civilStatus: 'divorced',
    });
    expect(result.success).toBe(false);
  });

  describe('phone validation', () => {
    it('accepts +63 format', () => {
      const result = EmployeePersonalSchema.safeParse({
        ...validPersonal,
        phone: '+639171234567',
      });
      expect(result.success).toBe(true);
    });

    it('accepts 09 format', () => {
      const result = EmployeePersonalSchema.safeParse({
        ...validPersonal,
        phone: '09171234567',
      });
      expect(result.success).toBe(true);
    });

    it('rejects landline format', () => {
      const result = EmployeePersonalSchema.safeParse({
        ...validPersonal,
        phone: '028123456',
      });
      expect(result.success).toBe(false);
    });

    it('rejects incomplete mobile number', () => {
      const result = EmployeePersonalSchema.safeParse({
        ...validPersonal,
        phone: '0917123',
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty string for optional phone', () => {
      const result = EmployeePersonalSchema.safeParse({ ...validPersonal, phone: '' });
      expect(result.success).toBe(true);
    });
  });

  it('accepts optional fields when omitted', () => {
    const result = EmployeePersonalSchema.safeParse(validPersonal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.middleName).toBeUndefined();
      expect(result.data.suffix).toBeUndefined();
      expect(result.data.religion).toBeUndefined();
    }
  });

  it('defaults nationality to Filipino when not provided', () => {
    const { nationality: _n, ...withoutNationality } = validPersonal;
    const result = EmployeePersonalSchema.safeParse(withoutNationality);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nationality).toBe('Filipino');
    }
  });
});

// ---------------------------------------------------------------------------
// Employment schema
// ---------------------------------------------------------------------------
describe('EmployeeEmploymentSchema', () => {
  const validEmployment = {
    appointmentType: 'permanent' as const,
    positionTitle: 'Administrative Officer III',
    salaryGrade: 15,
    step: 1,
    officeId: '123e4567-e89b-12d3-a456-426614174000',
    dateHired: '2020-01-15',
    dateRegularized: '2021-01-15',
    status: 'active' as const,
  };

  it('accepts a valid permanent employment record', () => {
    const result = EmployeeEmploymentSchema.safeParse(validEmployment);
    expect(result.success).toBe(true);
  });

  it('rejects salary grade below 1', () => {
    const result = EmployeeEmploymentSchema.safeParse({ ...validEmployment, salaryGrade: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects salary grade above 33', () => {
    const result = EmployeeEmploymentSchema.safeParse({ ...validEmployment, salaryGrade: 34 });
    expect(result.success).toBe(false);
  });

  it('rejects step below 1', () => {
    const result = EmployeeEmploymentSchema.safeParse({ ...validEmployment, step: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects step above 8', () => {
    const result = EmployeeEmploymentSchema.safeParse({ ...validEmployment, step: 9 });
    expect(result.success).toBe(false);
  });

  it('requires dateRegularized for permanent appointment', () => {
    const { dateRegularized: _d, ...withoutDate } = validEmployment;
    const result = EmployeeEmploymentSchema.safeParse(withoutDate);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('dateRegularized');
    }
  });

  it('does not require dateRegularized for casual appointment', () => {
    const { dateRegularized: _d, ...withoutDate } = validEmployment;
    const result = EmployeeEmploymentSchema.safeParse({
      ...withoutDate,
      appointmentType: 'casual',
    });
    expect(result.success).toBe(true);
  });

  it('does not require dateRegularized for job_order appointment', () => {
    const { dateRegularized: _d, ...withoutDate } = validEmployment;
    const result = EmployeeEmploymentSchema.safeParse({
      ...withoutDate,
      appointmentType: 'job_order',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing positionTitle', () => {
    const result = EmployeeEmploymentSchema.safeParse({
      ...validEmployment,
      positionTitle: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid officeId (not uuid)', () => {
    const result = EmployeeEmploymentSchema.safeParse({
      ...validEmployment,
      officeId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('defaults status to active', () => {
    const { status: _s, ...withoutStatus } = validEmployment;
    const result = EmployeeEmploymentSchema.safeParse(withoutStatus);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
    }
  });

  it('accepts contract_of_service appointment type', () => {
    const { dateRegularized: _d, ...withoutDate } = validEmployment;
    const result = EmployeeEmploymentSchema.safeParse({
      ...withoutDate,
      appointmentType: 'contract_of_service',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Government IDs schema
// ---------------------------------------------------------------------------
describe('EmployeeGovIdsSchema', () => {
  it('accepts all empty strings — all IDs are optional', () => {
    const result = EmployeeGovIdsSchema.safeParse({
      tin: '',
      gsisNo: '',
      philhealthNo: '',
      pagibigNo: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty object — all fields optional', () => {
    const result = EmployeeGovIdsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a valid TIN', () => {
    const result = EmployeeGovIdsSchema.safeParse({ tin: '123-456-789-012' });
    expect(result.success).toBe(true);
  });

  it('rejects TIN without dashes', () => {
    const result = EmployeeGovIdsSchema.safeParse({ tin: '123456789012' });
    expect(result.success).toBe(false);
  });

  it('rejects TIN with wrong dash positions', () => {
    const result = EmployeeGovIdsSchema.safeParse({ tin: '12-3456-789-012' });
    expect(result.success).toBe(false);
  });

  it('accepts valid 11-digit GSIS number', () => {
    const result = EmployeeGovIdsSchema.safeParse({ gsisNo: '12345678901' });
    expect(result.success).toBe(true);
  });

  it('rejects GSIS number with 10 digits', () => {
    const result = EmployeeGovIdsSchema.safeParse({ gsisNo: '1234567890' });
    expect(result.success).toBe(false);
  });

  it('rejects GSIS number with 12 digits', () => {
    const result = EmployeeGovIdsSchema.safeParse({ gsisNo: '123456789012' });
    expect(result.success).toBe(false);
  });

  it('accepts valid 12-digit PhilHealth number', () => {
    const result = EmployeeGovIdsSchema.safeParse({ philhealthNo: '123456789012' });
    expect(result.success).toBe(true);
  });

  it('rejects PhilHealth number with 11 digits', () => {
    const result = EmployeeGovIdsSchema.safeParse({ philhealthNo: '12345678901' });
    expect(result.success).toBe(false);
  });

  it('accepts valid 12-digit Pag-IBIG number', () => {
    const result = EmployeeGovIdsSchema.safeParse({ pagibigNo: '123456789012' });
    expect(result.success).toBe(true);
  });

  it('rejects Pag-IBIG number with 13 digits', () => {
    const result = EmployeeGovIdsSchema.safeParse({ pagibigNo: '1234567890123' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Composite EmployeeSchema
// ---------------------------------------------------------------------------
describe('EmployeeSchema (composite)', () => {
  const validFull = {
    firstName: 'Maria',
    lastName: 'Santos',
    birthDate: '1990-06-20',
    gender: 'female' as const,
    civilStatus: 'married' as const,
    nationality: 'Filipino',
    appointmentType: 'permanent' as const,
    positionTitle: 'Senior Legislative Staff Officer',
    salaryGrade: 22,
    step: 3,
    officeId: '123e4567-e89b-12d3-a456-426614174000',
    dateHired: '2015-08-01',
    dateRegularized: '2016-08-01',
    status: 'active' as const,
    tin: '987-654-321-000',
    gsisNo: '98765432100',
    philhealthNo: '987654321000',
    pagibigNo: '987654321000',
  };

  it('accepts a complete valid employee record', () => {
    const result = EmployeeSchema.safeParse(validFull);
    expect(result.success).toBe(true);
  });

  it('rejects when both personal and employment fields are invalid', () => {
    const result = EmployeeSchema.safeParse({
      ...validFull,
      firstName: '',
      salaryGrade: 99,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('accepts JO employee without dateRegularized', () => {
    const { dateRegularized: _d, ...withoutDate } = validFull;
    const result = EmployeeSchema.safeParse({
      ...withoutDate,
      appointmentType: 'job_order',
    });
    expect(result.success).toBe(true);
  });
});
