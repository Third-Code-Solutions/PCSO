export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number]['value'];

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
};
