"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { useState, ReactNode } from "react";

export function Row({
  label,
  labelElement,
  value,
  boldReversed,
  allXs,
  withCopyButton,
  helpText,
  disabled,
}: {
  label?: string;
  labelElement?: ReactNode;
  value: string | undefined | null;
  boldReversed?: boolean;
  allXs?: boolean;
  withCopyButton?: boolean;
  helpText?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!value && !labelElement) return null;

  async function handleCopy() {
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy: ", err);
      }
    }
  }
  const labelContent =
    labelElement ?? (disabled ? `${label} (inactif)` : label);

  return (
    <div className={`flex flex-col ${disabled ? "opacity-50" : ""}`}>
      <p
        className={`text-[#3A3A3A]  m-0 ${boldReversed ? "font-bold " : "text-xs font-regular"}`}
      >
        {labelContent}
      </p>
      {value ? (
        <div
          className={`flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4 ${withCopyButton ? "mt-4" : ""}`}
        >
          <p
            className={`text-md m-0 flex-1 min-w-0 break-all  text-[#3A3A3A] whitespace-pre-line ${
              boldReversed ? "text-xs" : "font-bold "
            } ${allXs ? "text-xs" : ""}`}
          >
            {value}
          </p>
          {withCopyButton ? (
            <Button
              priority={copied ? "secondary" : "tertiary"}
              iconId={copied ? "ri-check-line" : "ri-file-copy-line"}
              size="small"
              onClick={handleCopy}
              className={`shrink-0 transition-all duration-200 ${copied ? "bg-green-100 text-green-700 border-green-200" : "hover:bg-blue-50"}`}
              disabled={copied}
              title={
                label
                  ? copied
                    ? `${label} copié`
                    : `Copier ${label}`
                  : undefined
              }
            >
              {copied ? "Copié !" : "Copier"}
              {label ? <span className="sr-only"> {label}</span> : null}
            </Button>
          ) : null}
        </div>
      ) : null}
      {helpText ? <p className="text-xs mt-2 mb-0">{helpText}</p> : null}
    </div>
  );
}
