import { cn } from "@/utils/utils";

export const Container = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("mx-auto fr-container  w-full  mb-30 ", className)}>
      {children}
    </div>
  );
};
