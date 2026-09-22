"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  TextField,
} from "@mui/material";
import {
  Close as CloseIcon,
  Email as EmailIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import Button from "@codegouvfr/react-dsfr/Button";
import type { DebugEmail } from "@/types/email-debug";

interface EmailDebugWidgetDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailDebugWidgetDrawer({
  open,
  onOpenChange,
}: EmailDebugWidgetDrawerProps) {
  const trpc = useTRPC();
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [mockSubject, setMockSubject] = useState("");
  const [mockRecipient, setMockRecipient] = useState("");

  const { data: emails = [], refetch } = useQuery({
    ...trpc.debug.getEmails.queryOptions(),
    refetchInterval: open ? 20000 : false,
  });

  const clearMutation = useMutation(
    trpc.debug.clearEmails.mutationOptions({
      onSuccess: () => {
        refetch();
      },
    }),
  );

  const addMockMutation = useMutation(
    trpc.debug.addMockEmail.mutationOptions({
      onSuccess: () => {
        refetch();
        setMockSubject("");
        setMockRecipient("");
        setShowAddForm(false);
      },
    }),
  );

  function handleClearEmails() {
    clearMutation.mutate();
  }

  function handleAddMock() {
    if (!mockSubject || !mockRecipient) return;
    addMockMutation.mutate({
      subject: mockSubject,
      recipientEmail: mockRecipient,
      htmlContent: `<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #000091;">Test Email</h1>
        <p>Sujet: ${mockSubject}</p>
        <p>Destinataire: ${mockRecipient}</p>
        <p>Ceci est un email de test ajouté manuellement pour le debug.</p>
      </div>`,
    });
  }

  function formatDate(date: Date | string) {
    const d = new Date(date);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => onOpenChange(false)}
      sx={{
        "& .MuiDrawer-paper": {
          width: "90vw",
          maxWidth: "900px",
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
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Emails envoyés (session)
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton
              onClick={() => setShowAddForm(!showAddForm)}
              title="Ajouter un email de test"
              color="primary"
            >
              <AddIcon />
            </IconButton>
            <IconButton onClick={() => refetch()} title="Rafraîchir">
              <RefreshIcon />
            </IconButton>
            <IconButton
              onClick={handleClearEmails}
              title="Vider"
              color="error"
              disabled={clearMutation.isPending}
            >
              <DeleteIcon />
            </IconButton>
            <IconButton onClick={() => onOpenChange(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Add Mock Email Form */}
        {showAddForm && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              backgroundColor: "#f5f5f5",
              borderRadius: 1,
              display: "flex",
              gap: 2,
              alignItems: "flex-end",
            }}
          >
            <TextField
              label="Sujet"
              value={mockSubject}
              onChange={(e) => setMockSubject(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Email destinataire"
              value={mockRecipient}
              onChange={(e) => setMockRecipient(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <Button
              size="small"
              onClick={handleAddMock}
              disabled={
                !mockSubject || !mockRecipient || addMockMutation.isPending
              }
            >
              Ajouter
            </Button>
          </Box>
        )}

        {/* Email List */}
        <Box sx={{ overflow: "auto", flex: 1 }}>
          {emails.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, color: "#666" }}>
              <EmailIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
              <Typography>Aucun email envoyé durant cette session</Typography>
              <Typography variant="body2" sx={{ mt: 1, color: "#999" }}>
                Utilisez le bouton + pour ajouter un email de test
              </Typography>
            </Box>
          ) : (
            emails.map((email) => (
              <Accordion
                key={email.id}
                expanded={expandedEmail === email.id}
                onChange={() =>
                  setExpandedEmail(expandedEmail === email.id ? null : email.id)
                }
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      width: "100%",
                    }}
                  >
                    <Chip
                      label={email.status === "sent" ? "Envoyé" : "Erreur"}
                      size="small"
                      color={email.status === "sent" ? "success" : "error"}
                    />
                    <Typography sx={{ fontWeight: 500, flex: 1 }}>
                      {email.subject}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#666" }}>
                      {formatDate(email.timestamp)}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <EmailDetails email={email} />
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

export function EmailDebugWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const trpc = useTRPC();

  const { data: emails = [] } = useQuery({
    ...trpc.debug.getEmails.queryOptions(),
  });

  return (
    <>
      {/* Toggle Button - Bottom Left */}
      <Box
        className="fixed bottom-6 left-6 z-50"
        onClick={() => setIsOpen(true)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          backgroundColor: "#1976d2",
          color: "white",
          padding: "10px 16px",
          borderRadius: "10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          cursor: "pointer",
          transition: "all 0.2s",
          "&:hover": {
            backgroundColor: "#1565c0",
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          },
        }}
      >
        <EmailIcon sx={{ fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Emails ({emails.length})
        </Typography>
      </Box>

      <EmailDebugWidgetDrawer open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

function EmailDetails({ email }: { email: DebugEmail }) {
  const [tab, setTab] = useState(0);

  const hasVariables =
    email.variables && Object.keys(email.variables).length > 0;

  return (
    <Box>
      {/* Metadata */}
      <Box sx={{ mb: 2, p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>De:</strong> {email.sender.name ?? email.sender.email} &lt;
          {email.sender.email}&gt;
        </Typography>
        <Typography variant="body2">
          <strong>À:</strong>{" "}
          {email.recipients
            .map((r) => (r.name ? `${r.name} <${r.email}>` : r.email))
            .join(", ")}
        </Typography>
        {email.cc && email.cc.length > 0 && (
          <Typography variant="body2">
            <strong>CC:</strong> {email.cc.map((r) => r.email).join(", ")}
          </Typography>
        )}
        {email.templateName && (
          <Typography variant="body2">
            <strong>Template:</strong> {email.templateName}
            {email.templateId && ` (ID: ${email.templateId})`}
          </Typography>
        )}
        {email.messageId && (
          <Typography variant="body2">
            <strong>Message ID:</strong> {email.messageId}
          </Typography>
        )}
        {email.error && (
          <Typography variant="body2" color="error">
            <strong>Erreur:</strong> {email.error}
          </Typography>
        )}
      </Box>

      {/* Content Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Aperçu HTML" />
        <Tab label="Texte brut" />
        {hasVariables && <Tab label="Variables" />}
      </Tabs>

      <Box sx={{ p: 2, border: "1px solid #e0e0e0", borderRadius: 1, mt: 1 }}>
        {tab === 0 && email.htmlContent && (
          <Box
            sx={{
              "& iframe": {
                width: "100%",
                minHeight: "400px",
                border: "none",
                backgroundColor: "white",
              },
            }}
          >
            <iframe
              srcDoc={email.htmlContent}
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </Box>
        )}
        {tab === 0 && !email.htmlContent && (
          <Typography color="textSecondary">
            Pas de contenu HTML (email basé sur un template Brevo)
          </Typography>
        )}
        {tab === 1 && (
          <Typography
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: "13px",
            }}
          >
            {email.textContent ?? "Pas de contenu texte"}
          </Typography>
        )}
        {tab === 2 && hasVariables && (
          <Typography
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: "13px",
            }}
          >
            {JSON.stringify(email.variables, null, 2)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
