"use client";

import { useState } from "react";
import { Box, Typography } from "@mui/material";
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Notifications as NotificationsIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useTRPC } from "@/trpc/client";
import { USER_ROLES } from "@/constants/user-roles";
import { ImpersonationWidget } from "../impersonation-widget/impersonation-widget";
import { EmailDebugWidgetDrawer } from "../email-debug-widget/email-debug-widget";
import { CronTasksWidgetDrawer } from "../cron-tasks-widget/cron-tasks-widget";

interface DevToolsWidgetProps {
  showEmailDebug?: boolean;
}

export function DevToolsWidget({
  showEmailDebug = false,
}: DevToolsWidgetProps) {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const [impersonationOpen, setImpersonationOpen] = useState(false);
  const [emailDebugOpen, setEmailDebugOpen] = useState(false);
  const [cronTasksOpen, setCronTasksOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const { data: emails = [] } = useQuery({
    ...trpc.debug.getEmails.queryOptions(),
    enabled: showEmailDebug,
  });

  const currentUser = session?.user;
  const userDisplayName = currentUser
    ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
      currentUser.email
    : null;
  const userRole = currentUser?.role as string | undefined;

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

  if (!userDisplayName || !isVisible) {
    return null;
  }

  return (
    <>
      <Box
        className="fixed bottom-6 right-6 z-50"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          backgroundColor: "white",
          padding: "14px 16px",
          borderRadius: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)",
          border: "1px solid #E5E7EB",
          minWidth: "240px",
          maxWidth: "280px",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <Box
          component="button"
          onClick={() => setIsVisible(false)}
          aria-label="Fermer"
          sx={{
            position: "absolute",
            top: "8px",
            right: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            color: "#9CA3AF",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              backgroundColor: "#F3F4F6",
              color: "#6B7280",
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </Box>

        {/* User Info Row - Impersonation */}
        <Box
          onClick={() => setImpersonationOpen(true)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            cursor: "pointer",
            padding: "4px",
            borderRadius: "8px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              backgroundColor: "#F9FAFB",
            },
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

        {/* Email Debug Row */}
        {showEmailDebug && (
          <Box
            onClick={() => setEmailDebugOpen(true)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              cursor: "pointer",
              padding: "4px",
              borderRadius: "8px",
              borderTop: "1px solid #F3F4F6",
              paddingTop: "12px",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                backgroundColor: "#F9FAFB",
              },
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
                backgroundColor: "#1976d2",
                flexShrink: 0,
              }}
            >
              <EmailIcon sx={{ fontSize: 22, color: "white" }} />
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
                }}
              >
                Emails ({emails.length})
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: 0.25,
                }}
              >
                Voir les emails envoyés
              </Typography>
            </Box>
          </Box>
        )}

        {/* Cron Tasks Row */}
        {showEmailDebug && (
          <Box
            onClick={() => setCronTasksOpen(true)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              cursor: "pointer",
              padding: "4px",
              borderRadius: "8px",
              borderTop: "1px solid #F3F4F6",
              paddingTop: "12px",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                backgroundColor: "#F9FAFB",
              },
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
                backgroundColor: "#FF6B00",
                flexShrink: 0,
              }}
            >
              <NotificationsIcon sx={{ fontSize: 22, color: "white" }} />
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
                }}
              >
                Digest
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: 0.25,
                }}
              >
                Lancer manuellement
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Drawers */}
      <ImpersonationWidget
        open={impersonationOpen}
        onOpenChange={setImpersonationOpen}
      />
      {showEmailDebug && (
        <EmailDebugWidgetDrawer
          open={emailDebugOpen}
          onOpenChange={setEmailDebugOpen}
        />
      )}
      {showEmailDebug && (
        <CronTasksWidgetDrawer
          open={cronTasksOpen}
          onOpenChange={setCronTasksOpen}
        />
      )}
    </>
  );
}
