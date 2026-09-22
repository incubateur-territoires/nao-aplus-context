import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { RequestFormStepper } from "./request-form-stepper";

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "step") return mockStep;
      return null;
    },
  }),
}));

let mockStep: string | null = null;

describe("RequestFormStepper", () => {
  const stepTitles = [
    "Destinataires du signalement",
    "Informations du citoyen",
    "Signalement détaillé",
    "Récapitulatif et validation",
  ];

  stepTitles.forEach((title, idx) => {
    test(`renders step ${idx + 1} title`, () => {
      mockStep = String(idx + 1);
      render(<RequestFormStepper />);
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  test("defaults to step 1 if no step param", () => {
    mockStep = null;
    render(<RequestFormStepper />);
    expect(screen.getByText(stepTitles[0])).toBeInTheDocument();
  });
});
