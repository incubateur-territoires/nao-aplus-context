export function scrollToFirstError() {
  const errors = document.querySelectorAll(".fr-error-text");
  if (errors) {
    errors[0]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}
