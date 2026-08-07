// Facturatie: bedragen als integer in centen (§5.4). Sharzi stelt de factuur
// op; boekhouding blijft een apart pakket (besluit 2026-08-07, PROJECT_CONFIG).

import type { Geld } from "./types";

export interface FactuurRegel {
  omschrijving: string;
  bedrag: Geld;
}

export interface FactuurTotalen {
  subtotaal: Geld;
  btw: Geld;
  totaal: Geld;
}

export function factuurTotalen(
  regels: readonly FactuurRegel[],
  btwPercentage = 21
): FactuurTotalen {
  if (regels.length === 0) {
    const nul: Geld = { bedragCenten: 0, valuta: "EUR" };
    return { subtotaal: nul, btw: nul, totaal: nul };
  }
  const valuta = regels[0].bedrag.valuta;
  let subtotaalCenten = 0;
  for (const regel of regels) {
    if (regel.bedrag.valuta !== valuta) {
      throw new Error(`Factuurregels met gemengde valuta: ${valuta} en ${regel.bedrag.valuta}`);
    }
    if (!Number.isInteger(regel.bedrag.bedragCenten)) {
      throw new Error(`Factuurregel is geen integer in centen: ${regel.bedrag.bedragCenten}`);
    }
    subtotaalCenten += regel.bedrag.bedragCenten;
  }
  // BTW één keer over het subtotaal afronden, niet per regel — anders kan de
  // som van regel-BTW's een cent afwijken van de factuur-BTW.
  const btwCenten = Math.round((subtotaalCenten * btwPercentage) / 100);
  return {
    subtotaal: { bedragCenten: subtotaalCenten, valuta },
    btw: { bedragCenten: btwCenten, valuta },
    totaal: { bedragCenten: subtotaalCenten + btwCenten, valuta },
  };
}
