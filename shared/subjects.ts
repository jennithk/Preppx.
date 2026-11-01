export const SUPPORTED_SUBJECTS = ['Coding', 'Aptitude', 'Logical Reasoning'] as const;

export type SupportedSubject = (typeof SUPPORTED_SUBJECTS)[number];

export function isSupportedSubject(value: unknown): value is SupportedSubject {
  return typeof value === 'string' && (SUPPORTED_SUBJECTS as readonly string[]).includes(value);
}
