// `/contacts` ne doit pas allumer l'entrée « Contact » : on compare des segments
// entiers, pas des sous-chaînes.
export function isNavItemActive(fullPath: string, route: string): boolean {
  return (
    fullPath === route ||
    fullPath.startsWith(`${route}/`) ||
    fullPath.startsWith(`${route}?`)
  );
}
