import Input from "@codegouvfr/react-dsfr/Input";

export function InTreatment() {
  return (
    <div>
      <Input
        className="mt-10"
        textArea
        label="Ajouter un message"
        hintText="Vous pouvez personnaliser le message ci-dessous si vous le souhaitez."
        nativeTextAreaProps={{
          value: "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,",
          rows: 5,
          onChange: (e) => {
            console.log(e.target.value);
          },
        }}
      />
    </div>
  );
}
