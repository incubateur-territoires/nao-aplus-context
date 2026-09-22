import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactSuccessAlert } from "./contact-success-alert";
import {
  ContactFeedbackProvider,
  useContactFeedback,
} from "../contact-feedback-provider/contact-feedback-provider";

// jsdom n'implémente pas scrollIntoView (appelé par useFocusOnVisible)
Element.prototype.scrollIntoView = jest.fn();

function TriggerButton() {
  const { setIsSent } = useContactFeedback();
  return <button onClick={() => setIsSent(true)}>Trigger</button>;
}

describe("ContactSuccessAlert", () => {
  it("renders nothing when no message has been sent", () => {
    render(
      <ContactFeedbackProvider>
        <ContactSuccessAlert />
      </ContactFeedbackProvider>,
    );

    expect(
      screen.queryByText("Votre message a bien été envoyé."),
    ).not.toBeInTheDocument();
  });

  it("shows the confirmation once a message has been sent", async () => {
    const user = userEvent.setup();

    render(
      <ContactFeedbackProvider>
        <TriggerButton />
        <ContactSuccessAlert />
      </ContactFeedbackProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Trigger" }));

    expect(
      screen.getByText("Votre message a bien été envoyé."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Notre équipe de support répond généralement sous 1 à 2 jours ouvrés.",
      ),
    ).toBeInTheDocument();
  });

  it("moves focus to the confirmation when it appears (RGAA)", async () => {
    const user = userEvent.setup();

    render(
      <ContactFeedbackProvider>
        <TriggerButton />
        <ContactSuccessAlert />
      </ContactFeedbackProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Trigger" }));

    // The focusable wrapper around the Alert should receive focus.
    const alert = screen.getByText("Votre message a bien été envoyé.");
    const wrapper = alert.closest("[tabindex='-1']");
    expect(wrapper).not.toBeNull();
    expect(document.activeElement).toBe(wrapper);
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();

    render(
      <ContactFeedbackProvider>
        <TriggerButton />
        <ContactSuccessAlert />
      </ContactFeedbackProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Trigger" }));
    await user.click(
      screen.getByRole("button", { name: /Masquer le message/ }),
    );

    expect(
      screen.queryByText("Votre message a bien été envoyé."),
    ).not.toBeInTheDocument();
  });
});
