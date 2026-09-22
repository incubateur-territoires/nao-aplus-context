export const USER_ROLES = {
  ADMIN: "admin",
  USER: "user",
  SUPERVISOR: "supervisor",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
