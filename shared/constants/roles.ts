export const ROLES = ["PATIENT", "DOCTOR", "HOSPITAL", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

