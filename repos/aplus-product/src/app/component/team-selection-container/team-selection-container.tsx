import { Filters } from "../request-form/request-group-selection/filters/filters";
import { Spinner } from "../spinner/spinner";

interface TeamSelectionContainerProps {
  tags: Array<{ label: string; value: string }>;
  selectedFilters: string[];
  setSelectedFilters: (filters: string[]) => void;
  isLoading: boolean;
  children: React.ReactNode;
}

export function TeamSelectionContainer({
  tags,
  selectedFilters,
  setSelectedFilters,
  isLoading,
  children,
}: TeamSelectionContainerProps) {
  return (
    <div className="mt-4">
      <p id="equipe-operateur-label" className="text-black m-0">
        Équipe(s) opérateur à contacter
      </p>
      <p
        id="equipe-operateur-hint"
        className="text-sm text-(--text-mention-grey) m-0"
      >
        Veuillez choisir au moins une équipe opérateur
      </p>
      <div
        className="bg-blue-background p-4 md:p-10 mt-4"
        role="group"
        aria-labelledby="equipe-operateur-label equipe-operateur-hint"
      >
        <Filters
          tags={tags}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
        />
        {isLoading ? (
          <div className="flex justify-center items-center h-[500px] bg-blue-background p-4 md:p-10 mt-4">
            <Spinner />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
