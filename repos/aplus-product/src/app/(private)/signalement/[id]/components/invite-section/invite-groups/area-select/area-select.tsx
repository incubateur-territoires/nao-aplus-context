import { Controller, useFormContext } from "react-hook-form";
import Select from "@codegouvfr/react-dsfr/Select";
import { InviteGroupsFormValues } from "../invite-groups.schema";

interface AreaSelectProps {
  areas: Array<{ id: string; name: string }> | undefined;
}

export function AreaSelect({ areas }: AreaSelectProps) {
  const form = useFormContext<InviteGroupsFormValues>();

  return (
    <Controller
      control={form.control}
      name="areaId"
      render={({ field }) => (
        <Select
          className="w-1/3"
          label="Territoire concerné"
          nativeSelectProps={{
            value: field.value || "",
            onChange: (e) => {
              field.onChange(e.target.value);
              // Reset teamIds when area changes
              form.setValue("teamIds", []);
            },
          }}
        >
          <option value="" disabled>
            Sélectionner un territoire
          </option>
          {areas?.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </Select>
      )}
    />
  );
}
