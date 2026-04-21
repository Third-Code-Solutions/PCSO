-- Org profile — single source of truth for agency identity (PRD §P0 P0-001)
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.org_profile (
  id                     varchar(40) PRIMARY KEY,
  agency_name            varchar(200) NOT NULL,
  agency_short_name      varchar(40) NOT NULL,
  agency_address         text NOT NULL,
  logo_url               varchar(500) NOT NULL,
  bir_tin                varchar(30),
  bir_agency_name        varchar(200),
  philhealth_employer_no varchar(30),
  pagibig_employer_no    varchar(30),
  gsis_agency_name       varchar(200),
  gsis_employer_no       varchar(30),
  contact_email          varchar(200),
  contact_phone          varchar(40),
  website_url            varchar(200),
  tagline                varchar(300),
  copyright_holder       varchar(200),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.org_profile (
  id, agency_name, agency_short_name, agency_address, logo_url,
  bir_tin, bir_agency_name, philhealth_employer_no, pagibig_employer_no,
  gsis_agency_name, gsis_employer_no,
  contact_email, contact_phone, website_url,
  tagline, copyright_holder
) VALUES (
  'default',
  'Philippine Charity Sweepstakes Office',
  'PCSO',
  '605 Conservatory Building, Sun Plaza Complex, 1502 Shaw Boulevard, Mandaluyong City, Metro Manila',
  '/logos/pcso.svg',
  '000-000-000-000',                                     -- TODO: PCSO admin to supply real TIN
  'Philippine Charity Sweepstakes Office',
  '000000000000',                                        -- TODO: PCSO PhilHealth employer number
  '000000000000',                                        -- TODO: PCSO Pag-IBIG employer number
  'Philippine Charity Sweepstakes Office',
  '000000000000',                                        -- TODO: PCSO GSIS employer number
  'hr@pcso.gov.ph',
  '+63 2 8846 8000',
  'https://www.pcso.gov.ph',
  'Serving the Filipino people through charity, responsible gaming, and transparent governance.',
  'Philippine Charity Sweepstakes Office'
)
ON CONFLICT (id) DO UPDATE SET
  agency_name       = EXCLUDED.agency_name,
  agency_short_name = EXCLUDED.agency_short_name,
  agency_address    = EXCLUDED.agency_address,
  logo_url          = EXCLUDED.logo_url,
  bir_agency_name   = EXCLUDED.bir_agency_name,
  gsis_agency_name  = EXCLUDED.gsis_agency_name,
  contact_email     = EXCLUDED.contact_email,
  contact_phone     = EXCLUDED.contact_phone,
  website_url       = EXCLUDED.website_url,
  tagline           = EXCLUDED.tagline,
  copyright_holder  = EXCLUDED.copyright_holder,
  updated_at        = now();
