"use client";

import { MouseEvent, ReactNode } from "react";

// Shared between the link and the form container (in the contact page) so the
// anchor stays in sync with its target.
export const CONTACT_FORM_ANCHOR = "contact-form";

export function ContactFormLink({ children }: { children: ReactNode }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(CONTACT_FORM_ANCHOR);
    // Fall back to the native anchor jump if the target isn't found.
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView?.({ behavior: "smooth" });
    // Move focus to the form for keyboard and screen-reader users; the smooth
    // scroll above keeps the visual transition.
    target.focus({ preventScroll: true });
  }

  return (
    <a href={`#${CONTACT_FORM_ANCHOR}`} onClick={handleClick}>
      {children}
    </a>
  );
}
