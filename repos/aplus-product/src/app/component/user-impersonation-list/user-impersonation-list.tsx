"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { signIn } from "@/lib/auth-client";
import Button from "@codegouvfr/react-dsfr/Button";
import { Box } from "@mui/material";
import { OrganizationRole } from "@/generated/prisma/enums";
import { USER_ROLES } from "@/constants/user-roles";

// Mot de passe partagé des comptes de dev/staging, jamais présent dans le
// dépôt (public) : il vient du .env local ou des variables de staging.
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD ?? "";

interface UserWithTeams {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  teams: {
    id: string;
    name: string;
    role: OrganizationRole;
    organization: {
      name: string;
      shortName: string;
    };
    areas: {
      name: string;
    }[];
  }[];
}

export function UserImpersonationList() {
  const trpc = useTRPC();

  const { data: usersData, isLoading } = useQuery(
    trpc.user.getAllUsersForDev.queryOptions(),
  );
  const users = usersData?.users ?? [];

  const handleUserSelect = async (user: UserWithTeams) => {
    try {
      // Use better-auth's signIn to properly set the session
      await signIn.email({
        email: user.email,
        password: DEV_PASSWORD,
        callbackURL: "/",
      });

      // Email intentionally omitted from logs for security
    } catch (error) {
      console.error("Impersonation failed:", error);
    }
  };

  function getUserRoleLabel(role: string): string {
    switch (role) {
      case USER_ROLES.ADMIN:
        return "Admin";
      case USER_ROLES.USER:
        return "Utilisateur";
      default:
        return String(role);
    }
  }

  function getTeamRoleLabel(role: OrganizationRole): string {
    switch (role) {
      case OrganizationRole.OPERATOR:
        return "Opérateur";
      case OrganizationRole.HELPER:
        return "Aidant";
      default:
        return String(role);
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            border: "2px solid #1976d2",
            borderTop: "2px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid #e0e0e0",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f5f5f5" }}>
            <th
              style={{
                border: "1px solid #e0e0e0",
                padding: "8px 16px",
                textAlign: "left",
              }}
            >
              Nom
            </th>
            <th
              style={{
                border: "1px solid #e0e0e0",
                padding: "8px 16px",
                textAlign: "left",
              }}
            >
              Email
            </th>
            <th
              style={{
                border: "1px solid #e0e0e0",
                padding: "8px 16px",
                textAlign: "left",
              }}
            >
              Rôle
            </th>
            <th
              style={{
                border: "1px solid #e0e0e0",
                padding: "8px 16px",
                textAlign: "left",
              }}
            >
              Équipe(s)
            </th>
            <th
              style={{
                border: "1px solid #e0e0e0",
                padding: "8px 16px",
                textAlign: "left",
              }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ cursor: "pointer" }}>
              <td
                style={{
                  border: "1px solid #e0e0e0",
                  padding: "8px 16px",
                }}
              >
                {user.firstName} {user.lastName}
              </td>
              <td
                style={{
                  border: "1px solid #e0e0e0",
                  padding: "8px 16px",
                  fontSize: "14px",
                  color: "#666",
                }}
              >
                {user.email}
              </td>
              <td
                style={{
                  border: "1px solid #e0e0e0",
                  padding: "8px 16px",
                }}
              >
                <Box
                  sx={{
                    display: "inline-block",
                    backgroundColor: "#e3f2fd",
                    color: "#1976d2",
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {getUserRoleLabel(user.role)}
                </Box>
              </td>
              <td
                style={{
                  border: "1px solid #e0e0e0",
                  padding: "8px 16px",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {user.teams.map((team) => (
                    <Box key={team.id} sx={{ fontSize: "14px" }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <Box sx={{ fontWeight: "medium" }}>{team.name}</Box>
                        <Box
                          sx={{
                            display: "inline-block",
                            backgroundColor:
                              team.role === OrganizationRole.OPERATOR
                                ? "#E9EDFE"
                                : "#C3FAD5",
                            color:
                              team.role === OrganizationRole.OPERATOR
                                ? "#2F4077"
                                : "#297254",
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {getTeamRoleLabel(team.role)}
                        </Box>
                      </Box>
                      <Box sx={{ color: "#666" }}>
                        {team.organization.shortName} -{" "}
                        {team.areas.map((area) => area.name).join(", ")}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </td>
              <td
                style={{
                  border: "1px solid #e0e0e0",
                  padding: "8px 16px",
                }}
              >
                <Button
                  size="small"
                  priority="tertiary"
                  onClick={() => handleUserSelect(user)}
                >
                  Se connecter
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}
