"use client";

import { FileItem } from "@/app/component/file-item/file-item";
import { FileReference } from "@/types/file";
import Image from "next/image";
import Button from "@codegouvfr/react-dsfr/Button";

const MANDATE_FILE_NAME = "Mandat.pdf";

export function Documents({ files }: { files: FileReference[] }) {
  if (files.length === 0) return null;

  const mandateFile = files.find((f) => f.name === MANDATE_FILE_NAME);
  const otherFiles = files.filter((f) => f.name !== MANDATE_FILE_NAME);

  return (
    <div>
      <h5>Documents joints</h5>
      <div className="flex flex-col">
        {mandateFile && <MandateItem file={mandateFile} />}
        {otherFiles.map((file) => (
          <FileItem key={file.id} file={file} color="blue" />
        ))}
      </div>
    </div>
  );
}

function MandateItem({ file }: { file: FileReference }) {
  function handleClick() {
    const url = `/api/files/${encodeURIComponent(file.id)}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.click();
  }

  return (
    <div className="flex items-center gap-2">
      <Image
        className="w-4 h-4"
        src="/assets/picto/mandate.svg"
        // RGAA 1.2 : icône décorative (le nom du fichier est déjà affiché à côté).
        alt=""
        width={16}
        height={16}
      />
      <Button
        priority="tertiary no outline"
        className="underline underline-offset-4 text-[#3A3A3A] text-sm m-0 cursor-pointer bg-transparent p-0 hover:opacity-80 font-regular"
        onClick={handleClick}
        type="button"
      >
        {MANDATE_FILE_NAME}
      </Button>
    </div>
  );
}
