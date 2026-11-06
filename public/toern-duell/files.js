// files.js — Datei speichern/laden (iOS: Share-Sheet, sonst Download).
export async function speichereDatei(name, text, mime) {
  const datei = new File([text], name, { type: mime });
  try {
    if (navigator.canShare?.({ files: [datei] })) {
      await navigator.share({ files: [datei], title: name });
      return "geteilt";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "abgebrochen";
  }
  const url = URL.createObjectURL(datei);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "download";
}

export const leseDatei = (datei) => datei.text();
