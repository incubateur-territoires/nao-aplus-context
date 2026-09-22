import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactFormLink, CONTACT_FORM_ANCHOR } from "./contact-form-link";

describe("ContactFormLink", () => {
  it("renders an in-page anchor to the contact form", () => {
    render(<ContactFormLink>nous contacter</ContactFormLink>);

    const link = screen.getByRole("link", { name: "nous contacter" });
    expect(link).toHaveAttribute("href", `#${CONTACT_FORM_ANCHOR}`);
  });

  it("smooth-scrolls to the form and moves focus on click", async () => {
    const user = userEvent.setup();

    const target = document.createElement("div");
    target.id = CONTACT_FORM_ANCHOR;
    // scrollIntoView isn't implemented in jsdom, so we stub it directly.
    const scrollIntoView = jest.fn();
    target.scrollIntoView = scrollIntoView;
    const focus = jest.spyOn(target, "focus").mockImplementation(() => {});
    document.body.appendChild(target);

    render(<ContactFormLink>nous contacter</ContactFormLink>);
    await user.click(screen.getByRole("link", { name: "nous contacter" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    document.body.removeChild(target);
  });
});
