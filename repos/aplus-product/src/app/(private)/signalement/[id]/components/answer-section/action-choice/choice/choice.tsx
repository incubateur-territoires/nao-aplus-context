"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import Image from "next/image";
import DOMPurify from "isomorphic-dompurify";
import { ActionChoiceValue } from "../action-choice";

export function Choice({
  label,
  onClick,
  description,
  icon,
  value,
}: {
  label: string;
  onClick: (value: ActionChoiceValue | null) => void;
  description: string;
  icon: string;
  selected: boolean;
  value: ActionChoiceValue;
}) {
  return (
    <Button
      onClick={() => onClick(value)}
      className="flex w-full p-4"
      style={{
        border: "1px solid #DDDDDD",
        backgroundColor: "white",
      }}
      priority="tertiary no outline"
    >
      <div className="w-full  text-left text-[#161616] font-regular">
        <div className="flex items-center gap-2">
          <i className="ri-checkbox-blank-circle-line text-blue-primary"></i>
          <div className="w-fit">
            <p className=" m-0 text-[#3A3A3A]">{label}</p>
            <p
              className="text-xs m-0 font-regular text-[#666666]"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(description),
              }}
            />
          </div>
        </div>
      </div>

      <div className="w-fit border-l border-[#DDDDDD] pl-4 min-h-12 flex items-center">
        <Image src={icon} alt={label} width={46} height={46} />
      </div>
    </Button>
  );
}

export function ChoiceSelected({
  label,
  onClick,
  description,
}: {
  label: string | undefined;
  onClick: (value: ActionChoiceValue | null) => void;
  description: string | undefined;
}) {
  if (!label) return null;
  return (
    <div
      className="flex w-full p-4 py-5 bg-blue-background"
      style={{
        border: "1px solid #DDDDDD",
      }}
    >
      <div className="w-full  text-left text-[#161616] font-regular">
        <div className="flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-blue-primary"></i>
          <div className="w-fit">
            <p className=" m-0 text-[#3A3A3A]">{label}</p>
            <p
              className="text-xs m-0 font-regular text-[#666666]"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(description || ""),
              }}
            />
          </div>
        </div>
      </div>

      <Button
        priority="secondary"
        size="small"
        iconId="ri-arrow-go-back-fill"
        iconPosition="right"
        className="w-fit whitespace-nowrap"
        onClick={() => {
          onClick(null);
        }}
      >
        Modifier votre choix
      </Button>
    </div>
  );
}
