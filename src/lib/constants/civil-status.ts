export const CIVIL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'legally_separated', label: 'Legally Separated' },
  { value: 'annulled', label: 'Annulled' },
] as const;

export type CivilStatus = (typeof CIVIL_STATUS_OPTIONS)[number]['value'];

export const CIVIL_STATUS_LABELS: Record<CivilStatus, string> = {
  single: 'Single',
  married: 'Married',
  widowed: 'Widowed',
  legally_separated: 'Legally Separated',
  annulled: 'Annulled',
};
