import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { OptionalMessageInput } from "./optional-message-input";
import { InviteColleagueFormValues } from "../invite-colleague.schema";

function FormWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<InviteColleagueFormValues>;
}) {
  const methods = useForm<InviteColleagueFormValues>({
    defaultValues: {
      colleagueIds: [],
      message: "",
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("OptionalMessageInput", () => {
  it("renders the message input with label and hint text", () => {
    render(
      <FormWrapper>
        <OptionalMessageInput />
      </FormWrapper>,
    );

    expect(screen.getByText("Votre message (optionnel)")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Le message sera ajouté à la conversation. Il ne sera pas transmis dans l'e-mail d'invitation.",
      ),
    ).toBeInTheDocument();
  });

  it("displays the current message value", () => {
    render(
      <FormWrapper defaultValues={{ message: "Test message" }}>
        <OptionalMessageInput />
      </FormWrapper>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Test message");
  });

  it("updates form value when text is entered", async () => {
    const user = userEvent.setup();
    let formValues: InviteColleagueFormValues | undefined;

    function TestComponent() {
      const form = useForm<InviteColleagueFormValues>({
        defaultValues: {
          colleagueIds: [],
          message: "",
        },
      });

      formValues = form.watch();

      return (
        <FormProvider {...form}>
          <OptionalMessageInput />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "New message");

    expect(formValues?.message).toBe("New message");
  });
});
