"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import Select from "@codegouvfr/react-dsfr/Select";
import Input from "@codegouvfr/react-dsfr/Input";
import Button from "@codegouvfr/react-dsfr/Button";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Notice from "@codegouvfr/react-dsfr/Notice";
import DOMPurify from "isomorphic-dompurify";

const SEVERITY_OPTIONS = [
  { value: "info", label: "Information (bleu)" },
  { value: "warning", label: "Avertissement (orange)" },
  { value: "alert", label: "Alerte (rouge)" },
] as const;

type Severity = "info" | "warning" | "alert";

export function BannerForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: banner } = useQuery(trpc.banner.getAdmin.queryOptions());

  const [severity, setSeverity] = useState<Severity>("info");
  const [content, setContent] = useState("");
  const [displayOnPublicPages, setDisplayOnPublicPages] = useState(false);
  const isBannerPublished = Boolean(banner?.isActive);

  useEffect(() => {
    if (banner) {
      setSeverity(banner.severity as Severity);
      setContent(banner.content);
      setDisplayOnPublicPages(banner.displayOnPublicPages);
      return;
    }

    setSeverity("info");
    setContent("");
    setDisplayOnPublicPages(false);
  }, [banner]);

  const upsertMutation = useMutation(
    trpc.banner.upsert.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["banner"]] });
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.banner.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["banner"]] });
      },
    }),
  );

  function handlePublish() {
    upsertMutation.mutate({ severity, content, displayOnPublicPages });
  }

  function handleDelete() {
    deleteMutation.mutate();
  }

  function handleTogglePublication() {
    if (isBannerPublished) {
      handleDelete();
      return;
    }

    handlePublish();
  }

  return (
    <div className="fr-card fr-card--no-border fr-p-4w fr-mb-4w">
      <div className="flex items-center justify-between fr-mb-2w">
        <h2 className="fr-h4 fr-mb-0">Bandeau d&apos;information</h2>
        <Badge severity={isBannerPublished ? "success" : "info"}>
          {isBannerPublished ? "Publié" : "Non publié"}
        </Badge>
      </div>

      <Select
        label="Type de bandeau"
        disabled={isBannerPublished}
        nativeSelectProps={{
          value: severity,
          onChange: (e) => setSeverity(e.target.value as Severity),
        }}
      >
        {SEVERITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Input
        label="Texte du bandeau"
        hintText="Au format html"
        disabled={isBannerPublished}
        textArea
        nativeTextAreaProps={{
          value: content,
          onChange: (e) => setContent(e.target.value),
          rows: 4,
        }}
      />

      <div className="fr-mb-4w">
        <ToggleSwitch
          label="Bandeau visible par les utilisateurs non-connectés"
          checked={displayOnPublicPages}
          onChange={(checked) => setDisplayOnPublicPages(checked)}
          disabled={isBannerPublished}
        />
      </div>

      {content && (
        <div className="fr-mb-4w">
          <p className="fr-text--bold fr-mb-1w">Aperçu</p>
          <Notice
            title=""
            severity={severity}
            description={
              <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(content),
                }}
              />
            }
          />
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button
          priority={isBannerPublished ? "tertiary" : "primary"}
          onClick={handleTogglePublication}
          disabled={
            upsertMutation.isPending ||
            deleteMutation.isPending ||
            (!isBannerPublished && !content.trim())
          }
        >
          {isBannerPublished
            ? "Dépublier le bandeau d'information"
            : "Publier le bandeau d'information"}
        </Button>
      </div>
    </div>
  );
}
