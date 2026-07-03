// AUTOGENERIERT von scripts/navigation-fetch-watermask.ts — nicht von Hand editieren.
// Registry der eingecheckten Wassermasken (OSM-Küstenlinien, ~1 km, Planungsqualität).
import m0 from "./balearen.json" with { type: "json" };
import m1 from "./brombachsee.json" with { type: "json" };
import m2 from "./daenische-suedsee.json" with { type: "json" };
import m3 from "./deutsche-bucht.json" with { type: "json" };
import m4 from "./ijsselmeer.json" with { type: "json" };
import m5 from "./kieler-bucht.json" with { type: "json" };
import m6 from "./kroatien-dalmatien.json" with { type: "json" };
import m7 from "./kroatien-istrien.json" with { type: "json" };
import m8 from "./nordfriesland.json" with { type: "json" };
import m9 from "./ruegen.json" with { type: "json" };
import m10 from "./saronischer-golf.json" with { type: "json" };
import { decodeMask, type EncodedMask, type WaterMask } from "../watermask";

const REGISTRY: Record<string, EncodedMask> = {
  "balearen": m0 as unknown as EncodedMask,
  "brombachsee": m1 as unknown as EncodedMask,
  "daenische-suedsee": m2 as unknown as EncodedMask,
  "deutsche-bucht": m3 as unknown as EncodedMask,
  "ijsselmeer": m4 as unknown as EncodedMask,
  "kieler-bucht": m5 as unknown as EncodedMask,
  "kroatien-dalmatien": m6 as unknown as EncodedMask,
  "kroatien-istrien": m7 as unknown as EncodedMask,
  "nordfriesland": m8 as unknown as EncodedMask,
  "ruegen": m9 as unknown as EncodedMask,
  "saronischer-golf": m10 as unknown as EncodedMask,
};

export const AVAILABLE_MASKS: string[] = Object.keys(REGISTRY);

const cache = new Map<string, WaterMask>();

/** Dekodierte Wassermaske des Reviers oder null (z. B. Binnensee ohne Maske). */
export function getMaskForRevier(revierId: string): WaterMask | null {
  const enc = REGISTRY[revierId];
  if (!enc) return null;
  let mask = cache.get(revierId);
  if (!mask) {
    mask = decodeMask(enc);
    cache.set(revierId, mask);
  }
  return mask;
}
