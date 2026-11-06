// landgang.js (View) — folgt im nächsten Commit.
import { h } from "../dom.js";
export function landgangView() {
  return h("section", {}, h("h1", {}, "landgang"), h("p", { class: "hinweis" }, "Dieser Bereich folgt."));
}
