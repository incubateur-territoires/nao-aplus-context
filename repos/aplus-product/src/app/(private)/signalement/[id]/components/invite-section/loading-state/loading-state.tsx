import { Spinner } from "@/app/component/spinner/spinner";

export function LoadingState() {
  return (
    <div className="flex justify-center items-center min-h-md bg-white p-20 rounded-md">
      <Spinner />
    </div>
  );
}
