// zoom.js — Vollbild-Bild mit Pinch-Zoom, Verschieben, Doppeltipp = Reset.
import { h } from "../dom.js";

export function zeigeZoom(src, alt) {
  const vorher = document.activeElement;
  let scale = 1, x = 0, y = 0, letzterTipp = 0;
  const zeiger = new Map();
  let startAbstand = 0, startScale = 1;
  const img = h("img", { src, alt, class: "zoom__bild", draggable: "false" });
  const anwenden = () => {
    scale = Math.min(6, Math.max(1, scale));
    if (scale === 1) x = y = 0;
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };
  const schliessen = () => {
    overlay.remove();
    document.removeEventListener("keydown", taste);
    vorher?.focus?.();
  };
  const taste = (e) => e.key === "Escape" && schliessen();
  const btn = h("button", { class: "zoom__zu", type: "button", "aria-label": "Bild schließen", onclick: schliessen }, "✕");
  const buehne = h("div", { class: "zoom__buehne" }, img);
  const overlay = h("div", { class: "zoom", role: "dialog", "aria-modal": "true", "aria-label": alt }, buehne, btn);

  buehne.addEventListener("pointerdown", (e) => {
    buehne.setPointerCapture(e.pointerId);
    zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zeiger.size === 2) {
      const [a, b] = [...zeiger.values()];
      startAbstand = Math.hypot(a.x - b.x, a.y - b.y);
      startScale = scale;
    }
    const jetzt = Date.now();
    if (zeiger.size === 1 && jetzt - letzterTipp < 300) { scale = scale > 1 ? 1 : 2.5; anwenden(); }
    letzterTipp = jetzt;
  });
  buehne.addEventListener("pointermove", (e) => {
    const alt = zeiger.get(e.pointerId);
    if (!alt) return;
    if (zeiger.size === 2) {
      zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...zeiger.values()];
      scale = startScale * (Math.hypot(a.x - b.x, a.y - b.y) / (startAbstand || 1));
    } else if (scale > 1) {
      x += e.clientX - alt.x;
      y += e.clientY - alt.y;
      zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    anwenden();
  });
  const ende = (e) => zeiger.delete(e.pointerId);
  buehne.addEventListener("pointerup", ende);
  buehne.addEventListener("pointercancel", ende);
  buehne.addEventListener("wheel", (e) => { e.preventDefault(); scale *= e.deltaY < 0 ? 1.15 : 0.87; anwenden(); }, { passive: false });
  document.addEventListener("keydown", taste);
  document.body.append(overlay);
  btn.focus();
}
