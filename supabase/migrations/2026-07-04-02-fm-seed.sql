-- FM reference data seed — TOR §1.1. Idempotent (ON CONFLICT DO NOTHING).
-- Codes are stable identifiers; HR Admins extend via /admin/file-maintenance.

-- ─── 1.1.31 Regions (17) ─────────────────────────────────────────────────────
INSERT INTO public.fm_regions (code, name, roman_numeral) VALUES
  ('NCR',      'National Capital Region', 'NCR'),
  ('CAR',      'Cordillera Administrative Region', 'CAR'),
  ('R01',      'Ilocos Region', 'I'),
  ('R02',      'Cagayan Valley', 'II'),
  ('R03',      'Central Luzon', 'III'),
  ('R04A',     'CALABARZON', 'IV-A'),
  ('R04B',     'MIMAROPA', 'IV-B'),
  ('R05',      'Bicol Region', 'V'),
  ('R06',      'Western Visayas', 'VI'),
  ('R07',      'Central Visayas', 'VII'),
  ('R08',      'Eastern Visayas', 'VIII'),
  ('R09',      'Zamboanga Peninsula', 'IX'),
  ('R10',      'Northern Mindanao', 'X'),
  ('R11',      'Davao Region', 'XI'),
  ('R12',      'SOCCSKSARGEN', 'XII'),
  ('R13',      'Caraga', 'XIII'),
  ('BARMM',    'Bangsamoro Autonomous Region in Muslim Mindanao', 'BARMM')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.31 Provinces (82) ───────────────────────────────────────────────────
INSERT INTO public.fm_provinces (code, name, region_code) VALUES
  ('ILN', 'Ilocos Norte', 'R01'), ('ILS', 'Ilocos Sur', 'R01'),
  ('LUN', 'La Union', 'R01'), ('PAN', 'Pangasinan', 'R01'),
  ('BTN', 'Batanes', 'R02'), ('CAG', 'Cagayan', 'R02'),
  ('ISA', 'Isabela', 'R02'), ('NUV', 'Nueva Vizcaya', 'R02'), ('QUI', 'Quirino', 'R02'),
  ('AUR', 'Aurora', 'R03'), ('BAN', 'Bataan', 'R03'), ('BUL', 'Bulacan', 'R03'),
  ('NUE', 'Nueva Ecija', 'R03'), ('PAM', 'Pampanga', 'R03'),
  ('TAR', 'Tarlac', 'R03'), ('ZMB', 'Zambales', 'R03'),
  ('BTG', 'Batangas', 'R04A'), ('CAV', 'Cavite', 'R04A'), ('LAG', 'Laguna', 'R04A'),
  ('QUE', 'Quezon', 'R04A'), ('RIZ', 'Rizal', 'R04A'),
  ('MAD', 'Marinduque', 'R04B'), ('MDC', 'Occidental Mindoro', 'R04B'),
  ('MDR', 'Oriental Mindoro', 'R04B'), ('PLW', 'Palawan', 'R04B'), ('ROM', 'Romblon', 'R04B'),
  ('ALB', 'Albay', 'R05'), ('CAN', 'Camarines Norte', 'R05'), ('CAS', 'Camarines Sur', 'R05'),
  ('CAT', 'Catanduanes', 'R05'), ('MAS', 'Masbate', 'R05'), ('SOR', 'Sorsogon', 'R05'),
  ('AKL', 'Aklan', 'R06'), ('ANT', 'Antique', 'R06'), ('CAP', 'Capiz', 'R06'),
  ('GUI', 'Guimaras', 'R06'), ('ILI', 'Iloilo', 'R06'), ('NEC', 'Negros Occidental', 'R06'),
  ('BOH', 'Bohol', 'R07'), ('CEB', 'Cebu', 'R07'),
  ('NER', 'Negros Oriental', 'R07'), ('SIG', 'Siquijor', 'R07'),
  ('BIL', 'Biliran', 'R08'), ('EAS', 'Eastern Samar', 'R08'), ('LEY', 'Leyte', 'R08'),
  ('NSA', 'Northern Samar', 'R08'), ('WSA', 'Samar', 'R08'), ('SLE', 'Southern Leyte', 'R08'),
  ('ZAN', 'Zamboanga del Norte', 'R09'), ('ZAS', 'Zamboanga del Sur', 'R09'),
  ('ZSI', 'Zamboanga Sibugay', 'R09'),
  ('BUK', 'Bukidnon', 'R10'), ('CAM', 'Camiguin', 'R10'), ('LAN', 'Lanao del Norte', 'R10'),
  ('MSC', 'Misamis Occidental', 'R10'), ('MSR', 'Misamis Oriental', 'R10'),
  ('COM', 'Davao de Oro', 'R11'), ('DAV', 'Davao del Norte', 'R11'),
  ('DAS', 'Davao del Sur', 'R11'), ('DVO', 'Davao Occidental', 'R11'), ('DAO', 'Davao Oriental', 'R11'),
  ('NCO', 'Cotabato', 'R12'), ('SAR', 'Sarangani', 'R12'),
  ('SCO', 'South Cotabato', 'R12'), ('SUK', 'Sultan Kudarat', 'R12'),
  ('AGN', 'Agusan del Norte', 'R13'), ('AGS', 'Agusan del Sur', 'R13'),
  ('DIN', 'Dinagat Islands', 'R13'), ('SUN', 'Surigao del Norte', 'R13'), ('SUR', 'Surigao del Sur', 'R13'),
  ('ABR', 'Abra', 'CAR'), ('APA', 'Apayao', 'CAR'), ('BEN', 'Benguet', 'CAR'),
  ('IFU', 'Ifugao', 'CAR'), ('KAL', 'Kalinga', 'CAR'), ('MOU', 'Mountain Province', 'CAR'),
  ('BAS', 'Basilan', 'BARMM'), ('LAS', 'Lanao del Sur', 'BARMM'),
  ('MGN', 'Maguindanao del Norte', 'BARMM'), ('MGS', 'Maguindanao del Sur', 'BARMM'),
  ('SLU', 'Sulu', 'BARMM'), ('TAW', 'Tawi-Tawi', 'BARMM')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.21 Ethnic groups (major NSO groups; extend via FM UI) ───────────────
INSERT INTO public.fm_ethnic_groups (code, name, major_group) VALUES
  ('TAG', 'Tagalog', 'Tagalog'), ('CEB', 'Cebuano', 'Bisaya'),
  ('ILO', 'Ilocano', 'Ilocano'), ('BIS', 'Bisaya/Binisaya', 'Bisaya'),
  ('HIL', 'Hiligaynon/Ilonggo', 'Bisaya'), ('BIK', 'Bikolano', 'Bikol'),
  ('WAR', 'Waray', 'Bisaya'), ('KAP', 'Kapampangan', 'Kapampangan'),
  ('PAN', 'Pangasinense', 'Pangasinan'), ('MRW', 'Maranao', 'Moro'),
  ('MGD', 'Maguindanaon', 'Moro'), ('TSG', 'Tausug', 'Moro'),
  ('YKN', 'Yakan', 'Moro'), ('SML', 'Sama', 'Moro'), ('BJU', 'Badjao', 'Moro'),
  ('IBG', 'Ibanag', 'Cagayan Valley'), ('IVT', 'Ivatan', 'Batanes'),
  ('KNK', 'Kankanaey', 'Igorot'), ('IBL', 'Ibaloi', 'Igorot'),
  ('KLG', 'Kalinga', 'Igorot'), ('IFG', 'Ifugao', 'Igorot'),
  ('BON', 'Bontok', 'Igorot'), ('AET', 'Aeta', 'Negrito'),
  ('MNB', 'Manobo', 'Lumad'), ('TBL', 'T''boli', 'Lumad'),
  ('BLA', 'B''laan', 'Lumad'), ('SUB', 'Subanen', 'Lumad'),
  ('HIG', 'Higaonon', 'Lumad'), ('BGB', 'Bagobo', 'Lumad'),
  ('MDY', 'Mandaya', 'Lumad'), ('SUR', 'Surigaonon', 'Bisaya'),
  ('CHV', 'Chavacano', 'Chavacano')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.38 Religions ────────────────────────────────────────────────────────
INSERT INTO public.fm_religions (code, name, category) VALUES
  ('RC',   'Roman Catholic', 'christian'),
  ('ISL',  'Islam', 'islam'),
  ('INC',  'Iglesia ni Cristo', 'christian'),
  ('AGL',  'Aglipayan (Philippine Independent Church)', 'christian'),
  ('SDA',  'Seventh-day Adventist', 'christian'),
  ('BAP',  'Baptist', 'christian'),
  ('MET',  'Methodist', 'christian'),
  ('BRN',  'Born Again Christian', 'christian'),
  ('EVA',  'Evangelical', 'christian'),
  ('JW',   'Jehovah''s Witnesses', 'christian'),
  ('LDS',  'Church of Jesus Christ of Latter-day Saints', 'christian'),
  ('BUD',  'Buddhist', 'buddhist'),
  ('HIN',  'Hindu', 'other'),
  ('IND',  'Indigenous Beliefs', 'indigenous'),
  ('NONE', 'None / Prefer not to say', 'other')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.37 Relationships ────────────────────────────────────────────────────
INSERT INTO public.fm_relationships (code, name, category) VALUES
  ('SPOUSE', 'Spouse', 'immediate'), ('HUSBAND', 'Husband', 'immediate'),
  ('WIFE', 'Wife', 'immediate'), ('SON', 'Son', 'immediate'),
  ('DAUGHTER', 'Daughter', 'immediate'), ('FATHER', 'Father', 'immediate'),
  ('MOTHER', 'Mother', 'immediate'), ('BROTHER', 'Brother', 'immediate'),
  ('SISTER', 'Sister', 'immediate'), ('GRANDFATHER', 'Grandfather', 'extended'),
  ('GRANDMOTHER', 'Grandmother', 'extended'), ('GRANDSON', 'Grandson', 'extended'),
  ('GRANDDAUGHTER', 'Granddaughter', 'extended'), ('UNCLE', 'Uncle', 'extended'),
  ('AUNT', 'Aunt', 'extended'), ('NEPHEW', 'Nephew', 'extended'),
  ('NIECE', 'Niece', 'extended'), ('COUSIN', 'Cousin', 'extended'),
  ('GUARDIAN', 'Legal Guardian', 'other'), ('WARD', 'Ward', 'other')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.7 Courtesy titles ───────────────────────────────────────────────────
INSERT INTO public.fm_courtesy_titles (code, name, title_type, display_order) VALUES
  ('MR',   'Mr.',   'general', 1),
  ('MS',   'Ms.',   'general', 2),
  ('MRS',  'Mrs.',  'general', 3),
  ('DR',   'Dr.',   'professional', 4),
  ('ATTY', 'Atty.', 'professional', 5),
  ('ENGR', 'Engr.', 'professional', 6),
  ('ARCH', 'Arch.', 'professional', 7),
  ('PROF', 'Prof.', 'academic', 8),
  ('HON',  'Hon.',  'general', 9),
  ('DIR',  'Dir.',  'general', 10),
  ('FR',   'Fr.',   'general', 11),
  ('SR',   'Sr.',   'general', 12)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.12 Extension names ──────────────────────────────────────────────────
INSERT INTO public.fm_extension_names (code, name, display_order) VALUES
  ('JR', 'Jr.', 1), ('SR', 'Sr.', 2), ('II', 'II', 3),
  ('III', 'III', 4), ('IV', 'IV', 5), ('V', 'V', 6)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.6 Countries (common set; extend via FM UI) ──────────────────────────
INSERT INTO public.fm_countries (code, code3, name, numeric_code) VALUES
  ('PH', 'PHL', 'Philippines', '608'), ('US', 'USA', 'United States', '840'),
  ('CA', 'CAN', 'Canada', '124'), ('AU', 'AUS', 'Australia', '036'),
  ('NZ', 'NZL', 'New Zealand', '554'), ('GB', 'GBR', 'United Kingdom', '826'),
  ('JP', 'JPN', 'Japan', '392'), ('KR', 'KOR', 'South Korea', '410'),
  ('CN', 'CHN', 'China', '156'), ('HK', 'HKG', 'Hong Kong', '344'),
  ('TW', 'TWN', 'Taiwan', '158'), ('SG', 'SGP', 'Singapore', '702'),
  ('MY', 'MYS', 'Malaysia', '458'), ('TH', 'THA', 'Thailand', '764'),
  ('VN', 'VNM', 'Vietnam', '704'), ('ID', 'IDN', 'Indonesia', '360'),
  ('BN', 'BRN', 'Brunei Darussalam', '096'), ('KH', 'KHM', 'Cambodia', '116'),
  ('LA', 'LAO', 'Laos', '418'), ('MM', 'MMR', 'Myanmar', '104'),
  ('TL', 'TLS', 'Timor-Leste', '626'), ('IN', 'IND', 'India', '356'),
  ('SA', 'SAU', 'Saudi Arabia', '682'), ('AE', 'ARE', 'United Arab Emirates', '784'),
  ('QA', 'QAT', 'Qatar', '634'), ('KW', 'KWT', 'Kuwait', '414'),
  ('BH', 'BHR', 'Bahrain', '048'), ('OM', 'OMN', 'Oman', '512'),
  ('IL', 'ISR', 'Israel', '376'), ('JO', 'JOR', 'Jordan', '400'),
  ('LB', 'LBN', 'Lebanon', '422'), ('TR', 'TUR', 'Turkey', '792'),
  ('DE', 'DEU', 'Germany', '276'), ('FR', 'FRA', 'France', '250'),
  ('IT', 'ITA', 'Italy', '380'), ('ES', 'ESP', 'Spain', '724'),
  ('PT', 'PRT', 'Portugal', '620'), ('NL', 'NLD', 'Netherlands', '528'),
  ('BE', 'BEL', 'Belgium', '056'), ('CH', 'CHE', 'Switzerland', '756'),
  ('AT', 'AUT', 'Austria', '040'), ('SE', 'SWE', 'Sweden', '752'),
  ('NO', 'NOR', 'Norway', '578'), ('DK', 'DNK', 'Denmark', '208'),
  ('FI', 'FIN', 'Finland', '246'), ('IE', 'IRL', 'Ireland', '372'),
  ('GR', 'GRC', 'Greece', '300'), ('PL', 'POL', 'Poland', '616'),
  ('RU', 'RUS', 'Russia', '643'), ('BR', 'BRA', 'Brazil', '076'),
  ('MX', 'MEX', 'Mexico', '484'), ('AR', 'ARG', 'Argentina', '032'),
  ('CL', 'CHL', 'Chile', '152'), ('ZA', 'ZAF', 'South Africa', '710'),
  ('EG', 'EGY', 'Egypt', '818'), ('NG', 'NGA', 'Nigeria', '566'),
  ('KE', 'KEN', 'Kenya', '404'), ('PG', 'PNG', 'Papua New Guinea', '598'),
  ('FJ', 'FJI', 'Fiji', '242'), ('GU', 'GUM', 'Guam', '316')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.11 Disabilities ─────────────────────────────────────────────────────
INSERT INTO public.fm_disabilities (code, name, category) VALUES
  ('VIS',  'Visual Impairment', 'sensory'),
  ('HEAR', 'Hearing Impairment', 'sensory'),
  ('SPCH', 'Speech Impairment', 'sensory'),
  ('ORTH', 'Orthopedic Disability', 'physical'),
  ('LEARN','Learning Disability', 'cognitive'),
  ('INTEL','Intellectual Disability', 'cognitive'),
  ('PSY',  'Psychosocial Disability', 'psychosocial'),
  ('CHRON','Chronic Illness', 'chronic'),
  ('MULT', 'Multiple Disabilities', 'other')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.35 Professions ──────────────────────────────────────────────────────
INSERT INTO public.fm_professions (code, name, category, requires_license) VALUES
  ('MD',    'Doctor of Medicine', 'medical', true),
  ('RN',    'Nurse', 'medical', true),
  ('RMT',   'Medical Technologist', 'medical', true),
  ('RPH',   'Pharmacist', 'medical', true),
  ('DDM',   'Dentist', 'medical', true),
  ('RMID',  'Midwife', 'medical', true),
  ('ATTY',  'Lawyer', 'legal', true),
  ('CPA',   'Accountant', 'accounting', true),
  ('CE',    'Civil Engineer', 'engineering', true),
  ('EE',    'Electrical Engineer', 'engineering', true),
  ('ME',    'Mechanical Engineer', 'engineering', true),
  ('ECE',   'Electronics Engineer', 'engineering', true),
  ('ARCH',  'Architect', 'engineering', true),
  ('LPT',   'Teacher', 'education', true),
  ('IT',    'IT Professional', 'technology', false),
  ('STAT',  'Statistician', 'science', false),
  ('ECON',  'Economist', 'science', false),
  ('CHEM',  'Chemist', 'science', true),
  ('VET',   'Veterinarian', 'medical', true),
  ('CRIM',  'Criminologist', 'public_safety', true),
  ('RSW',   'Social Worker', 'social_services', true),
  ('PSYCH', 'Psychologist', 'medical', true),
  ('LIB',   'Librarian', 'education', true),
  ('AGRI',  'Agriculturist', 'science', true)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.17 Education attainment ─────────────────────────────────────────────
INSERT INTO public.fm_education_attainment (code, name, level) VALUES
  ('ELEM',  'Elementary', 1),
  ('HS',    'High School', 2),
  ('SHS',   'Senior High School', 3),
  ('VOC',   'Vocational / Trade Course', 4),
  ('COL',   'College', 5),
  ('MAS',   'Post-Graduate (Masters)', 6),
  ('DOC',   'Doctorate', 7)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.1 Degree courses ────────────────────────────────────────────────────
INSERT INTO public.fm_degree_courses (code, name, abbreviation, field, education_level) VALUES
  ('BSIT',  'Bachelor of Science in Information Technology', 'BSIT', 'Information Technology', 'undergraduate'),
  ('BSCS',  'Bachelor of Science in Computer Science', 'BSCS', 'Information Technology', 'undergraduate'),
  ('BSA',   'Bachelor of Science in Accountancy', 'BSA', 'Accountancy', 'undergraduate'),
  ('BSBA',  'Bachelor of Science in Business Administration', 'BSBA', 'Business', 'undergraduate'),
  ('ABECON','Bachelor of Arts in Economics', 'AB Econ', 'Economics', 'undergraduate'),
  ('BSN',   'Bachelor of Science in Nursing', 'BSN', 'Health Sciences', 'undergraduate'),
  ('BSED',  'Bachelor of Secondary Education', 'BSEd', 'Education', 'undergraduate'),
  ('BEED',  'Bachelor of Elementary Education', 'BEEd', 'Education', 'undergraduate'),
  ('BSCE',  'Bachelor of Science in Civil Engineering', 'BSCE', 'Engineering', 'undergraduate'),
  ('BSEE',  'Bachelor of Science in Electrical Engineering', 'BSEE', 'Engineering', 'undergraduate'),
  ('BSME',  'Bachelor of Science in Mechanical Engineering', 'BSME', 'Engineering', 'undergraduate'),
  ('BSECE', 'Bachelor of Science in Electronics Engineering', 'BSECE', 'Engineering', 'undergraduate'),
  ('BSARCH','Bachelor of Science in Architecture', 'BS Arch', 'Architecture', 'undergraduate'),
  ('BSPSY', 'Bachelor of Science in Psychology', 'BS Psych', 'Social Sciences', 'undergraduate'),
  ('BSSW',  'Bachelor of Science in Social Work', 'BSSW', 'Social Services', 'undergraduate'),
  ('BSCRIM','Bachelor of Science in Criminology', 'BS Crim', 'Public Safety', 'undergraduate'),
  ('BSHM',  'Bachelor of Science in Hospitality Management', 'BSHM', 'Hospitality', 'undergraduate'),
  ('BSTM',  'Bachelor of Science in Tourism Management', 'BSTM', 'Tourism', 'undergraduate'),
  ('BSMT',  'Bachelor of Science in Medical Technology', 'BSMT', 'Health Sciences', 'undergraduate'),
  ('BSPHAR','Bachelor of Science in Pharmacy', 'BS Pharm', 'Health Sciences', 'undergraduate'),
  ('ABPOL', 'Bachelor of Arts in Political Science', 'AB PolSci', 'Social Sciences', 'undergraduate'),
  ('ABCOMM','Bachelor of Arts in Communication', 'AB Comm', 'Communication', 'undergraduate'),
  ('JD',    'Juris Doctor', 'JD', 'Law', 'graduate'),
  ('MD',    'Doctor of Medicine', 'MD', 'Medicine', 'graduate'),
  ('MBA',   'Master of Business Administration', 'MBA', 'Business', 'graduate'),
  ('MPA',   'Master of Public Administration', 'MPA', 'Public Administration', 'graduate'),
  ('MAED',  'Master of Arts in Education', 'MAEd', 'Education', 'graduate'),
  ('MSIT',  'Master of Science in Information Technology', 'MSIT', 'Information Technology', 'graduate'),
  ('PHD',   'Doctor of Philosophy', 'PhD', 'Various', 'postgraduate'),
  ('DPA',   'Doctor of Public Administration', 'DPA', 'Public Administration', 'postgraduate')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.48 Schools ──────────────────────────────────────────────────────────
INSERT INTO public.fm_schools (code, name, school_type) VALUES
  ('UP',    'University of the Philippines', 'suc'),
  ('PUP',   'Polytechnic University of the Philippines', 'suc'),
  ('PLM',   'Pamantasan ng Lungsod ng Maynila', 'suc'),
  ('PNU',   'Philippine Normal University', 'suc'),
  ('TUP',   'Technological University of the Philippines', 'suc'),
  ('MSU',   'Mindanao State University', 'suc'),
  ('CLSU',  'Central Luzon State University', 'suc'),
  ('BSU',   'Benguet State University', 'suc'),
  ('VSU',   'Visayas State University', 'suc'),
  ('WMSU',  'Western Mindanao State University', 'suc'),
  ('UST',   'University of Santo Tomas', 'private_hei'),
  ('DLSU',  'De La Salle University', 'private_hei'),
  ('ADMU',  'Ateneo de Manila University', 'private_hei'),
  ('FEU',   'Far Eastern University', 'private_hei'),
  ('UE',    'University of the East', 'private_hei'),
  ('NU',    'National University', 'private_hei'),
  ('MAPUA', 'Mapúa University', 'private_hei'),
  ('SBU',   'San Beda University', 'private_hei'),
  ('LYCEUM','Lyceum of the Philippines University', 'private_hei'),
  ('SU',    'Silliman University', 'private_hei'),
  ('USC',   'University of San Carlos', 'private_hei'),
  ('ADDU',  'Ateneo de Davao University', 'private_hei'),
  ('XU',    'Xavier University — Ateneo de Cagayan', 'private_hei'),
  ('TESDA', 'TESDA Accredited Institution', 'vocational')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.19 Eligibility categories ───────────────────────────────────────────
INSERT INTO public.fm_eligibility_categories (code, name, category) VALUES
  ('FIRST',  'First Level Eligibility', 'first_level'),
  ('SECOND', 'Second Level Eligibility', 'second_level'),
  ('CES',    'Career Executive Service', 'ces')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.18 Eligibilities / licenses ─────────────────────────────────────────
INSERT INTO public.fm_eligibilities (code, name, category_code, legal_basis) VALUES
  ('CSP',    'Civil Service Professional', 'second_level', 'CSC'),
  ('CSSP',   'Civil Service Sub-Professional', 'first_level', 'CSC'),
  ('RA1080', 'RA 1080 (Bar / Board Eligibility)', 'second_level', 'RA 1080'),
  ('PD907',  'PD 907 (Honor Graduate Eligibility)', 'second_level', 'PD 907'),
  ('CESE',   'Career Executive Service Eligibility', 'ces', 'CES Board'),
  ('CSEE',   'Career Service Executive Eligibility', 'ces', 'CSC'),
  ('BRGY',   'Barangay Official Eligibility', 'first_level', 'RA 7160'),
  ('EO132',  'Veteran Preference Rating', 'first_level', 'EO 132/790')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.32 / 1.1.33 Position classifications & levels ───────────────────────
INSERT INTO public.fm_position_classifications (code, name, classification_type) VALUES
  ('UNIQUE',     'Unique Position', 'unique'),
  ('CAREER',     'Career Position', 'career'),
  ('NON_CAREER', 'Non-Career Position', 'non_career')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fm_position_levels (code, name, level_type) VALUES
  ('L1',  'First Level', 'first_level'),
  ('L2',  'Second Level', 'second_level'),
  ('CES', 'Career Executive Service', 'ces')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.9 Designations ──────────────────────────────────────────────────────
INSERT INTO public.fm_designations (code, name, designation_type) VALUES
  ('OIC_DC',   'OIC — Division Chief', 'oic'),
  ('OIC_DM',   'OIC — Department Manager', 'oic'),
  ('OIC_BM',   'OIC — Branch Manager', 'oic'),
  ('ACT_DC',   'Acting Division Chief', 'acting'),
  ('ACT_DM',   'Acting Department Manager', 'acting'),
  ('DETAIL',   'Detailed Personnel', 'detail'),
  ('TEMP_ASG', 'Temporary Assignment', 'temporary')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.29 Nature of work ───────────────────────────────────────────────────
INSERT INTO public.fm_nature_of_work (code, name, category) VALUES
  ('GOV',  'Government', 'government'),
  ('PRIV', 'Private', 'private'),
  ('NGO',  'Non-Government Organization', 'ngo'),
  ('INTL', 'International Organization', 'international')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.15 / 1.1.14 Document categories & types ─────────────────────────────
INSERT INTO public.fm_document_categories (code, name) VALUES
  ('EMP',   'Employment Data'),
  ('PERS',  'Personal Data'),
  ('EDUC',  'Educational Records'),
  ('ELIG',  'Eligibility Records'),
  ('TRAIN', 'Training Records'),
  ('MED',   'Medical Records'),
  ('DISC',  'Disciplinary Records')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fm_document_types (code, name, category_code, requires_serial_number) VALUES
  ('TOR_DOC',  'Transcript of Records', 'EDUC', false),
  ('DIPLOMA',  'Diploma', 'EDUC', false),
  ('BIRTH',    'Birth Certificate', 'PERS', false),
  ('MARRIAGE', 'Marriage Contract', 'PERS', false),
  ('ELIG_CERT','Eligibility Certificate', 'ELIG', false),
  ('PDS_DOC',  'Personal Data Sheet', 'PERS', true),
  ('SALN_DOC', 'SALN', 'PERS', false),
  ('MEDCERT',  'Medical Certificate', 'MED', false),
  ('APPT',     'Appointment Paper', 'EMP', false),
  ('OATH',     'Oath of Office', 'EMP', false),
  ('ASSUME',   'Assumption of Duty', 'EMP', false),
  ('SR_DOC',   'Service Record', 'EMP', true),
  ('COE_DOC',  'Certificate of Employment', 'EMP', true),
  ('CLEAR',    'Office Clearance', 'EMP', false),
  ('TRN_CERT', 'Training Certificate', 'TRAIN', true),
  ('NBI',      'NBI Clearance', 'PERS', false)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.10 / 1.1.39 Document request types & statuses ───────────────────────
INSERT INTO public.fm_document_request_types (code, name, processing_days) VALUES
  ('COE',      'Certificate of Employment', 3),
  ('COER',     'Certificate of Employment with Remunerations', 3),
  ('SR',       'Service Record', 3),
  ('NOSI_CPY', 'Notice of Step Increment (Copy)', 3),
  ('NOSA_CPY', 'Notice of Salary Adjustment (Copy)', 3),
  ('LEAVE_CR', 'Certificate of Leave Credits', 3),
  ('CERT_NP',  'Certificate of No Pending Case', 5)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fm_document_request_statuses (code, name, status_type, display_order) VALUES
  ('PENDING',     'Pending', 'initial', 1),
  ('PROCESSING',  'Processing', 'processing', 2),
  ('READY',       'Ready for Release', 'processing', 3),
  ('RELEASED',    'Released', 'terminal', 4),
  ('DISAPPROVED', 'Disapproved', 'terminal', 5),
  ('CANCELLED',   'Cancelled', 'terminal', 6)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.24 L&D types ────────────────────────────────────────────────────────
INSERT INTO public.fm_lnd_types (code, name) VALUES
  ('TECH',  'Technical'),
  ('MGMT',  'Managerial'),
  ('SUPV',  'Supervisory'),
  ('FOUND', 'Foundational'),
  ('SCHOL', 'Scholarship')
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.55 Competency baselines ─────────────────────────────────────────────
INSERT INTO public.fm_competency_baselines
  (code, domain, competency_name, applicable_position_levels, required_level) VALUES
  ('CORE_INTEG', 'core', 'Exemplifying Integrity', '{first_level,second_level,ces}', 4),
  ('CORE_PROF',  'core', 'Professionalism', '{first_level,second_level,ces}', 4),
  ('CORE_SVC',   'core', 'Service Excellence', '{first_level,second_level,ces}', 4),
  ('CORE_TEAM',  'core', 'Teamwork and Collaboration', '{first_level,second_level}', 3),
  ('LEAD_STRAT', 'leadership', 'Strategic Thinking', '{second_level,ces}', 4),
  ('LEAD_PEOPLE','leadership', 'People Management', '{second_level,ces}', 4),
  ('LEAD_DECIDE','leadership', 'Decision Making', '{second_level,ces}', 4),
  ('TECH_COMP',  'technical', 'Computer Literacy', '{first_level,second_level}', 3),
  ('TECH_COMM',  'technical', 'Written and Oral Communication', '{first_level,second_level,ces}', 3),
  ('TECH_DATA',  'technical', 'Records and Data Management', '{first_level,second_level}', 3)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.44 Job grade categories (CPCS / GCG MC 2012-07) ─────────────────────
INSERT INTO public.fm_job_grade_categories (code, name, min_job_grade, max_job_grade) VALUES
  ('CEO',   'Chief Executive Officer', 30, 33),
  ('SRMGT', 'Senior Management', 26, 29),
  ('MIDMGT','Middle Management', 20, 25),
  ('SUPV',  'Supervisory', 15, 19),
  ('TECH',  'Technical', 10, 14),
  ('CLER',  'Clerical', 1, 9)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.27 Longevity milestones (FM-019) ────────────────────────────────────
INSERT INTO public.fm_longevity_milestones (years_of_service, award_name) VALUES
  (10, '10 Years of Loyal Service'),
  (15, '15 Years of Loyal Service'),
  (20, '20 Years of Loyal Service'),
  (25, '25 Years of Loyal Service'),
  (30, '30 Years of Loyal Service'),
  (35, '35 Years of Loyal Service'),
  (40, '40 Years of Loyal Service'),
  (45, '45 Years of Loyal Service')
ON CONFLICT (years_of_service) DO NOTHING;

-- ─── 1.1.28 Modes of separation ──────────────────────────────────────────────
INSERT INTO public.fm_modes_of_separation (code, name, category, eligible_for_benefits) VALUES
  ('RET_OPT',  'Optional Retirement', 'retirement', true),
  ('RET_COMP', 'Compulsory Retirement', 'retirement', true),
  ('RESIGN',   'Resignation', 'voluntary', true),
  ('TRANSFER', 'Transfer to Another Agency', 'voluntary', true),
  ('DISMISS',  'Dismissal from Service', 'involuntary', false),
  ('DROPPED',  'Dropped from the Rolls', 'involuntary', false),
  ('REDUND',   'Redundancy / Reorganization', 'involuntary', true),
  ('EOC',      'End of Contract', 'involuntary', true),
  ('DEATH',    'Death in Service', 'death', true)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.40 Sizes ────────────────────────────────────────────────────────────
INSERT INTO public.fm_sizes (code, name, size_category, display_order) VALUES
  ('XS',  'Extra Small', 'apparel', 1),
  ('S',   'Small', 'apparel', 2),
  ('M',   'Medium', 'apparel', 3),
  ('L',   'Large', 'apparel', 4),
  ('XL',  'Extra Large', 'apparel', 5),
  ('XXL', '2X Large', 'apparel', 6),
  ('XXXL','3X Large', 'apparel', 7),
  ('ID_STD', 'Standard ID (CR80)', 'id', 8),
  ('LACE_STD', 'Standard Lace', 'id', 9)
ON CONFLICT (code) DO NOTHING;

-- ─── 1.1.51 Leave computation table (CSC proportional accrual) ───────────────
-- Credits earned per days of paid service in a month (1.25/mo ceiling),
-- values per the CSC leave credit conversion table.
INSERT INTO public.fm_leave_computation_rules (code, name, category, days_present, credits_earned) VALUES
  ('WP_01', 'Leave credits — 1 day paid service',  'with_pay', 1, 0.042),
  ('WP_02', 'Leave credits — 2 days paid service', 'with_pay', 2, 0.083),
  ('WP_03', 'Leave credits — 3 days paid service', 'with_pay', 3, 0.125),
  ('WP_04', 'Leave credits — 4 days paid service', 'with_pay', 4, 0.167),
  ('WP_05', 'Leave credits — 5 days paid service', 'with_pay', 5, 0.208),
  ('WP_06', 'Leave credits — 6 days paid service', 'with_pay', 6, 0.250),
  ('WP_07', 'Leave credits — 7 days paid service', 'with_pay', 7, 0.292),
  ('WP_08', 'Leave credits — 8 days paid service', 'with_pay', 8, 0.333),
  ('WP_09', 'Leave credits — 9 days paid service', 'with_pay', 9, 0.375),
  ('WP_10', 'Leave credits — 10 days paid service','with_pay', 10, 0.417),
  ('WP_11', 'Leave credits — 11 days paid service','with_pay', 11, 0.458),
  ('WP_12', 'Leave credits — 12 days paid service','with_pay', 12, 0.500),
  ('WP_13', 'Leave credits — 13 days paid service','with_pay', 13, 0.542),
  ('WP_14', 'Leave credits — 14 days paid service','with_pay', 14, 0.583),
  ('WP_15', 'Leave credits — 15 days paid service','with_pay', 15, 0.625),
  ('WP_16', 'Leave credits — 16 days paid service','with_pay', 16, 0.667),
  ('WP_17', 'Leave credits — 17 days paid service','with_pay', 17, 0.708),
  ('WP_18', 'Leave credits — 18 days paid service','with_pay', 18, 0.750),
  ('WP_19', 'Leave credits — 19 days paid service','with_pay', 19, 0.792),
  ('WP_20', 'Leave credits — 20 days paid service','with_pay', 20, 0.833),
  ('WP_21', 'Leave credits — 21 days paid service','with_pay', 21, 0.875),
  ('WP_22', 'Leave credits — 22 days paid service','with_pay', 22, 0.917),
  ('WP_23', 'Leave credits — 23 days paid service','with_pay', 23, 0.958),
  ('WP_24', 'Leave credits — 24 days paid service','with_pay', 24, 1.000),
  ('WP_25', 'Leave credits — 25 days paid service','with_pay', 25, 1.042),
  ('WP_26', 'Leave credits — 26 days paid service','with_pay', 26, 1.083),
  ('WP_27', 'Leave credits — 27 days paid service','with_pay', 27, 1.125),
  ('WP_28', 'Leave credits — 28 days paid service','with_pay', 28, 1.167),
  ('WP_29', 'Leave credits — 29 days paid service','with_pay', 29, 1.208),
  ('WP_30', 'Leave credits — 30 days paid service','with_pay', 30, 1.250),
  ('WOP_DAY', 'LWOP salary deduction factor per day (1/22 of monthly)', 'without_pay', NULL, 0.045),
  ('WOP_FULL_MONTH', 'Full LWOP month — no accrual', 'without_pay', NULL, 0.000)
ON CONFLICT (code) DO NOTHING;
