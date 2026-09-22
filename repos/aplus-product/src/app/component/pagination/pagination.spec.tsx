import { render } from "@testing-library/react";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  function renderPagination() {
    return render(
      <Pagination
        count={5}
        defaultPage={3}
        getPageLinkProps={(pageNumber) => ({
          href: "#",
          "aria-label": `Page ${pageNumber}`,
        })}
        showFirstLast
      />,
    );
  }

  it("remplace l'aria-label des boutons de navigation par leur libellé fonctionnel", () => {
    const { container } = renderPagination();

    const expectedLabels: Record<string, string> = {
      "fr-pagination__link--first": "Première page",
      "fr-pagination__link--prev": "Page précédente",
      "fr-pagination__link--next": "Page suivante",
      "fr-pagination__link--last": "Dernière page",
    };

    for (const [className, label] of Object.entries(expectedLabels)) {
      const link = container.querySelector(`.${className}`);
      expect(link).not.toBeNull();
      expect(link?.getAttribute("aria-label")).toBe(label);
    }
  });

  it('retire le role="link" injecté par DSFR sur les boutons de navigation', () => {
    const { container } = renderPagination();

    const navClassNames = [
      "fr-pagination__link--first",
      "fr-pagination__link--prev",
      "fr-pagination__link--next",
      "fr-pagination__link--last",
    ];

    for (const className of navClassNames) {
      const link = container.querySelector(`.${className}`);
      expect(link).not.toBeNull();
      expect(link?.hasAttribute("role")).toBe(false);
    }
  });

  it("conserve l'aria-label des boutons numérotés", () => {
    const { container } = renderPagination();

    const numberedLinks = container.querySelectorAll(
      ".fr-pagination__link:not(.fr-pagination__link--first):not(.fr-pagination__link--prev):not(.fr-pagination__link--next):not(.fr-pagination__link--last)",
    );

    expect(numberedLinks.length).toBeGreaterThan(0);
    numberedLinks.forEach((link) => {
      expect(link.getAttribute("aria-label")).toMatch(/^Page \d+$/);
    });
  });
});
