/**
 * CS Form 212 (Revised 2017) page-4 questionnaire — canonical question keys.
 *
 * The keys below are the storage keys used in `employees.pds_questionnaire`
 * (jsonb Record<key, { answer: boolean; details?: string | null }>), the
 * 201-file profile editor, and the PDS PDF generator. Do not rename keys —
 * stored answers are looked up by exact key.
 */

export interface PdsQuestionDef {
  /** Storage key in employees.pds_questionnaire. */
  key: string;
  /** Question text as printed on the official CS Form 212. */
  label: string;
  /** Prompt shown for the details field when the answer is Yes. */
  detailsPrompt: string;
}

export const PDS_QUESTIONS: readonly PdsQuestionDef[] = [
  {
    key: "34a",
    label:
      "34.a Are you related by consanguinity or affinity to the appointing or recommending authority, or to the chief of bureau or office, or to the person who has immediate supervision over you in the Office, Bureau or Department where you will be appointed — within the third degree?",
    detailsPrompt: "If YES, give details",
  },
  {
    key: "34b",
    label:
      "34.b Within the fourth degree (for Local Government Unit — Career Employees)?",
    detailsPrompt: "If YES, give details",
  },
  {
    key: "35a",
    label:
      "35.a Have you ever been found guilty of any administrative offense?",
    detailsPrompt: "If YES, give details",
  },
  {
    key: "35b",
    label: "35.b Have you been criminally charged before any court?",
    detailsPrompt: "If YES, give the date filed and status of case/s",
  },
  {
    key: "36",
    label:
      "36. Have you ever been convicted of any crime or violation of any law, decree, ordinance or regulation by any court or tribunal?",
    detailsPrompt: "If YES, give details",
  },
  {
    key: "37",
    label:
      "37. Have you ever been separated from the service in any of the following modes: resignation, retirement, dropped from the rolls, dismissal, termination, end of term, finished contract or phased out (abolition) in the public or private sector?",
    detailsPrompt: "If YES, give details",
  },
  {
    key: "38a",
    label:
      "38.a Have you ever been a candidate in a national or local election held within the last year (except Barangay election)?",
    detailsPrompt: "If YES, give details",
  },
  {
    key: "38b",
    label:
      "38.b Have you resigned from the government service during the three (3)-month period before the last election to promote / actively campaign for a national or local candidate?",
    detailsPrompt: "If YES, give details",
  },
  {
    key: "39",
    label:
      "39. Have you acquired the status of an immigrant or permanent resident of another country?",
    detailsPrompt: "If YES, give country",
  },
  {
    key: "40a",
    label:
      "40.a Are you a member of any indigenous group (per RA 8371, Indigenous People's Act)?",
    detailsPrompt: "If YES, please specify",
  },
  {
    key: "40b",
    label:
      "40.b Are you a person with disability (per RA 7277, Magna Carta for Disabled Persons)?",
    detailsPrompt: "If YES, please specify ID No.",
  },
  {
    key: "40c",
    label:
      "40.c Are you a solo parent (per RA 8972, Solo Parents Welfare Act of 2000)?",
    detailsPrompt: "If YES, please specify ID No.",
  },
] as const;

export const PDS_QUESTION_KEYS: readonly string[] = PDS_QUESTIONS.map(
  (q) => q.key,
);
