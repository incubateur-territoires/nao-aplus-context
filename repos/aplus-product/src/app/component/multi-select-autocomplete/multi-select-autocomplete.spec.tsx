import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelectAutocomplete } from "./multi-select-autocomplete";

interface Area {
  id: string;
  name: string;
}

const AREAS: Area[] = [
  { id: "area-1", name: "Pas-de-Calais" },
  { id: "area-2", name: "Bas-Rhin" },
  { id: "area-3", name: "France Services" },
];

interface HarnessProps {
  initialValue?: string[];
  onChangeSpy?: (ids: string[]) => void;
  clearable?: boolean;
  selectAll?: boolean;
  required?: boolean;
}

function Harness({
  initialValue = [],
  onChangeSpy,
  clearable,
  selectAll = true,
  required,
}: HarnessProps) {
  const [value, setValue] = useState<string[]>(initialValue);
  return (
    <MultiSelectAutocomplete
      id="area-combobox"
      label="Territoire"
      placeholder="Choisissez un territoire"
      options={AREAS}
      value={value}
      onChange={(ids) => {
        setValue(ids);
        onChangeSpy?.(ids);
      }}
      getOptionLabel={(option) => option.name}
      clearable={clearable}
      selectAll={selectAll}
      required={required}
    />
  );
}

describe("MultiSelectAutocomplete", () => {
  it("coche l'option survolée avec [Espace] sans insérer d'espace dans le champ (RGAA)", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness selectAll={false} onChangeSpy={onChangeSpy} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    // Survole la première option réelle puis l'active à l'Espace.
    await user.keyboard("{ArrowDown}");
    await user.keyboard(" ");

    expect(onChangeSpy).toHaveBeenCalledWith(["area-1"]);
    expect(input).toHaveValue("");
  });

  it("ne bascule pas l'option avec [Espace] quand le menu est fermé (RGAA)", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(
      <Harness
        selectAll={false}
        initialValue={["area-1"]}
        onChangeSpy={onChangeSpy}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input); // ouvre le menu
    await user.keyboard("{Escape}"); // ferme le menu, focus conservé sur le champ
    await user.keyboard(" "); // [Espace] menu fermé ne doit rien basculer

    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("ne bascule rien avec [Espace] sur menu ouvert sans navigation clavier (RGAA)", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(
      <Harness
        selectAll={false}
        initialValue={["area-1"]}
        onChangeSpy={onChangeSpy}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input); // ouvre : MUI re-surligne l'option sélectionnée (reason "auto")
    await user.keyboard(" "); // sans navigation clavier, l'espace ne bascule rien
    await user.keyboard(" ");

    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("laisse taper une espace dans le champ quand on filtre (garde multi-mots)", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness selectAll={false} onChangeSpy={onChangeSpy} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "France Services");

    expect(input).toHaveValue("France Services");
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("conserve la recherche saisie après avoir coché une option", async () => {
    const user = userEvent.setup();
    render(<Harness selectAll={false} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Bas");
    await user.click(screen.getByRole("option", { name: "Bas-Rhin" }));

    expect(input).toHaveValue("Bas");
  });

  it("une espace s'insère mais ne masque aucune option (filtre insensible aux espaces)", async () => {
    const user = userEvent.setup();
    render(<Harness selectAll={false} />);

    const input = screen.getByRole("combobox");
    await user.click(input); // ouvre le menu
    // L'espace est un caractère normal (pattern ARIA) ; le filtre l'ignore, donc
    // aucune option ne disparaît, y compris celles à un seul mot.
    await user.keyboard(" ");

    expect(input).toHaveValue(" ");
    expect(screen.getByText("Pas-de-Calais")).toBeInTheDocument();
    expect(screen.getByText("Bas-Rhin")).toBeInTheDocument();
    expect(screen.getByText("France Services")).toBeInTheDocument();
  });

  it("filtre en ignorant les espaces de la saisie (« france services » → France Services)", async () => {
    const user = userEvent.setup();
    render(<Harness selectAll={false} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "  france   services  ");

    expect(screen.getByText("France Services")).toBeInTheDocument();
    expect(screen.queryByText("Pas-de-Calais")).not.toBeInTheDocument();
    expect(screen.queryByText("Bas-Rhin")).not.toBeInTheDocument();
  });

  it("rend visible l'option survolée au clavier via la classe Mui-focused (RGAA)", async () => {
    const user = userEvent.setup();
    render(<Harness selectAll={false} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveClass("Mui-focused");
  });

  it("expose un bouton « Vider la saisie » focusable et sans title quand clearable (RGAA)", () => {
    render(<Harness clearable initialValue={["area-1"]} />);

    // MUI garde le bouton clear en `visibility:hidden` jusqu'au focus/survol, ce
    // qui vide son nom accessible côté jsdom. On le cible donc par son attribut
    // aria-label pour vérifier les correctifs RGAA (focusable, sans title).
    const clearButton = screen
      .getAllByRole("button", { hidden: true })
      .find(
        (button) => button.getAttribute("aria-label") === "Vider la saisie",
      );
    expect(clearButton).toBeDefined();
    expect(clearButton).toHaveAttribute("tabindex", "0");
    expect(clearButton).not.toHaveAttribute("title");
  });

  it("donne un nom accessible français au bouton d'ouverture, sans title (RGAA)", () => {
    render(<Harness />);

    const popupButton = screen.getByRole("button", {
      name: "Afficher les options",
    });
    expect(popupButton).not.toHaveAttribute("title");
  });

  it("donne un nom accessible explicite aux chips et permet de les retirer (RGAA)", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness initialValue={["area-1"]} onChangeSpy={onChangeSpy} />);

    const removeButton = screen.getByRole("button", {
      name: "Retirer Pas-de-Calais",
    });
    await user.click(removeButton);

    expect(onChangeSpy).toHaveBeenCalledWith([]);
  });

  it("propose la sentinelle « Tout sélectionner » qui sélectionne tout", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    const input = screen.getByRole("combobox");
    await user.click(input);

    const selectAllOption = screen.getByText("Tout sélectionner");
    await user.click(selectAllOption);

    expect(onChangeSpy).toHaveBeenCalledWith(["area-1", "area-2", "area-3"]);
  });

  it("expose aria-required sur le champ quand required", () => {
    render(<Harness required />);
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("affiche le conteneur de chips avec un libellé accessible", () => {
    render(<Harness initialValue={["area-1", "area-2"]} />);
    const chipsList = screen.getByRole("list", {
      name: "Territoire sélection",
    });
    expect(within(chipsList).getAllByRole("listitem")).toHaveLength(2);
  });
});
