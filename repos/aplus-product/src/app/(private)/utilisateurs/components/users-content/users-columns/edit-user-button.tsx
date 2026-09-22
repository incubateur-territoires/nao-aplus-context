import Button from "@codegouvfr/react-dsfr/Button";
import { useRouter } from "next/navigation";
import { ROUTE } from "@/app/constant/route";

export function EditUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <Button
      onClick={() => router.push(`${ROUTE.EDIT_USER}/${userId}`)}
      priority="secondary"
      size="small"
      className="px-2"
    >
      <span className="fr-icon-edit-line" aria-hidden="true" />
    </Button>
  );
}
