// Helpers a11y pour le composant <Select> de react-dsfr.

/**
 * Callback ref à passer dans `nativeSelectProps.ref` d'un `<Select>` DSFR.
 *
 * react-dsfr rend toujours l'attribut `aria-describedby` sur le `<select>`
 * natif (`cx(stateDescriptionId, ...)`), avec une valeur vide (`""`) tant que
 * l'état est `"default"` (aucun message d'erreur). Un `aria-describedby=""`
 * n'est pas une non-conformité RGAA mais reste du bruit dans le DOM : on le
 * retire une fois l'élément monté. En état `error`, l'attribut pointe vers le
 * message et est laissé intact.
 */
export function stripEmptyAriaDescribedBy(
  element: HTMLSelectElement | null,
): void {
  if (element?.getAttribute("aria-describedby") === "") {
    element.removeAttribute("aria-describedby");
  }
}
