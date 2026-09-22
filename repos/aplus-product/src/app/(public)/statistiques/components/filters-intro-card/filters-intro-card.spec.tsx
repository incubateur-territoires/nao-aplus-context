import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiltersIntroCard } from "./filters-intro-card";

describe("FiltersIntroCard", () => {
  it("explique la portée par défaut des statistiques", () => {
    render(<FiltersIntroCard onOpen={jest.fn()} />);
    expect(screen.getByText(/octobre 2022/)).toBeInTheDocument();
  });

  it("ouvre le tiroir de filtres au clic sur le bouton", async () => {
    const onOpen = jest.fn();
    render(<FiltersIntroCard onOpen={onOpen} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Filtrer les statistiques/i }),
    );

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
