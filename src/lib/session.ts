// ── Auth-Stub ───────────────────────────────────────────────────────
// BEWUSST EINFACH: echtes Auth (OAuth/Magic-Link) ist NICHT Teil dieser
// Aufgabe. Hier wird eine pseudonyme User-ID per Cookie gesetzt, damit
// Votes/Pledges einem Besucher zugeordnet werden können. NICHT für
// Produktion – klar als Stub markiert.

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE = "jtc_uid";

export interface SessionUser {
  id: string;
  name: string;
}

// Liest die User-ID aus dem Cookie oder erzeugt eine neue (und setzt sie).
export async function getOrCreateUser(): Promise<SessionUser> {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id) {
    id = randomUUID();
    jar.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return { id, name: "Crew-Mitglied" };
}

// Nur-Lese-Variante (für GET-Routen, die kein Cookie setzen dürfen).
export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  return id ? { id, name: "Crew-Mitglied" } : null;
}
