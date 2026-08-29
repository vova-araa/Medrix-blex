import type { WachtrijItem } from "@sharzi/connector-kit";
import type {
  ActiviteitBron, Adres, DockEvent, EmballageTransactie, Order, Rit, Taak, TaakEvent,
  Referentie, TachoToestemming, TachoUitlezing, WerktijdEvent, Zending,
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
  /** Laatste tachograafkeuring; leeg = onbekend, en dat is zelf een signaal. */
  tachograafGekeurd?: string;
  landcode: string;
  omschrijving: string;
  kmStand: number;
  apkTot: string;
  volgendeOnderhoudKm: number;
  verbruikL100: number;
  kostenPerMaandCenten: number;
}

/** Eén mail in een gesprek met een opdrachtgever of ontvanger. */
export interface MailBericht {
  id: string;
  richting: "in" | "uit";
  tekst: string;
  tijdstip: string;
  /** Afzender: contactpersoon van de tegenpartij, plannernaam of "automaat". */
  wie: string;
}

export interface MailThread {
  id: string;
  tegenpartij: string;
  email: string;
  onderwerp: string;
  zendingId?: string;
  berichten: MailBericht[];
  ongelezen?: boolean;
}

/** Status van een externe koppeling zoals die in de hub getoond wordt. */
export type KoppelingStatus = "actief" | "fout" | "beschikbaar";

export interface KoppelingLogRegel {
  id: string;
  koppelingId: string;
  richting: "in" | "uit";
  omschrijving: string;
  tijdstip: string;
  status: "geslaagd" | "gefaald";
  foutmelding?: string;
  /** Gezet zodra een gefaald bericht opnieuw is afgespeeld. */
  opnieuwAfgespeeld?: boolean;
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
  /** Rijtijd vorige week per chauffeur — nodig voor de 90-uursgrens. */
  vorigeWeekRijMinuten: Record<string, number>;
  /** Arbeidstijd eerder deze week per chauffeur (ATB-V, 60-uursgrens). */
  weekArbeidMinuten: Record<string, number>;
  /** Tijdstip van de laatste wagenpark-sync uit de Truck & Trailer-koppeling. */
  wagenparkSync: string;
  mailThreads: MailThread[];
  koppelingLog: KoppelingLogRegel[];
  /** Wettelijke uitlezingen van voertuigunits en chauffeurskaarten. */
  tachoUitlezingen: TachoUitlezing[];
  /** Toestemming per chauffeur/voertuig voor live tachodata (AVG). */
  tachoToestemmingen: TachoToestemming[];
  /** Bron van de rijtijdstand per chauffeur: uitgelezen of app-registratie. */
  tachoBron: Record<string, ActiviteitBron>;
  /** Tijdstip van de laatste geslaagde ophaal bij de tachograafleverancier. */
  tachoSync: string;
  /** Referentiecijfers uit het bestaande pakket, voor het schaduwdraaien. */
  referenties: Referentie[];
  /** Uitgaande aanroepen die na alle pogingen faalden (§6.3). */
  wachtrij: WachtrijItem[];
}

export interface DataBron {
  laadDag(datum: string): Promise<DagSnapshot>;
}
