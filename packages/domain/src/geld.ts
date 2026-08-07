// Geld als integer in centen met expliciete valuta (CLAUDE.md §5.4).

import type { Geld } from "./types";

export function geld(bedragCenten: number, valuta = "EUR"): Geld {
  if (!Number.isInteger(bedragCenten)) {
    throw new Error(`Geldbedrag moet een integer in centen zijn, kreeg: ${bedragCenten}`);
  }
  return { bedragCenten, valuta };
}

export function telOp(a: Geld, b: Geld): Geld {
  if (a.valuta !== b.valuta) {
    throw new Error(`Valuta's verschillen: ${a.valuta} en ${b.valuta}`);
  }
  return { bedragCenten: a.bedragCenten + b.bedragCenten, valuta: a.valuta };
}

export function formatteerGeld(g: Geld, locale = "nl-NL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: g.valuta,
  }).format(g.bedragCenten / 100);
}
