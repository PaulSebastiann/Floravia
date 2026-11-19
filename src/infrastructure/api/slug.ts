const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** El backend no tiene slug: se arma `nombre-{id}` y el id (siempre al final) decide la busqueda. */
export const slugDe = (nombre: string, id: number): string => {
  const base = norm(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base ? `${base}-${id}` : String(id);
};
export const idDeSlug = (slug: string): number | undefined => {
  const m = /(?:^|-)(\d{1,9})$/.exec(slug);
  return m?.[1] ? Number(m[1]) : undefined;
};
