import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { AreaSelect } from "./area-select";
import { InviteGroupsFormValues } from "../invite-groups.schema";

const mockAreas = [
  { id: "area-1", name: "Area 1" },
  { id: "area-2", name: "Area 2" },
  { id: "area-3", name: "Area 3" },
];

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

describe("AreaSelect", () => {
  it("renders the select with label", () => {
    render(
      <FormWrapper>
        <AreaSelect areas={mockAreas} />
      </FormWrapper>,
    );

    expect(screen.getByText("Territoire concerné")).toBeInTheDocument();
  });

  it("renders all areas as options", () => {
    render(
      <FormWrapper>
        <AreaSelect areas={mockAreas} />
      </FormWrapper>,
    );

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    expect(screen.getByText("Area 1")).toBeInTheDocument();
    expect(screen.getByText("Area 2")).toBeInTheDocument();
    expect(screen.getByText("Area 3")).toBeInTheDocument();
  });

  it("shows placeholder option", () => {
    render(
      <FormWrapper>
        <AreaSelect areas={mockAreas} />
      </FormWrapper>,
    );

    expect(screen.getByText("Sélectionner un territoire")).toBeInTheDocument();
  });

  it("updates form value when area is selected", async () => {
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
          <AreaSelect areas={mockAreas} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "area-2");

    expect(formValues?.areaId).toBe("area-2");
  });

  it("displays the current selected area value", () => {
    render(
      <FormWrapper defaultValues={{ areaId: "area-2" }}>
        <AreaSelect areas={mockAreas} />
      </FormWrapper>,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("area-2");
  });

  it("resets teamIds when area changes", async () => {
    const user = userEvent.setup();
    let formValues: InviteGroupsFormValues | undefined;

    function TestComponent() {
      const form = useForm<InviteGroupsFormValues>({
        defaultValues: {
          areaId: "area-1",
          teamIds: ["team-1", "team-2"],
          message: "",
        },
      });

      formValues = form.watch();

      return (
        <FormProvider {...form}>
          <AreaSelect areas={mockAreas} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "area-2");

    expect(formValues?.areaId).toBe("area-2");
    expect(formValues?.teamIds).toEqual([]);
  });

  it("handles empty areas list", () => {
    render(
      <FormWrapper>
        <AreaSelect areas={[]} />
      </FormWrapper>,
    );

    expect(screen.getByText("Territoire concerné")).toBeInTheDocument();
    expect(screen.queryByText("Area 1")).not.toBeInTheDocument();
  });

  it("handles undefined areas", () => {
    render(
      <FormWrapper>
        <AreaSelect areas={undefined} />
      </FormWrapper>,
    );

    expect(screen.getByText("Territoire concerné")).toBeInTheDocument();
    expect(screen.queryByText("Area 1")).not.toBeInTheDocument();
  });
});
