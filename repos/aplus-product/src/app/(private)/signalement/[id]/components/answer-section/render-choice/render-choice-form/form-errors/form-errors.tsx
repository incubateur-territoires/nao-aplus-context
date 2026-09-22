import { FormError } from "../form-error/form-error";

interface FormErrorsProps {
  isError: boolean;
  error?: { message: string } | null;
  apiError?: string | null;
}

/**
 * Display form validation and API errors
 */
export function FormErrors({ isError, error, apiError }: FormErrorsProps) {
  if (!isError && !apiError) return null;

  return (
    <>
      {isError && error && <FormError message={error.message} />}
      {apiError && <FormError message={apiError} />}
    </>
  );
}
