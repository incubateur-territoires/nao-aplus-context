interface FormErrorProps {
  message: string;
}

export function FormError({ message }: FormErrorProps) {
  return <p className="text-red-500 mt-4">Erreur: {message}</p>;
}
