import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { useEffect } from "react";
import { MessageInput } from "./message-input";
import { InviteGroupsFormValues } from "../invite-groups.schema";

function FormWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<InviteGroupsFormValues>;
}) {
  const methods = useForm<InviteGroupsFormValues>({
    defaultValues: {
      areaId: "",
      teamIds: [],
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
        <MessageInput isRequired={false} />
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
        <MessageInput isRequired={false} />
      </FormWrapper>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Test message");
  });

  it("updates form value when text is entered", async () => {
    const user = userEvent.setup();
    let formValues: InviteGroupsFormValues | undefined;

    function TestComponent() {
      const form = useForm<InviteGroupsFormValues>({
        defaultValues: {
          areaId: "",
          teamIds: [],
          message: "",
        },
      });

      formValues = form.watch();

      return (
        <FormProvider {...form}>
          <MessageInput isRequired={false} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "New message");

    expect(formValues?.message).toBe("New message");
  });

  it("handles empty message value", () => {
    render(
      <FormWrapper defaultValues={{ message: "" }}>
        <MessageInput isRequired={false} />
      </FormWrapper>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("handles undefined message value", () => {
    render(
      <FormWrapper defaultValues={{ message: undefined }}>
        <MessageInput isRequired={false} />
      </FormWrapper>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("renders required label when isRequired is true", () => {
    render(
      <FormWrapper>
        <MessageInput isRequired={true} />
      </FormWrapper>,
    );

    expect(screen.getByText("Votre message (obligatoire)")).toBeInTheDocument();
    expect(
      screen.queryByText("Votre message (optionnel)"),
    ).not.toBeInTheDocument();
  });

  it("renders required label when isRequired is not provided (defaults to true)", () => {
    render(
      <FormWrapper>
        <MessageInput />
      </FormWrapper>,
    );

    expect(screen.getByText("Votre message (obligatoire)")).toBeInTheDocument();
    expect(
      screen.queryByText("Votre message (optionnel)"),
    ).not.toBeInTheDocument();
  });

  it("displays error state when form has message error", async () => {
    function TestComponent() {
      const form = useForm<InviteGroupsFormValues>({
        defaultValues: {
          areaId: "",
          teamIds: [],
          message: "",
        },
      });

      // Trigger validation error after render
      useEffect(() => {
        form.setError("message", {
          type: "manual",
          message: "Veuillez saisir un message",
        });
      }, [form]);

      return (
        <FormProvider {...form}>
          <MessageInput isRequired={true} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(
      await screen.findByText("Veuillez saisir un message"),
    ).toBeInTheDocument();
  });
});
