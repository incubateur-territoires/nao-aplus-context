"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { signIn } from "@/lib/auth-client";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { usePathname, useParams } from "next/navigation";
import Button from "@codegouvfr/react-dsfr/Button";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { OrganizationRole } from "@/generated/prisma/enums";
import { USER_ROLES, type UserRole } from "@/constants/user-roles";
import { ROUTE } from "@/app/constant/route";
import { useAnalytics } from "@/app/hooks/use-analytics";
import { getSafeReturnTo } from "@/utils/return-to";

// Mot de passe partagé des comptes de dev/staging, jamais présent dans le
// dépôt (public) : il vient du .env local ou des variables de staging.
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD ?? "";

interface UserWithTeams {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean | null;
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
  managedTeams?: { id: string }[];
  supervisor?: {
    areas: { id: string; name: string }[];
    organizations: { id: string; name: string; shortName: string }[];
  } | null;
}

type FilterRole = "ADMIN" | "SUPERVISOR" | "OPERATOR" | "HELPER" | null;

export function ImpersonationWidget({
  isDefaultOpen,
  open,
  onOpenChange,
  onPrefillLogin,
}: {
  isDefaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPrefillLogin?: (email: string, password: string) => void;
}) {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const pathname = usePathname();
  const params = useParams();
  const [internalOpen, setInternalOpen] = useState(isDefaultOpen);
  const { track } = useAnalytics();

  // Check if we're on a report page
  const isReportPage = pathname?.startsWith("/signalement/");
  const reportId = isReportPage ? (params?.id as string) : null;

  // Fetch report data if on report page
  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(reportId ?? ""),
    enabled: !!reportId,
  });

  // Fetch current user with teams
  const { data: currentUserWithTeams } = useQuery({
    ...trpc.user.getCurrentUser.queryOptions(),
    enabled: !!session?.user && !!reportId,
  });

  // Calculate user's relationship to the report
  const reportRelationship = useMemo(() => {
    if (!report || !currentUserWithTeams || !session?.user) return null;

    const userId = session.user.id;
    const relationships: string[] = [];

    // Check if author
    if (report.authorId === userId) {
      relationships.push("Auteur");
    }

    // Check if co-author
    if (report.coAuthors?.some((coAuthor) => coAuthor.id === userId)) {
      relationships.push("Co-auteur");
    }

    // Check if in requested team
    const userTeamIds =
      currentUserWithTeams.teams?.map((team) => team.id) ?? [];
    const isInRequestedTeam = report.requestedTeams?.some((team) =>
      userTeamIds.includes(team.id),
    );
    if (isInRequestedTeam) {
      relationships.push("Équipe sollicitée");
    }

    return relationships.length > 0 ? relationships : null;
  }, [report, currentUserWithTeams, session?.user]);

  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<FilterRole>(null);
  const [filterByReportAccess, setFilterByReportAccess] =
    useState(isReportPage);
  const [isSwitching, setIsSwitching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastIPressTime = useRef<number>(0);
  const lastHPressTime = useRef<number>(0);
  const lastAPressTime = useRef<number>(0);
  const DOUBLE_PRESS_TIMEOUT = 500; // ms

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      ...trpc.user.getAllUsersForDev.infiniteQueryOptions(
        {
          search: debouncedSearch || undefined,
          role: selectedRole ?? undefined,
          reportId: filterByReportAccess && reportId ? reportId : undefined,
          limit: 10,
        },
        {
          getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
      ),
      enabled: isOpen,
    });

  const users = useMemo(
    () => data?.pages.flatMap((page) => page.users) ?? [],
    [data],
  );

  // Automatically enable/disable filter when navigating between report and non-report pages
  useEffect(() => {
    setFilterByReportAccess(isReportPage);
  }, [isReportPage]);

  // Check if user has any team with a specific role
  function hasTeamRole(user: UserWithTeams, role: OrganizationRole): boolean {
    return user.teams.some((team) => team.role === role);
  }

  // Get user's relationship to the report
  function getUserReportRelationship(user: UserWithTeams): string[] {
    if (!report) return [];

    const relationships: string[] = [];

    if (user.role === USER_ROLES.ADMIN) {
      relationships.push("Admin");
    }

    if (user.id === report.authorId) {
      relationships.push("Auteur");
    }

    if (report.coAuthors?.some((coAuthor) => coAuthor.id === user.id)) {
      relationships.push("Co-auteur");
    }

    const userTeamIds = user.teams.map((team) => team.id);

    if (
      report.applicantTeamId &&
      userTeamIds.includes(report.applicantTeamId)
    ) {
      relationships.push("Équipe auteur");
    }

    const requestedTeamIds =
      report.requestedTeams?.map((team) => team.id) ?? [];
    const isInRequestedTeam = userTeamIds.some((teamId) =>
      requestedTeamIds.includes(teamId),
    );

    if (isInRequestedTeam) {
      relationships.push("Équipe sollicitée");
    }

    return relationships;
  }

  // Filtering is now done server-side via the reportId parameter
  const filteredUsers = users;

  const handleUserSelect = useCallback(
    async (user: UserWithTeams) => {
      // Si l'utilisateur a le 2FA activé, pré-remplir le formulaire de connexion
      if (user.twoFactorEnabled && onPrefillLogin) {
        onPrefillLogin(user.email, DEV_PASSWORD);
        setIsOpen(false);
        setSearchQuery("");
        setSelectedRole(null);
        return;
      }

      // Si 2FA activé mais pas sur la page de login, rediriger vers la page de login
      if (user.twoFactorEnabled) {
        window.location.href = `${ROUTE.LOGIN}?prefill=${encodeURIComponent(user.email)}`;
        return;
      }

      setIsSwitching(true);
      try {
        // Se connecter avec email/mot de passe (mot de passe de dev)
        const result = await signIn.email({
          email: user.email,
          password: DEV_PASSWORD,
        });

        if (result.error) {
          console.error("Login failed:", result.error);
          return;
        }

        track("auth_impersonate_user", {
          targetUserId: user.id,
          targetEmail: user.email,
        });
        // Email intentionally omitted from logs for security
        setIsOpen(false);
        setSearchQuery("");
        setSelectedRole(null);

        // Rediriger vers la page appropriée. Depuis la page de connexion,
        // respecter le returnTo (ex: lien d'email vers un signalement).
        const targetURL =
          window.location.pathname === ROUTE.LOGIN
            ? getSafeReturnTo(
                new URLSearchParams(window.location.search).get("returnTo"),
              )
            : window.location.pathname;
        window.location.href = targetURL;
      } catch (error) {
        console.error("Login failed:", error);
      } finally {
        setIsSwitching(false);
      }
    },
    [setIsOpen, track, onPrefillLogin],
  );

  const connectAsInstructor = useCallback(async () => {
    if (isLoading || filteredUsers.length === 0) return;

    const instructorUser = filteredUsers.find((user) =>
      hasTeamRole(user, OrganizationRole.OPERATOR),
    );

    if (instructorUser) {
      await handleUserSelect(instructorUser);
    }
  }, [filteredUsers, isLoading, handleUserSelect]);

  const connectAsHelper = useCallback(async () => {
    if (isLoading || filteredUsers.length === 0) return;

    const helperUser = filteredUsers.find((user) =>
      hasTeamRole(user, OrganizationRole.HELPER),
    );

    if (helperUser) {
      await handleUserSelect(helperUser);
    }
  }, [filteredUsers, isLoading, handleUserSelect]);

  const connectAsAdmin = useCallback(async () => {
    if (isLoading || filteredUsers.length === 0) return;

    const adminUser = filteredUsers.find(
      (user) => user.role === USER_ROLES.ADMIN,
    );

    if (adminUser) {
      await handleUserSelect(adminUser);
    }
  }, [filteredUsers, isLoading, handleUserSelect]);

  const handleStopImpersonation = useCallback(async () => {
    // Avec le login direct, pas de "stop impersonation"
    // On redirige simplement vers la page de connexion
    window.location.href = ROUTE.LOGIN;
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Check if Shift+I is pressed (for instructor)
      if (event.shiftKey && event.key === "I") {
        const now = Date.now();
        const timeSinceLastPress = now - lastIPressTime.current;

        if (timeSinceLastPress < DOUBLE_PRESS_TIMEOUT) {
          // Double press detected
          event.preventDefault();
          connectAsInstructor();
          lastIPressTime.current = 0; // Reset to prevent triple press
        } else {
          lastIPressTime.current = now;
        }
      }

      // Check if Shift+H is pressed (for helper)
      if (event.shiftKey && event.key === "H") {
        const now = Date.now();
        const timeSinceLastPress = now - lastHPressTime.current;

        if (timeSinceLastPress < DOUBLE_PRESS_TIMEOUT) {
          // Double press detected
          event.preventDefault();
          connectAsHelper();
          lastHPressTime.current = 0; // Reset to prevent triple press
        } else {
          lastHPressTime.current = now;
        }
      }

      // Check if Shift+A is pressed (for admin)
      if (event.shiftKey && event.key === "A") {
        const now = Date.now();
        const timeSinceLastPress = now - lastAPressTime.current;

        if (timeSinceLastPress < DOUBLE_PRESS_TIMEOUT) {
          // Double press detected
          event.preventDefault();
          connectAsAdmin();
          lastAPressTime.current = 0; // Reset to prevent triple press
        } else {
          lastAPressTime.current = now;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [connectAsInstructor, connectAsHelper, connectAsAdmin]);

  useEffect(() => {
    if (!isOpen) return;

    // Multiple attempts with increasing delays to handle drawer animation
    const attemptFocus = (attempt = 0) => {
      if (attempt > 5) return; // Max 5 attempts

      const input = searchInputRef.current;
      if (input) {
        input.focus();
        input.select();
      } else {
        setTimeout(() => attemptFocus(attempt + 1), 100);
      }
    };

    // Start focusing after drawer starts opening
    const timer1 = setTimeout(() => attemptFocus(), 200);
    const timer2 = setTimeout(() => attemptFocus(), 400);
    const timer3 = setTimeout(() => attemptFocus(), 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isOpen]);

  function getUserRoleLabel(role: string): string {
    switch (role) {
      case USER_ROLES.ADMIN:
        return "Admin";
      case USER_ROLES.SUPERVISOR:
        return "Superviseur";
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

  const currentUser = session?.user;
  const userDisplayName = currentUser
    ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
      currentUser.email
    : null;
  const userRole = currentUser?.role as UserRole | undefined;

  function getUserRoleColor(role: string) {
    switch (role) {
      case USER_ROLES.ADMIN:
        return { bg: "#FEE7FC", color: "#6E445A" };
      case USER_ROLES.SUPERVISOR:
        return { bg: "#FFF4E6", color: "#B34000" };
      case USER_ROLES.USER:
        return { bg: "#F5F5FE", color: "#000091" };
      default:
        return { bg: "#F5F5FE", color: "#000091" };
    }
  }

  function getRelationshipColor(relationship: string) {
    switch (relationship) {
      case "Auteur":
        return { bg: "#FFF4E6", color: "#B34000", border: "#FFB86F" };
      case "Co-auteur":
        return { bg: "#E8F5E9", color: "#1B5E20", border: "#81C784" };
      case "Équipe sollicitée":
        return { bg: "#E3F2FD", color: "#0D47A1", border: "#64B5F6" };
      default:
        return { bg: "#F5F5F5", color: "#424242", border: "#BDBDBD" };
    }
  }

  function getTeamRoleColor(role: OrganizationRole) {
    switch (role) {
      case OrganizationRole.OPERATOR:
        return { bg: "#E9EDFE", color: "#2F4077" };
      case OrganizationRole.HELPER:
        return { bg: "#C3FAD5", color: "#297254" };
      default:
        return { bg: "#F5F5FE", color: "#000091" };
    }
  }

  const filterRoles: { key: FilterRole; label: string }[] = [
    { key: "ADMIN", label: "Admin" },
    { key: "SUPERVISOR", label: "Superviseur" },
    { key: "OPERATOR", label: "Opérateur" },
    { key: "HELPER", label: "Aidant" },
  ];

  // Check if widget is externally controlled (used on login page or DevToolsWidget)
  const isExternallyControlled = open !== undefined;

  // En dev, tout utilisateur peut changer de compte (login direct avec mot de passe de test)
  const canImpersonate =
    process.env.NODE_ENV === "development" || userRole === USER_ROLES.ADMIN;

  // Don't show anything if no user is connected and not externally controlled
  // Or if user cannot impersonate (not admin and not already impersonated)
  if ((!userDisplayName || !canImpersonate) && !isExternallyControlled) {
    return null;
  }

  // Show floating button only when not externally controlled
  const showFloatingButton =
    !isExternallyControlled && userDisplayName && canImpersonate;

  return (
    <>
      {showFloatingButton && (
        <Box
          className="fixed bottom-6 right-6 z-50"
          onClick={() => setIsOpen(true)}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            backgroundColor: "white",
            padding: "14px 16px",
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)",
            border: "1px solid #E5E7EB",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "pointer",
            minWidth: "240px",
            maxWidth: "280px",
            "&:hover": {
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.08)",
              transform: "translateY(-2px)",
              borderColor: "#D1D5DB",
            },
            "&:active": {
              transform: "translateY(-1px)",
            },
          }}
        >
          {/* User Info Row */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#000091",
                flexShrink: 0,
              }}
            >
              <PersonIcon sx={{ fontSize: 22, color: "white" }} />
            </Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                flex: 1,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontSize: "14px",
                  lineHeight: 1.4,
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userDisplayName}
              </Typography>
              {userRole && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "12px",
                    color: "#6B7280",
                    marginTop: 0.25,
                  }}
                >
                  {getUserRoleLabel(userRole)}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Relationships Chips */}
          {reportRelationship && reportRelationship.length > 0 && (
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                flexWrap: "wrap",
                paddingTop: 1,
                borderTop: "1px solid #F3F4F6",
              }}
            >
              {reportRelationship.map((rel, index) => {
                const colors = getRelationshipColor(rel);
                return (
                  <Chip
                    key={index}
                    label={rel}
                    size="small"
                    sx={{
                      height: "22px",
                      fontSize: "11px",
                      fontWeight: 600,
                      backgroundColor: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                      "& .MuiChip-label": {
                        padding: "0 8px",
                        lineHeight: "22px",
                      },
                    }}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      )}

      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        ModalProps={{
          onTransitionEnd: () => {
            if (isOpen) {
              searchInputRef.current?.focus();
              searchInputRef.current?.select();
            }
          },
        }}
        sx={{
          "& .MuiDrawer-paper": {
            width: "90vw",
            maxWidth: "1200px",
          },
        }}
      >
        <Box
          sx={{
            p: 3,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Typography
              variant="h5"
              component="h2"
              sx={{ fontWeight: 700, color: "#161616" }}
            >
              Connexion en tant qu&apos;utilisateur
            </Typography>
            <IconButton
              onClick={() => setIsOpen(false)}
              sx={{
                "&:hover": { backgroundColor: "#f5f5f5" },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Stop impersonation banner */}
          {session?.impersonatedBy && (
            <Box
              sx={{
                mb: 2,
                p: 2,
                backgroundColor: "#FFF4E6",
                border: "1px solid #FFB86F",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="body2" sx={{ color: "#B34000" }}>
                Vous êtes actuellement en mode impersonation
              </Typography>
              <Button
                size="small"
                priority="secondary"
                onClick={handleStopImpersonation}
                disabled={isSwitching}
              >
                {isSwitching ? "..." : "Revenir à mon compte"}
              </Button>
            </Box>
          )}

          {/* Quick actions */}
          <Box sx={{ mb: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip
              label="Tous"
              disabled={filterByReportAccess}
              onClick={() => {
                setSelectedRole(null);
                setFilterByReportAccess(false);
              }}
              color={
                selectedRole === null && !filterByReportAccess
                  ? "primary"
                  : "default"
              }
              size="small"
              sx={{
                cursor: filterByReportAccess ? "default" : "pointer",
                opacity: filterByReportAccess ? 0.4 : 1,
              }}
            />
            {filterRoles.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                disabled={filterByReportAccess}
                onClick={() => {
                  setSelectedRole(selectedRole === key ? null : key);
                  setFilterByReportAccess(false);
                }}
                size="small"
                sx={{
                  cursor: filterByReportAccess ? "default" : "pointer",
                  backgroundColor:
                    selectedRole === key && !filterByReportAccess
                      ? "#E9EDFE"
                      : "transparent",
                  color:
                    selectedRole === key && !filterByReportAccess
                      ? "#2F4077"
                      : "inherit",
                  border: "1px solid #2F407740",
                  opacity: filterByReportAccess ? 0.4 : 1,
                  "&:hover": {
                    backgroundColor: filterByReportAccess
                      ? "transparent"
                      : "#E9EDFE",
                    color: filterByReportAccess ? "inherit" : "#2F4077",
                  },
                }}
              />
            ))}
            {reportId && (
              <Chip
                label="Accès au signalement"
                onClick={() => {
                  const next = !filterByReportAccess;
                  setFilterByReportAccess(next);
                  if (next) setSelectedRole(null);
                }}
                size="small"
                sx={{
                  cursor: "pointer",
                  backgroundColor: filterByReportAccess
                    ? "#C3FAD5"
                    : "transparent",
                  color: filterByReportAccess ? "#297254" : "inherit",
                  border: filterByReportAccess
                    ? "1px solid #297254"
                    : "1px solid #29725440",
                  fontWeight: filterByReportAccess ? 600 : 500,
                  "&:hover": {
                    backgroundColor: "#C3FAD5",
                    color: "#297254",
                  },
                }}
              />
            )}
          </Box>

          {/* Search */}
          <TextField
            inputRef={searchInputRef}
            autoFocus={isOpen}
            fullWidth
            autoComplete="off"
            placeholder="Rechercher par nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: "#666" }} />,
            }}
          />

          {isLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flex: 1,
              }}
            >
              <CircularProgress size={40} />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                color: "#666",
              }}
            >
              <Typography variant="body1" sx={{ mb: 1 }}>
                Aucun utilisateur trouvé
              </Typography>
              <Typography variant="body2" sx={{ color: "#999" }}>
                Essayez de modifier votre recherche ou filtre
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                overflow: "auto",
                flex: 1,
                border: "1px solid #e5e5e5",
                borderRadius: "4px",
              }}
            >
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  "& thead": {
                    position: "sticky",
                    top: 0,
                    backgroundColor: "#f5f5f5",
                    zIndex: 1,
                  },
                  "& th": {
                    border: "1px solid #e5e5e5",
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "#161616",
                    backgroundColor: "#f5f5f5",
                  },
                  "& td": {
                    border: "1px solid #e5e5e5",
                    padding: "12px 16px",
                  },
                  "& tbody tr": {
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                    "&:hover": {
                      backgroundColor: "#fafafa",
                    },
                  },
                }}
              >
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Responsable(s)</th>
                    {filterByReportAccess && reportId && (
                      <th>Relation au signalement</th>
                    )}
                    <th>Équipe(s)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      style={{ cursor: isSwitching ? "wait" : "pointer" }}
                    >
                      <td>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500, color: "#161616" }}
                        >
                          {user.firstName} {user.lastName}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant="body2" sx={{ color: "#666" }}>
                          {user.email}
                        </Typography>
                      </td>
                      <td>
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          <Chip
                            label={getUserRoleLabel(user.role)}
                            size="small"
                            sx={{
                              height: "22px",
                              fontSize: "11px",
                              fontWeight: 500,
                              backgroundColor: getUserRoleColor(user.role).bg,
                              color: getUserRoleColor(user.role).color,
                              "& .MuiChip-label": {
                                padding: "0 8px",
                              },
                            }}
                          />
                        </Box>
                      </td>
                      <td>
                        {user.managedTeams && user.managedTeams.length > 0 ? (
                          <Chip
                            label="Oui"
                            size="small"
                            sx={{
                              height: "22px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: "#FFF4E6",
                              color: "#B34000",
                              border: "1px solid #FFB86F",
                              "& .MuiChip-label": {
                                padding: "0 8px",
                              },
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: "#999" }}>
                            Non
                          </Typography>
                        )}
                      </td>
                      {filterByReportAccess && reportId && (
                        <td>
                          <Box
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                          >
                            {getUserReportRelationship(user).map(
                              (rel, index) => {
                                const colors = getRelationshipColor(rel);
                                return (
                                  <Chip
                                    key={index}
                                    label={rel}
                                    size="small"
                                    sx={{
                                      height: "22px",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      backgroundColor: colors.bg,
                                      color: colors.color,
                                      border: `1px solid ${colors.border}`,
                                      "& .MuiChip-label": {
                                        padding: "0 8px",
                                      },
                                    }}
                                  />
                                );
                              },
                            )}
                          </Box>
                        </td>
                      )}
                      <td>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.75,
                          }}
                        >
                          {user.role === USER_ROLES.SUPERVISOR &&
                          user.supervisor ? (
                            <SupervisorScopeCell supervisor={user.supervisor} />
                          ) : (
                            <TeamsCell
                              teams={user.teams}
                              getTeamRoleLabel={getTeamRoleLabel}
                              getTeamRoleColor={getTeamRoleColor}
                            />
                          )}
                        </Box>
                      </td>
                      <td>
                        <Button
                          size="small"
                          priority="tertiary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUserSelect(user);
                          }}
                          disabled={isSwitching}
                        >
                          {isSwitching ? "..." : "Sélectionner"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Box>
              {hasNextPage && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <Button
                    size="small"
                    priority="secondary"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? "Chargement..." : "Voir plus"}
                  </Button>
                </Box>
              )}
              {!hasNextPage && filteredUsers.length > 0 && (
                <Typography
                  variant="body2"
                  sx={{ textAlign: "center", py: 1, color: "#999" }}
                >
                  {filteredUsers.length} utilisateur(s)
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
}

function SupervisorScopeCell({
  supervisor,
}: {
  supervisor: NonNullable<UserWithTeams["supervisor"]>;
}) {
  return (
    <>
      {supervisor.organizations.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: "#161616", fontSize: "11px" }}
          >
            Organisations
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
            {supervisor.organizations.map((org) => (
              <Chip
                key={org.id}
                label={org.shortName}
                size="small"
                sx={{
                  height: "20px",
                  fontSize: "10px",
                  fontWeight: 500,
                  backgroundColor: "#E9EDFE",
                  color: "#2F4077",
                  "& .MuiChip-label": { padding: "0 6px" },
                }}
              />
            ))}
          </Box>
        </Box>
      )}
      {supervisor.areas.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: "#161616", fontSize: "11px" }}
          >
            Areas
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
            {supervisor.areas.map((area) => (
              <Chip
                key={area.id}
                label={area.name}
                size="small"
                sx={{
                  height: "20px",
                  fontSize: "10px",
                  fontWeight: 500,
                  backgroundColor: "#C3FAD5",
                  color: "#297254",
                  "& .MuiChip-label": { padding: "0 6px" },
                }}
              />
            ))}
          </Box>
        </Box>
      )}
      {supervisor.organizations.length === 0 &&
        supervisor.areas.length === 0 && (
          <Typography variant="body2" sx={{ color: "#999" }}>
            Aucun périmètre configuré
          </Typography>
        )}
    </>
  );
}

const MAX_VISIBLE_TEAMS = 3;

function TeamsCell({
  teams,
  getTeamRoleLabel,
  getTeamRoleColor,
}: {
  teams: UserWithTeams["teams"];
  getTeamRoleLabel: (role: OrganizationRole) => string;
  getTeamRoleColor: (role: OrganizationRole) => { bg: string; color: string };
}) {
  const [expanded, setExpanded] = useState(false);

  if (teams.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "#999" }}>
        Aucune équipe
      </Typography>
    );
  }

  const visible = expanded ? teams : teams.slice(0, MAX_VISIBLE_TEAMS);
  const remaining = teams.length - MAX_VISIBLE_TEAMS;

  return (
    <>
      {visible.map((team) => (
        <Box key={team.id}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: "#161616" }}
            >
              {team.name}
            </Typography>
            <Chip
              label={getTeamRoleLabel(team.role)}
              size="small"
              sx={{
                height: "18px",
                fontSize: "10px",
                fontWeight: 500,
                backgroundColor: getTeamRoleColor(team.role).bg,
                color: getTeamRoleColor(team.role).color,
                "& .MuiChip-label": {
                  padding: "0 6px",
                },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: "#666" }}>
            {team.organization.shortName}
            {team.areas.length > 0 &&
              ` - ${team.areas.map((a) => a.name).join(", ")}`}
          </Typography>
        </Box>
      ))}
      {remaining > 0 && (
        <Typography
          component="button"
          variant="body2"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          sx={{
            color: "#000091",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            textDecoration: "underline",
            fontSize: "12px",
            textAlign: "left",
            "&:hover": { color: "#1212FF" },
          }}
        >
          {expanded
            ? "Voir moins"
            : `+${remaining} équipe${remaining > 1 ? "s" : ""}`}
        </Typography>
      )}
    </>
  );
}
