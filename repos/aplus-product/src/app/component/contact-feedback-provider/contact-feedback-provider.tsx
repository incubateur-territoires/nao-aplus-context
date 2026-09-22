"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ContactFeedbackContextValue {
  isSent: boolean;
  setIsSent: (value: boolean) => void;
}

// Default value lets <ContactForm /> work standalone (e.g. in tests) without a
// provider: the confirmation alert simply won't render anywhere.
const ContactFeedbackContext = createContext<ContactFeedbackContextValue>({
  isSent: false,
  setIsSent: () => {},
});

export function ContactFeedbackProvider({ children }: { children: ReactNode }) {
  const [isSent, setIsSent] = useState(false);

  return (
    <ContactFeedbackContext.Provider value={{ isSent, setIsSent }}>
      {children}
    </ContactFeedbackContext.Provider>
  );
}

export function useContactFeedback() {
  return useContext(ContactFeedbackContext);
}
