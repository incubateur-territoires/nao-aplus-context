"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Drawer,
  IconButton,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  Close as CloseIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

interface CronTasksWidgetDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DigestResult {
  usersProcessed: number;
  emailsSent: number;
  usersSkipped: number;
  errorsCount: number;
}

export function CronTasksWidgetDrawer({
  open,
  onOpenChange,
}: CronTasksWidgetDrawerProps) {
  const trpc = useTRPC();
  const [lastResult, setLastResult] = useState<DigestResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const digestMutation = useMutation({
    ...trpc.cron.runDigest.mutationOptions(),
    onSuccess: (data) => {
      if (data.success && data.result) {
        setLastResult(data.result);
        setLastError(null);
      } else {
        setLastError(data.error ?? "Erreur inconnue");
        setLastResult(null);
      }
    },
    onError: (error) => {
      setLastError(error.message);
      setLastResult(null);
    },
  });

  function handleRunDigest() {
    setLastResult(null);
    setLastError(null);
    digestMutation.mutate();
  }

  function handleClose() {
    onOpenChange(false);
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 420 },
          maxWidth: "100%",
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, fontSize: "18px", color: "#111827" }}
          >
            Tâche cron - Digest
          </Typography>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{ color: "#6B7280" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, padding: "20px", overflow: "auto" }}>
          {/* Digest Task Card */}
          <Box
            sx={{
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "16px",
              backgroundColor: "#FAFAFA",
            }}
          >
            <Box
              sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  backgroundColor: "#FF6B00",
                  flexShrink: 0,
                }}
              >
                <NotificationsIcon sx={{ fontSize: 24, color: "white" }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 600, fontSize: "15px", color: "#111827" }}
                  >
                    Digest notifications
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "12px",
                      color: "#6B7280",
                      backgroundColor: "#F3F4F6",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    1x/heure
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}
                >
                  Envoie les emails de résumé aux utilisateurs
                </Typography>
              </Box>
            </Box>

            {/* Action Button */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleRunDigest}
                disabled={digestMutation.isPending}
                startIcon={
                  digestMutation.isPending ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : null
                }
                sx={{
                  backgroundColor: "#FF6B00",
                  "&:hover": { backgroundColor: "#E55D00" },
                  textTransform: "none",
                  fontWeight: 500,
                  fontSize: "13px",
                  padding: "6px 16px",
                }}
              >
                {digestMutation.isPending ? "Exécution..." : "Lancer"}
              </Button>
            </Box>

            {/* Result */}
            {lastResult && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  padding: "10px 12px",
                  backgroundColor: "#ECFDF5",
                  borderRadius: "8px",
                  border: "1px solid #A7F3D0",
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 18, color: "#059669" }} />
                <Typography
                  variant="body2"
                  sx={{ fontSize: "13px", color: "#047857" }}
                >
                  {lastResult.emailsSent} email(s) envoyé(s)
                  {lastResult.usersSkipped > 0 &&
                    `, ${lastResult.usersSkipped} ignoré(s)`}
                  {lastResult.errorsCount > 0 &&
                    `, ${lastResult.errorsCount} erreur(s)`}
                </Typography>
              </Box>
            )}

            {/* Error */}
            {lastError && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  padding: "10px 12px",
                  backgroundColor: "#FEF2F2",
                  borderRadius: "8px",
                  border: "1px solid #FECACA",
                }}
              >
                <ErrorIcon sx={{ fontSize: 18, color: "#DC2626" }} />
                <Typography
                  variant="body2"
                  sx={{ fontSize: "13px", color: "#B91C1C" }}
                >
                  {lastError}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
