// `server-only` lève dès qu'il est importé hors d'un Server Component. Sous Jest,
// aucun module n'est un Server Component : sans ce stub, tout module protégé par
// `import "server-only"` serait intestable.
export {};
