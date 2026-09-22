import { toPng } from "html-to-image";

/**
 * Capture une carte de statistiques (titre + graphique + légende) au format PNG.
 *
 * On rasterise tout le bloc DOM (et non le seul `<canvas>` Chart.js, qui ne
 * contient ni le titre ni la légende) via `html-to-image`. Les éléments marqués
 * `data-capture-exclude` (bouton d'export, sélecteur Graphique/Tableau) sont
 * retirés de l'image.
 *
 * Retourne `false` si la cible est absente ou si la capture échoue, `true` si le
 * téléchargement a bien été déclenché.
 */
export async function captureStatChart(
  target: HTMLElement | null,
  filename: string,
): Promise<boolean> {
  if (!target) {
    return false;
  }

  // Marge ajoutée en haut de l'image pour ne pas coller le titre au bord. On
  // agrandit d'autant la hauteur de sortie afin de ne rien rogner en bas.
  const paddingTop = 24;

  try {
    const dataUrl = await toPng(target, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      height: target.offsetHeight + paddingTop,
      style: { paddingTop: `${paddingTop}px` },
      filter: (node) =>
        !(node instanceof Element && node.hasAttribute("data-capture-exclude")),
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}
