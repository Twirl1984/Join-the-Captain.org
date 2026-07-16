import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fehler(message: string, status = 400): NextResponse {
  return NextResponse.json({ fehler: message }, { status });
}

export function eurFromCent(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
