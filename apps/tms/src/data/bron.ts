import type { Adres, Order, Rit, Taak, TaakEvent, WerktijdEvent, Zending } from "@sharzi/domain";

// De UI praat alleen met deze poort. Nu zit er een mock achter (in-memory);
// zodra het Supabase dev-project bestaat komt daar een tweede implementatie
// achter dezelfde interface — de componenten merken daar niets van.

export interface AdresFoto {
  id: string;
  label: string;
  dataUrl: string;
}

export interface AdresInfo {
  instructies: string;
  fotos: AdresFoto[];
}

/** Sleutel van de adresbibliotheek: naam + plaats identificeren een losadres. */
export function adresSleutel(adres: Adres): string {
  return `${adres.naam}|${adres.plaats}`;
}

export interface DagSnapshot {
  ritten: Rit[];
  taken: Taak[];
  events: TaakEvent[];
  zendingen: Record<string, Zending>;
  orders: Record<string, Order>;
  ongepland: string[];
  adresInfo: Record<string, AdresInfo>;
  werktijden: WerktijdEvent[];
}

export interface DataBron {
  laadDag(datum: string): Promise<DagSnapshot>;
}
