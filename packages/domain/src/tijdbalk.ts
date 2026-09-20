// Het grafische planbord: auto's onder elkaar, tijd van links naar rechts.
// Dat is hoe een planner naar zijn dag kijkt — niet als lijst met kaarten maar
// als bezetting. Je ziet in één oogopslag welke auto nog een gat heeft, waar
// het te krap staat en wanneer iemand aan zijn pauze moet.
//
// De balk wordt volledig afgeleid: stops komen uit de taken, de gaten ertussen
// worden gesplitst in rijden (de geschatte reistijd) en wachten (de rest).
// Waar de werkelijkheid bekend is uit de event-log gaat die voor op de planning.

import { taakStatus, type TaakEvent, type TaakStatus } from "./events";
import { RIJTIJD_REGELS } from "./rijtijden";
import { lokaalTijdstipMs } from "./tijd";
import type { Rit, Taak } from "./types";

export type SegmentSoort = "rijden" | "laden" | "lossen" | "emballage" | "pauze" | "wachten";

export interface Segment {
  soort: SegmentSoort;
  /** Minuten sinds middernacht lokale tijd. */
  vanMinuut: number;
  totMinuut: number;
  taakId?: string;
  plaats?: string;
  status?: TaakStatus;
  /** Uitgevoerd volgens de event-log, of nog planning. */
  werkelijk: boolean;
  /**
   * Het afgesproken tijdvenster van het adres, in minuten sinds middernacht.
   * De planner moet zien of het blok daarbinnen valt.
   */
  venster?: { vanMinuut: number; totMinuut: number };
  /** Valt de stop buiten zijn eigen venster? */
  buitenVenster?: boolean;
}

export type MarkerSoort = "pauze_uiterlijk" | "dienst_einde" | "nu";

export interface Marker {
  soort: MarkerSoort;
  minuut: number;
}

export type KnelpuntSoort =
  /** Het gat tussen twee stops is korter dan de rit ertussen duurt. */
  | "te_krap"
  /** De stop valt buiten het afgesproken venster. */
  | "buiten_venster"
  /** Er wordt langer aaneengesloten gereden dan mag zonder pauze. */
  | "pauze_overschreden";

export interface Knelpunt {
  soort: KnelpuntSoort;
  minuut: number;
  taakId?: string;
  /** Hoeveel minuten het misgaat; bij een venster het aantal minuten te laat. */
  minuten: number;
}

export interface TijdbalkRij {
  ritId: string;
  chauffeur: string;
  kentekenGenormaliseerd: string;
  landcode: string;
  segmenten: Segment[];
  knelpunten: Knelpunt[];
  markers: Marker[];
  /** Eerste en laatste minuut waarop deze auto iets doet. */
  vanMinuut: number;
  totMinuut: number;
  /** Minuten waarin er daadwerkelijk gewerkt of gereden wordt. */
  bezetteMinuten: number;
  /** Minuten die de auto stilstaat tussen de eerste en de laatste stop. */
  wachtMinuten: number;
}

export interface TijdbalkInvoer {
  /** Kalenderdag als YYYY-MM-DD; bepaalt het nulpunt van de balk. */
  datum: string;
  ritten: readonly Rit[];
  /** Taken per rit, in rijvolgorde. */
  takenVanRit: (ritId: string) => readonly Taak[];
  eventsVanTaak: (taakId: string) => readonly TaakEvent[];
  /** Geschatte rijtijd tussen twee plaatsen, in minuten. */
  reistijdMinuten: (van: string, naar: string) => number;
  /** Waar de auto 's ochtends staat; standaard de eerste stop. */
  startPlaats?: (ritId: string) => string | undefined;
  /** Nu, voor de tijdlijnmarkering. Weglaten betekent geen nu-streep. */
  nu?: string;
  /**
   * Begin van de dienst per chauffeur, als die al is ingeklokt. Bepaalt waar
   * de markers voor pauze en einde dienst vallen.
   */
  dienstStart?: (chauffeur: string) => string | undefined;
  /** Maximale duur van een dienst in minuten; standaard uit het ATB-V. */
  maxDienstMinuten?: number;
}

/** Minuten sinds middernacht lokale tijd op de dag van de balk. */
function minuutVan(iso: string, datum: string): number {
  const middernacht = lokaalTijdstipMs(datum);
  return Math.round((Date.parse(iso) - middernacht) / 60_000);
}

const SOORT_VAN_TAAK: Record<Taak["soort"], SegmentSoort> = {
  laden: "laden",
  lossen: "lossen",
  emballage_retour: "emballage",
};

/**
 * Bouwt één rij per rit. Ritten zonder taken vallen weg: een lege balk zegt
 * niets en kost alleen ruimte.
 */
export function bouwTijdbalk(invoer: TijdbalkInvoer): TijdbalkRij[] {
  const maxDienst = invoer.maxDienstMinuten ?? RIJTIJD_REGELS.maxDienstMinuten;

  return invoer.ritten
    .map((rit) => bouwRij(rit, invoer, maxDienst))
    .filter((rij): rij is TijdbalkRij => rij !== null);
}

function bouwRij(rit: Rit, invoer: TijdbalkInvoer, maxDienst: number): TijdbalkRij | null {
  const taken = invoer.takenVanRit(rit.id);
  if (taken.length === 0) return null;

  const segmenten: Segment[] = [];
  const knelpunten: Knelpunt[] = [];
  let vorigePlaats = invoer.startPlaats?.(rit.id) ?? taken[0].adres.plaats;
  let vorigEind: number | null = null;

  for (const taak of taken) {
    const events = invoer.eventsVanTaak(taak.id);
    const status = events.length > 0 ? taakStatus(events) : "gepland";
    if (status === "vervallen") continue;

    const { van, tot, werkelijk } = tijdenVan(taak, events, status, invoer.datum);

    // Het gat sinds de vorige stop: eerst rijden, dan wachten.
    if (vorigEind !== null) {
      const gat = van - vorigEind;
      const rijden = invoer.reistijdMinuten(vorigePlaats, taak.adres.plaats);
      if (gat < rijden) {
        knelpunten.push({ soort: "te_krap", minuut: vorigEind, taakId: taak.id, minuten: rijden - gat });
      }
      const gereden = Math.max(0, Math.min(rijden, gat));
      if (gereden > 0) {
        segmenten.push({
          soort: "rijden", vanMinuut: vorigEind, totMinuut: vorigEind + gereden,
          plaats: taak.adres.plaats, werkelijk: false,
        });
      }
      if (gat - gereden > 0) {
        segmenten.push({
          soort: "wachten", vanMinuut: vorigEind + gereden, totMinuut: van,
          plaats: taak.adres.plaats, werkelijk: false,
        });
      }
    }

    const venster = taak.adres.tijdvenster
      ? {
          vanMinuut: minuutVan(taak.adres.tijdvenster.van, invoer.datum),
          totMinuut: minuutVan(taak.adres.tijdvenster.tot, invoer.datum),
        }
      : undefined;
    const buitenVenster = venster ? tot > venster.totMinuut || van < venster.vanMinuut : false;
    if (venster && tot > venster.totMinuut) {
      knelpunten.push({
        soort: "buiten_venster", minuut: venster.totMinuut, taakId: taak.id,
        minuten: tot - venster.totMinuut,
      });
    }

    segmenten.push({
      soort: SOORT_VAN_TAAK[taak.soort],
      vanMinuut: van, totMinuut: tot,
      taakId: taak.id, plaats: taak.adres.plaats,
      status, werkelijk, venster, buitenVenster,
    });

    vorigePlaats = taak.adres.plaats;
    vorigEind = tot;
  }

  if (segmenten.length === 0) return null;

  const vanMinuut = segmenten[0].vanMinuut;
  const totMinuut = segmenten[segmenten.length - 1].totMinuut;

  // Wordt er ergens langer dan het toegestane blok aaneengesloten gereden
  // zonder dat er een gat van minstens 45 minuten in zit? Dan moet de planner
  // pauze inplannen.
  markeerPauzeoverschrijding(segmenten, knelpunten);

  const markers = bouwMarkers(rit, invoer, maxDienst);

  const bezetteMinuten = segmenten
    .filter((s) => s.soort !== "wachten")
    .reduce((som, s) => som + (s.totMinuut - s.vanMinuut), 0);
  const wachtMinuten = segmenten
    .filter((s) => s.soort === "wachten")
    .reduce((som, s) => som + (s.totMinuut - s.vanMinuut), 0);

  return {
    ritId: rit.id,
    chauffeur: rit.chauffeur,
    kentekenGenormaliseerd: rit.voertuig.kentekenGenormaliseerd,
    landcode: rit.voertuig.landcode,
    segmenten, knelpunten, markers,
    vanMinuut, totMinuut, bezetteMinuten, wachtMinuten,
  };
}

/**
 * Werkelijke tijden gaan voor op geplande. Een stop die bezig is heeft wel een
 * begin maar nog geen eind; dan houden we het geplande eind aan, maar niet
 * korter dan wat er al verstreken is.
 */
function tijdenVan(
  taak: Taak, events: readonly TaakEvent[], status: TaakStatus, datum: string
): { van: number; tot: number; werkelijk: boolean } {
  const gepland = {
    van: minuutVan(taak.geplandVan, datum),
    tot: minuutVan(taak.geplandTot, datum),
  };
  const aangekomen = events.find((e) => e.type === "aangekomen");
  const klaar = events.find((e) => e.type === "geladen" || e.type === "gelost");

  if (aangekomen && klaar) {
    return {
      van: minuutVan(aangekomen.tijdstip, datum),
      tot: minuutVan(klaar.tijdstip, datum),
      werkelijk: true,
    };
  }
  if (aangekomen) {
    const van = minuutVan(aangekomen.tijdstip, datum);
    return { van, tot: Math.max(van + 1, gepland.tot), werkelijk: true };
  }
  return { ...gepland, werkelijk: status === "afgerond" };
}

/**
 * Aaneengesloten rijden zonder onderbreking van minstens 45 minuten. Laden en
 * lossen onderbreken de rijtijd niet — dat is werk, geen rust (561/2006).
 */
function markeerPauzeoverschrijding(segmenten: readonly Segment[], knelpunten: Knelpunt[]): void {
  let blok = 0;
  let gemeld = false;
  for (const segment of segmenten) {
    const duur = segment.totMinuut - segment.vanMinuut;
    if (segment.soort === "rijden") {
      blok += duur;
      if (blok > RIJTIJD_REGELS.blokRijMinuten && !gemeld) {
        knelpunten.push({
          soort: "pauze_overschreden",
          minuut: segment.totMinuut,
          minuten: blok - RIJTIJD_REGELS.blokRijMinuten,
        });
        gemeld = true;
      }
    } else if (segment.soort === "pauze" || segment.soort === "wachten") {
      if (duur >= RIJTIJD_REGELS.pauzeNaBlokMinuten) { blok = 0; gemeld = false; }
    }
  }
}

function bouwMarkers(rit: Rit, invoer: TijdbalkInvoer, maxDienst: number): Marker[] {
  const markers: Marker[] = [];
  if (invoer.nu) markers.push({ soort: "nu", minuut: minuutVan(invoer.nu, invoer.datum) });

  const start = invoer.dienstStart?.(rit.chauffeur);
  if (start) {
    const startMinuut = minuutVan(start, invoer.datum);
    markers.push({ soort: "dienst_einde", minuut: startMinuut + maxDienst });
  }
  return markers;
}

/**
 * Het tijdvenster dat de balk moet tonen: van het vroegste begin tot het
 * laatste eind, afgerond op hele uren en met een uur lucht aan beide kanten.
 * Zo staat de dag altijd op een ronde streep en schuift hij niet bij elke tik.
 */
export function balkVenster(
  rijen: readonly TijdbalkRij[],
  minimaal = { vanUur: 4, totUur: 20 }
): { vanMinuut: number; totMinuut: number } {
  if (rijen.length === 0) {
    return { vanMinuut: minimaal.vanUur * 60, totMinuut: minimaal.totUur * 60 };
  }
  const vroegste = Math.min(...rijen.map((r) => r.vanMinuut));
  const laatste = Math.max(...rijen.map((r) => r.totMinuut));
  return {
    vanMinuut: Math.min(minimaal.vanUur * 60, Math.floor((vroegste - 60) / 60) * 60),
    totMinuut: Math.max(minimaal.totUur * 60, Math.ceil((laatste + 60) / 60) * 60),
  };
}

/**
 * Gaten waar nog werk in past: perioden waarin een auto niets doet, lang
 * genoeg om er iets in te plannen. Dit is waar de planner naar zoekt als er
 * een spoedorder binnenkomt.
 */
export interface Gat {
  ritId: string;
  chauffeur: string;
  vanMinuut: number;
  totMinuut: number;
  minuten: number;
  /** Waar de auto staat op het moment dat het gat begint. */
  plaats: string;
}

export function vrijeGaten(
  rijen: readonly TijdbalkRij[],
  minimaalMinuten = 60
): Gat[] {
  const gaten: Gat[] = [];
  for (const rij of rijen) {
    for (const segment of rij.segmenten) {
      if (segment.soort !== "wachten") continue;
      const minuten = segment.totMinuut - segment.vanMinuut;
      if (minuten < minimaalMinuten) continue;
      gaten.push({
        ritId: rij.ritId,
        chauffeur: rij.chauffeur,
        vanMinuut: segment.vanMinuut,
        totMinuut: segment.totMinuut,
        minuten,
        plaats: segment.plaats ?? "",
      });
    }
  }
  return gaten.sort((a, b) => b.minuten - a.minuten);
}
