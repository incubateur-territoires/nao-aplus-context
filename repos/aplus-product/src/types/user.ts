import { User } from "@/generated/prisma/client";
import { OrganizationRole } from "@/generated/prisma/enums";
import { UserRole } from "@/constants/user-roles";

export interface FullUser extends Omit<User, "role"> {
  role: UserRole;
  teams: {
    id: string;
    name: string;
    deletedAt: Date | null;
    role: OrganizationRole;
    organization: {
      id: string;
      name: string;
    };
    areas: {
      id: string;
      name: string;
      timezone: string;
    }[];
  }[];
}
