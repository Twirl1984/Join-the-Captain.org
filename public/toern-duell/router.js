// router.js — Hash-Routing (rein). "#/karte/10", "#/bewertung?karte=3&fahrer=x".
export const ROUTEN = ["start", "karten", "karte", "bewertung", "landgang", "rangliste", "ueberblick"];

/** @returns {{name: string, id: number|null, query: Record<string,string>}} */
export function parseHash(hash) {
  const roh = String(hash ?? "").replace(/^#\/?/, "");
  const [pfad, qs = ""] = roh.split("?");
  const teile = pfad.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs));
  let name = teile[0] ?? "start";
  if (!ROUTEN.includes(name)) return { name: "start", id: null, query: {} };
  let id = null;
  if (name === "karte") {
    id = Number(teile[1]);
    if (!Number.isInteger(id) || id < 1) return { name: "karten", id: null, query: {} };
  }
  return { name, id, query };
}

export function hashFuer(name, id, query) {
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";
  return `#/${name}${id != null ? `/${id}` : ""}${qs}`;
}
