export const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "dcc.edu.ph",
  "davaocentralcollege.edu.ph",
];

export const ADMIN_EMAIL = "dccreservation660@gmail.com";

export const USER_ROLES = ["Student", "Faculty", "Staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isValidEmailFormat(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isAllowedInstitutionalEmail(email: string) {
  if (!isValidEmailFormat(email)) return false;
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

export const ALLOWED_DOMAINS_LABEL = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(", ");
