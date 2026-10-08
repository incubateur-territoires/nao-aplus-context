import { redirect } from "next/navigation";
import { ROUTE } from "@/app/constant/route";

export default function AdminPage() {
  redirect(ROUTE.ADMIN_BANNER);
}
