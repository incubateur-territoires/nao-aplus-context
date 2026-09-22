import { cn } from "@/utils/utils";
import Link from "next/link";

interface LinkButtonProps {
  label: string;
  href: string;
  className?: string;
  role?: React.AriaRole;
}

export function LinkButton({ label, href, className, role }: LinkButtonProps) {
  return (
    <Link
      className={cn("text-sm", className)}
      href={href}
      role={role}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      style={{
        color: "var(--color-blue-primary)",
      }}
    >
      <span className="ri-arrow-left-s-line  mr-2 text-blue-primary" />
      {label}
    </Link>
  );
}
