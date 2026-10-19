import policy from '../../security/email-domains.json';

export const ALLOWED_DOMAINS = Object.freeze(policy.domains);
export const PRIVACY_VERSION = '2026-10-17';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isInstitutionalEmail(value: string): boolean {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return false;
  const [, domain] = email.split('@');
  return ALLOWED_DOMAINS.includes(domain);
}
