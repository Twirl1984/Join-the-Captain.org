"use client";

// Client-Boundary für den dynamic(ssr:false)-Import der Leaflet-Karte —
// next/dynamic mit ssr:false ist in Server Components nicht erlaubt, darum
// dieser dünne Client-Wrapper (gleiches Muster wie NavApp.tsx für NavMap).

import dynamic from "next/dynamic";

const ToernShareMap = dynamic(() => import("./ToernShareMap"), {
  ssr: false,
  loading: () => <div className="card">Karte lädt …</div>,
});

export default ToernShareMap;
