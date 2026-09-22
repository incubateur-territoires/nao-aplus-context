/**
 * Slugify a filename by replacing special characters and spaces
 * Keeps the file extension intact
 */
export function slugifyFilename(filename: string): string {
  // Extract extension
  const lastDotIndex = filename.lastIndexOf(".");
  const extension = lastDotIndex > 0 ? filename.slice(lastDotIndex) : "";
  const nameWithoutExt =
    lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;

  // Normalize unicode characters (é -> e, à -> a, etc.)
  const normalized = nameWithoutExt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Replace spaces and special characters with hyphens
  const slugified = normalized
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slugified + extension;
}
