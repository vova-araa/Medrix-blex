import type {
  Adres, DockEvent, EmballageTransactie, Order, Rit, Taak, TaakEvent, WerktijdEvent, Zending,
} from "@sharzi/domain";

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

/** Tarief per opdrachtgever: starttarief + bedrag per laadmeter, in centen. */
export interface Tarief {
  basisCenten: number;
  perLaadmeterCenten: number;
}

export interface Klant {
  naam: string;
  contactpersoon: string;
  email: string;
  telefoon: string;
}

/** Trailer uit het wagenpark; toewijzing aan ritten doet de administratie. */
export interface Trailer {
  kenteken: string;
  landcode: string;
  omschrijving: string;
}

export type CmrSoort = "laad" | "los" | "nul";

/** Gescande CMR (vrachtbrief): laad-exemplaar, 3e exemplaar bij lossen, of 0-CMR. */
export interface CmrRegistratie {
  id: string;
  tenantId: string;
  taakId: string;
  ritId: string;
  zendingId?: string;
  soort: CmrSoort;
  nummer: string;
  /** Door de chauffeur aangepaste ladingomschrijving als de CMR onduidelijk is. */
  lading?: string;
  tijdstip: string;
  wie: string;
}

export interface RitKm {
  start?: number;
  eind?: number;
}

export interface WagenparkItem {
  kenteken: string;
  landcode: string;
  omschrijving: string;
  kmStand: number;
  apkTot: string;
  volgendeOnderhoudKm: number;
  verbruikL100: number;
  kostenPerMaandCenten: number;
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
  emballage: EmballageTransactie[];
  tarieven: Record<string, Tarief>;
  wagenpark: WagenparkItem[];
  klanten: Record<string, Klant>;
  dockEvents: DockEvent[];
  trailers: Trailer[];
  trailerVanRit: Record<string, string>;
  cmrs: CmrRegistratie[];
  ritKm: Record<string, RitKm>;
  /** Rijtijd eerder deze week (vóór vandaag) per chauffeur, in minuten. */
  weekRijMinuten: Record<string, number>;
  /** Tijdstip van de laatste wagenpark-sync uit de Truck & Trailer-koppeling. */
  wagenparkSync: string;
}

export interface DataBron {
  laadDag(datum: string): Promise<DagSnapshot>;
}
