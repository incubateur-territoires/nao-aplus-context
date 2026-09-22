import Button from "@codegouvfr/react-dsfr/Button";
import { useState } from "react";

interface InputFileProps {
  value?: File[];
  onChange: (files: File[]) => void;
  name?: string;
  label?: React.ReactNode;
  isLoading?: boolean;
}

const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export function InputFile({
  onChange,
  label = "Ajouter un ou plusieurs fichier(s) (optionnel)",
  name,
  value = [],
  isLoading: isLoadingProp,
}: InputFileProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputId = name || "input-file";

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setIsLoading(true);
    const files = Array.from(e.target.files || []);
    const invalidType = files.find((f) => !ACCEPTED_TYPES.includes(f.type));
    const invalidSize = files.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (invalidType) {
      setError(
        `Taille maximale totale (tous les fichiers) : 5 Mo. Formats supportés : jpg, png, pdf. Plusieurs fichiers possibles.`,
      );
      setIsLoading(false);
      return;
    }
    if (invalidSize) {
      setError(`La taille maximale du ou des fichier(s) dépasse 5 Mo. `);
      setIsLoading(false);
      return;
    }
    // Merge with previous files, avoid duplicates by name+size
    const merged = [...value, ...files].reduce<File[]>((acc, file) => {
      if (!acc.some((f) => f.name === file.name && f.size === file.size))
        acc.push(file);
      return acc;
    }, []);
    await Promise.resolve(onChange(merged));
    setIsLoading(false);
    // Reset input value so same file can be re-selected if deleted
    e.target.value = "";
  }

  function handleDelete(idx: number) {
    const newFiles = value.filter((_, i) => i !== idx);
    onChange(newFiles);
  }

  return (
    <div className="flex flex-col gap-2 ">
      <label htmlFor={inputId} className="text-black">
        {label}
      </label>
      <span className="text-xs text-gray-500">
        Taille maximale : 5 Mo. Formats supportés : jpg, png, pdf. Plusieurs
        fichiers possibles.
      </span>
      <div className="flex items-center gap-2">
        <Button
          priority="tertiary no outline"
          className="my-4 bg-[#EEEEEE] text-sm  font-normal text-black rounded-md border-none hover:opacity-80 underline-offset-4"
          type="button"
          size="small"
          onClick={() => {
            document.getElementById(inputId)?.click();
          }}
          disabled={isLoadingProp ?? isLoading}
        >
          Parcourir...
          {typeof label === "string" ? (
            <span className="sr-only"> — {label}</span>
          ) : null}
        </Button>
        {(isLoadingProp ?? isLoading) && (
          <span className="ml-2 text-xs text-gray-500 animate-pulse">
            Chargement…
          </span>
        )}
      </div>
      {error && (
        <span
          id={`${inputId}-error`}
          role="alert"
          className="text-xs text-[#ce0500] flex items-center gap-2 -mt-2"
        >
          <span className="text-[#ce0500] fr-icon-error-fill fr-icon-sm"></span>
          {error}
        </span>
      )}
      {Array.isArray(value) && value.length > 0 && (
        <div className="text-xs text-gray-700 space-y-4">
          {value.map((file: File, i: number) => (
            <div
              key={file.name + file.size + i}
              className="flex items-center gap-2 flex-wrap"
            >
              <div className="flex items-center gap-2">
                <p className="truncate max-w-xs text-md m-0 ">{file.name}</p>
              </div>
              <Button
                priority="tertiary"
                type="button"
                size="small"
                iconId="ri-delete-bin-line"
                onClick={() => handleDelete(i)}
              >
                Supprimer
              </Button>
            </div>
          ))}
        </div>
      )}
      <input
        id={inputId}
        name={name}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.pdf"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={handleChange}
        className="hidden cursor-pointer file:mr-2 file:py-2 file:px-4 file:rounded  file:bg-[#EEEEEE] file:text-sm file:font-medium "
      />
    </div>
  );
}
