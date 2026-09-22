/**
 * Détecte les fichiers sélectionnés qui ne sont plus lisibles sur l'appareil.
 *
 * Un fichier déplacé ou supprimé après sa sélection conserve un objet `File`
 * "fantôme" : ses métadonnées (nom, taille) restent disponibles mais la lecture
 * de son contenu échoue. Sans ce contrôle, l'upload échoue plus tard avec une
 * erreur réseau opaque que l'utilisateur ne peut pas interpréter.
 */
export async function findUnreadableFiles(files: File[]): Promise<File[]> {
  const results = await Promise.all(
    files.map(async (file) => ((await isFileReadable(file)) ? null : file)),
  );
  return results.filter((file): file is File => file !== null);
}

function isFileReadable(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(true);
    reader.onerror = () => resolve(false);
    try {
      reader.readAsArrayBuffer(file);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Lit un fichier et renvoie son contenu encodé en base64 (sans le préfixe
 * `data:<mime>;base64,`), tel qu'attendu par l'API de pièces jointes Brevo.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Lecture du fichier impossible."));
        return;
      }
      // `readAsDataURL` produit `data:<mime>;base64,<contenu>` : on ne garde
      // que la partie base64 après la virgule.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Lecture échouée."));
    reader.readAsDataURL(file);
  });
}
