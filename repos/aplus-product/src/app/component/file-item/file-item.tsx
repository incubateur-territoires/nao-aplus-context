import { FileReference } from "@/types/file";
import Button from "@codegouvfr/react-dsfr/Button";

export function FileItem({
  file,
  color,
}: {
  file: FileReference;
  color: "white" | "blue";
}) {
  function handleFileClick() {
    const url = `/api/files/${encodeURIComponent(file.id)}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.click();
  }
  return (
    <div className=" flex items-center gap-2">
      <Icon color={color} />
      <Button
        priority="tertiary no outline"
        key={file.name}
        className={`underline underline-offset-4 hover:opacity-80 text-sm  m-0 cursor-pointer bg-transparent  p-0 font-regular ${color === "white" ? "text-white" : "text-[#3A3A3A]"}`}
        onClick={handleFileClick}
        type="button"
      >
        {file.name}
      </Button>
    </div>
  );
}

export function Icon({ color }: { color: "white" | "blue" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 23 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M13.6668 16.0003V8.66699C13.6668 7.2525 13.1049 5.89595 12.1047 4.89576C11.1045 3.89556 9.74798 3.33366 8.3335 3.33366C6.91901 3.33366 5.56245 3.89556 4.56226 4.89576C3.56207 5.89595 3.00016 7.2525 3.00016 8.66699V16.0003C3.00016 18.2989 3.91325 20.5033 5.53857 22.1286C7.16389 23.7539 9.36829 24.667 11.6668 24.667C13.9654 24.667 16.1698 23.7539 17.7951 22.1286C19.4204 20.5033 20.3335 18.2989 20.3335 16.0003V3.33366H23.0002V16.0003C23.0002 19.0061 21.8061 21.8888 19.6807 24.0142C17.5553 26.1396 14.6726 27.3337 11.6668 27.3337C8.66104 27.3337 5.77836 26.1396 3.65295 24.0142C1.52754 21.8888 0.333496 19.0061 0.333496 16.0003V8.66699C0.333496 6.54526 1.17635 4.51043 2.67664 3.01014C4.17693 1.50985 6.21176 0.666992 8.3335 0.666992C10.4552 0.666992 12.4901 1.50985 13.9903 3.01014C15.4906 4.51043 16.3335 6.54526 16.3335 8.66699V16.0003C16.3335 17.238 15.8418 18.425 14.9667 19.3002C14.0915 20.1753 12.9045 20.667 11.6668 20.667C10.4292 20.667 9.24217 20.1753 8.367 19.3002C7.49183 18.425 7.00016 17.238 7.00016 16.0003V8.66699H9.66683V16.0003C9.66683 16.5308 9.87754 17.0395 10.2526 17.4145C10.6277 17.7896 11.1364 18.0003 11.6668 18.0003C12.1973 18.0003 12.706 17.7896 13.081 17.4145C13.4561 17.0395 13.6668 16.5308 13.6668 16.0003Z"
        fill={color === "white" ? "white" : "#000091"}
      />
    </svg>
  );
}
