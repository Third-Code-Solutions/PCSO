/**
 * CSC Leave Types per the Omnibus Rules on Leave (CSC MC No. 41 s. 1998)
 * and subsequent amendments (EO 292, RA 9710, RA 8187, RA 11210, RA 11861, etc.)
 */

export interface LeaveTypeSeed {
  code: string;
  name: string;
  maxDays: string | null;
  isWithPay: boolean;
  cscBasis: string;
}

export function buildLeaveTypeSeeds(): LeaveTypeSeed[] {
  return [
    {
      code: 'VL',
      name: 'Vacation Leave',
      maxDays: null, // Accrues 1.25 days/month; no hard maximum for filing
      isWithPay: true,
      cscBasis:
        'Omnibus Rules on Leave, Rule V — Vacation Leave; accrual: 1.25 days/month (15 days/year)',
    },
    {
      code: 'SL',
      name: 'Sick Leave',
      maxDays: null, // Accrues 1.25 days/month; no hard maximum for filing
      isWithPay: true,
      cscBasis:
        'Omnibus Rules on Leave, Rule VI — Sick Leave; accrual: 1.25 days/month (15 days/year)',
    },
    {
      code: 'ML',
      name: 'Maternity Leave',
      maxDays: '105.000',
      isWithPay: true,
      cscBasis:
        'RA 11210 — 105-Day Expanded Maternity Leave Law; additional 30 days without pay',
    },
    {
      code: 'PAL',
      name: 'Paternity Leave',
      maxDays: '7.000',
      isWithPay: true,
      cscBasis: 'RA 8187 — Paternity Leave Act of 1996; 7 working days',
    },
    {
      code: 'SPL',
      name: 'Special Privilege Leave',
      maxDays: '3.000',
      isWithPay: true,
      cscBasis:
        'CSC Resolution No. 1200494; 3 days per year for personal milestone events',
    },
    {
      code: 'SLB',
      name: 'Solo Parent Leave',
      maxDays: '7.000',
      isWithPay: true,
      cscBasis: 'RA 8972 — Solo Parents Welfare Act; 7 working days per year',
    },
    {
      code: 'VAWC',
      name: 'Leave for Victims of Violence Against Women and their Children',
      maxDays: '10.000',
      isWithPay: true,
      cscBasis: 'RA 9262 — Anti-VAWC Act; 10 days paid leave',
    },
    {
      code: 'SLML',
      name: 'Special Leave Benefit for Women (Gynecological Leave)',
      maxDays: '60.000',
      isWithPay: true,
      cscBasis:
        'RA 9710 — Magna Carta of Women; up to 2 months with pay for surgery due to gynecological disorders',
    },
    {
      code: 'SLBD',
      name: 'Special Leave for Victims of Natural Disaster or Calamity',
      maxDays: null,
      isWithPay: false,
      cscBasis: 'CSC MC No. 14 s. 1999; without pay, subject to CSC guidelines',
    },
    {
      code: 'RL',
      name: 'Rehabilitation Leave',
      maxDays: null,
      isWithPay: true,
      cscBasis:
        'Omnibus Rules, Rule X — for injuries or illness in line of duty; up to 6 months at full pay',
    },
    {
      code: 'AL',
      name: 'Adoption Leave',
      maxDays: null,
      isWithPay: true,
      cscBasis: 'RA 8552 — Domestic Adoption Act; 30 days',
    },
    {
      code: 'ML_PT',
      name: 'Maternity Leave — Miscarriage / Emergency Termination',
      maxDays: '60.000',
      isWithPay: true,
      cscBasis: 'RA 11210, Sec. 4(b) — 60 days for miscarriage or emergency termination',
    },
    {
      code: 'TA',
      name: 'Terminal Leave',
      maxDays: null,
      isWithPay: true,
      cscBasis:
        'Omnibus Rules, Rule XVI — commutation of leave credits upon separation/retirement',
    },
    {
      code: 'FOL',
      name: 'Force Majeure / Emergency Leave',
      maxDays: '5.000',
      isWithPay: true,
      cscBasis:
        'CSC Memorandum Circular; up to 5 days chargeable to VL or SL',
    },
    {
      code: 'PL',
      name: 'Parental Leave for Solo Parents',
      maxDays: '7.000',
      isWithPay: true,
      cscBasis: 'RA 11861 — Expanded Solo Parents Welfare Act (2022); 7 working days',
    },
  ];
}
