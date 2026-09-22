import { HelperAvatarProps } from "../types";

export function HelperAvatar({
  isAuthorAnswer,
  isOperatorOnly,
}: HelperAvatarProps) {
  function getColor(isAuthorAnswer: boolean, isOperatorOnly: boolean) {
    if (isOperatorOnly) {
      return "#929292";
    }
    if (isAuthorAnswer) {
      return "#716043";
    }
    return "#3558A2";
  }

  function getBackground(isOperatorOnly: boolean, isAuthorAnswer: boolean) {
    if (isOperatorOnly) {
      return "#F6F6F6";
    }
    if (isAuthorAnswer) {
      return "#FEF6E3";
    }
    return "#F3F6FE";
  }

  const color = getColor(isAuthorAnswer, isOperatorOnly);
  const background = getBackground(isOperatorOnly, isAuthorAnswer);

  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      // RGAA 1.2 : avatar décoratif, ignoré par les technologies d'assistance.
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="32" fill={background} />
      <path
        d="M26 29C26 32.315 28.685 35 32 35C35.315 35 38 32.315 38 29C38 25.685 35.315 23 32 23C28.685 23 26 25.685 26 29Z"
        fill={color}
      />
      <path
        d="M32 36C27.5817 36 24 39.5817 24 44H40C40 39.5817 36.4183 36 32 36Z"
        fill={color}
      />
    </svg>
  );
}
