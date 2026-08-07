// Canonieke keten (CLAUDE.md §5): order → zending → leg → rit → taak → event.
// Tijden zijn ISO 8601 UTC-strings; weergave in Europe/Amsterdam gebeurt in de UI.
// Geld is altijd een integer in centen met expliciete valuta.

export interface Geld {
  bedragCenten: number;
  valuta: string;
}

// Tijdvensters horen bij een adres, niet bij een order (§5.3).
export interface Adres {
  naam: string;
  plaats: string;
  land: string;
  tijdvenster?: { van: string; tot: string };
}

export interface Order {
  id: string;
  tenantId: string;
  opdrachtgever: string;
  referentie: string;
}

export interface Zending {
  id: string;
  tenantId: string;
  orderId: string;
  barcode: string;
  laadmeters: number;
  gewichtKg: number;
  omschrijving: string;
  van: Adres;
  naar: Adres;
}

export type TaakSoort = "laden" | "lossen" | "emballage_retour";

export interface Taak {
  id: string;
  tenantId: string;
  ritId: string;
  soort: TaakSoort;
  adres: Adres;
  zendingId?: string;
  geplandVan: string;
  geplandTot: string;
}

export interface Voertuig {
  kentekenGenormaliseerd: string;
  landcode: string;
  omschrijving: string;
  capaciteitLaadmeters: number;
}

export interface Rit {
  id: string;
  tenantId: string;
  datum: string;
  chauffeur: string;
  charter: boolean;
  voertuig: Voertuig;
}
