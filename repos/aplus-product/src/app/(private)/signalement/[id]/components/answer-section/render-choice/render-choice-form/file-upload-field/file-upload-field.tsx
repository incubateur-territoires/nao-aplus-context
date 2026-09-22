import { InputFile } from "@/app/component/ui/input-file/input-file";
import { Control, Controller } from "react-hook-form";
import { FormValues } from "../types";

interface FileUploadFieldProps {
  control: Control<FormValues>;
}

export function FileUploadField({ control }: FileUploadFieldProps) {
  return (
    <Controller
      control={control}
      name="files"
      render={({ field }) => <InputFile {...field} />}
    />
  );
}
