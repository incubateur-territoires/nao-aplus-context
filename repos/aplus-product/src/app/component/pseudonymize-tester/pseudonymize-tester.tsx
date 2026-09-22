"use client";

import { useState } from "react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import Button from "@codegouvfr/react-dsfr/Button";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import type {
  PipelineEvent,
  PipelineResult,
  PipelineStepName,
} from "@/lib/ai/pipeline";

type StepStatus = "pending" | "running" | "done";

const STEP_ORDER: { key: PipelineStepName; label: string }[] = [
  { key: "pseudonymize", label: "Pseudonymisation (locale)" },
  { key: "names", label: "Détection de noms (IA)" },
  { key: "summary", label: "Résumé" },
  { key: "oneline", label: "Résumé court" },
  { key: "tags", label: "Tags" },
  { key: "guard", label: "Vérification anti-PII" },
];

const INITIAL_STEPS: Record<PipelineStepName, StepStatus> = {
  pseudonymize: "pending",
  names: "pending",
  summary: "pending",
  oneline: "pending",
  tags: "pending",
  guard: "pending",
};

const STATUS_ICON: Record<StepStatus, string> = {
  pending: "○",
  running: "⏳",
  done: "✓",
};

const SAMPLE_DESCRIPTION = `M. Dupont (NIR 1 80 12 75 116 207 16) attend depuis 8 mois le versement de son RSA de 600 euros. Joignable au 06 12 34 56 78. Dossier CAF 1234567 ouvert en 2023.`;

const PRE_STYLE: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  background: "var(--background-alt-grey)",
};

export function PseudonymizeTester() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [maritalName, setMaritalName] = useState("");

  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleEvent(event: PipelineEvent) {
    if (event.type === "step") {
      setSteps((prev) => ({ ...prev, [event.step]: event.status }));
    } else if (event.type === "result") {
      setResult(event.result);
    } else if (event.type === "error") {
      setError(event.message);
    }
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);
    setSteps(INITIAL_STEPS);

    try {
      const response = await fetch("/ia/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { subject, description },
          identity: { firstName, lastName, maritalName },
        }),
      });

      if (!response.body) throw new Error("Réponse sans flux.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handleEvent(JSON.parse(line) as PipelineEvent);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSample() {
    setSubject("Blocage versement RSA");
    setDescription(SAMPLE_DESCRIPTION);
    setFirstName("Jean");
    setLastName("Dupont");
    setMaritalName("");
  }

  const matches = result?.pseudonymized.matches ?? [];
  const hasStarted = isLoading || result !== null || error !== null;

  return (
    <div className="fr-grid-row fr-grid-row--gutters">
      <form className="fr-col-12 fr-col-md-6" onSubmit={handleSubmit}>
        <h2 className="fr-h4">Signalement à tester</h2>

        <Input
          label="Sujet"
          nativeInputProps={{
            value: subject,
            onChange: (e) => setSubject(e.target.value),
          }}
        />
        <Input
          label="Description"
          textArea
          nativeTextAreaProps={{
            value: description,
            rows: 8,
            onChange: (e) => setDescription(e.target.value),
          }}
        />

        <h3 className="fr-h6 fr-mt-2w">
          Identité du citoyen (dictionnaire de noms, optionnel)
        </h3>
        <Input
          label="Prénom"
          nativeInputProps={{
            value: firstName,
            onChange: (e) => setFirstName(e.target.value),
          }}
        />
        <Input
          label="Nom"
          nativeInputProps={{
            value: lastName,
            onChange: (e) => setLastName(e.target.value),
          }}
        />
        <Input
          label="Nom marital"
          nativeInputProps={{
            value: maritalName,
            onChange: (e) => setMaritalName(e.target.value),
          }}
        />

        <div className="fr-btns-group fr-btns-group--inline fr-mt-2w">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Traitement…" : "Lancer le pipeline"}
          </Button>
          <Button type="button" priority="secondary" onClick={handleSample}>
            Exemple
          </Button>
        </div>
      </form>

      <div className="fr-col-12 fr-col-md-6">
        <h2 className="fr-h4">Résultat</h2>

        {!hasStarted ? (
          <p className="fr-text--sm fr-text-mention--grey">
            Soumets un signalement pour lancer le pipeline.
          </p>
        ) : (
          <>
            <h3 className="fr-h6">Progression</h3>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {STEP_ORDER.map(({ key, label }) => {
                const status = steps[key];
                return (
                  <li
                    key={key}
                    className="fr-mb-1v"
                    style={{
                      color:
                        status === "done"
                          ? "var(--text-default-success)"
                          : status === "running"
                            ? "var(--text-default-info)"
                            : "var(--text-mention-grey)",
                    }}
                  >
                    <span aria-hidden style={{ marginRight: 8 }}>
                      {STATUS_ICON[status]}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ul>

            {error && (
              <Alert
                severity="error"
                small
                description={error}
                className="fr-mb-2w"
              />
            )}

            {result && (
              <>
                {result.oneLine && (
                  <>
                    <h3 className="fr-h6 fr-mt-2w">Résumé en une ligne</h3>
                    <pre className="fr-p-1w" style={PRE_STYLE}>
                      {result.oneLine}
                    </pre>
                  </>
                )}

                <h3 className="fr-h6 fr-mt-2w">Résumé</h3>
                <pre className="fr-p-1w" style={PRE_STYLE}>
                  {result.summary}
                </pre>

                <Alert
                  severity={result.guard.ok ? "success" : "error"}
                  small
                  description={
                    result.guard.ok
                      ? "Guardrail no-pii : aucune PII détectée dans le résumé."
                      : `Guardrail no-pii : PII résiduelle — ${result.guard.violations
                          .map((v) => `${v.type} : ${v.value}`)
                          .join(" · ")}`
                  }
                  className="fr-mt-1w fr-mb-2w"
                />

                {(result.tags.themes.length > 0 ||
                  result.tags.natures.length > 0) && (
                  <>
                    <h3 className="fr-h6 fr-mt-2w">Tags</h3>
                    {result.tags.themes.length > 0 && (
                      <ul className="fr-tags-group">
                        {result.tags.themes.map((theme) => (
                          <li key={`theme-${theme}`}>
                            <Tag small>{theme}</Tag>
                          </li>
                        ))}
                      </ul>
                    )}
                    {result.tags.natures.length > 0 && (
                      <ul className="fr-tags-group fr-mt-1w">
                        {result.tags.natures.map((nature) => (
                          <li key={`nature-${nature}`}>
                            <Tag small>{nature}</Tag>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                <h3 className="fr-h6 fr-mt-2w">
                  Texte envoyé à Albert (caviardé)
                </h3>
                <pre className="fr-p-1w" style={PRE_STYLE}>
                  {result.pseudonymized.subject || "—"}
                  {"\n\n"}
                  {result.pseudonymized.description || "—"}
                </pre>

                <h3 className="fr-h6 fr-mt-2w">PII détectées</h3>
                {matches.length === 0 ? (
                  <p className="fr-text--sm">Aucune.</p>
                ) : (
                  <table
                    className="fr-table fr-table--bordered"
                    style={{ display: "table", width: "100%" }}
                  >
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Valeur originale</th>
                        <th>Jeton</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => (
                        <tr key={match.placeholder}>
                          <td>{match.type}</td>
                          <td>{match.value}</td>
                          <td>
                            <code>{match.placeholder}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
