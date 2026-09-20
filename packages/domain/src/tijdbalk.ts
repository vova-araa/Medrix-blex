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
 * Het tijdvenster dat de balk moet tonen: alles wat er getekend wordt — stops
 * én markers — met een uur lucht aan beide kanten, afgerond op hele uren. Een
 * vast venster van 's ochtends vroeg tot 's avonds laat zou van elke dag een
 * half leeg bord maken; een dag die om half zes begint en om half een klaar is
 * hoort ook zo breed te staan.
 *
 * Markers buiten de kalenderdag tellen niet mee: de nu-streep van vandaag mag
 * het bord van morgen niet uitrekken.
 */
export function balkVenster(
  rijen: readonly TijdbalkRij[],
  opties: { minimaalUren?: number; luchtMinuten?: number } = {}
): { vanMinuut: number; totMinuut: number } {
  const minimaalUren = opties.minimaalUren ?? 8;
  const lucht = opties.luchtMinuten ?? 60;

  const punten: number[] = [];
  for (const rij of rijen) {
    punten.push(rij.vanMinuut, rij.totMinuut);
    for (const marker of rij.markers) {
      if (marker.minuut >= 0 && marker.minuut <= 24 * 60) punten.push(marker.minuut);
    }
  }
  if (punten.length === 0) return { vanMinuut: 6 * 60, totMinuut: 6 * 60 + minimaalUren * 60 };

  let van = Math.floor((Math.min(...punten) - lucht) / 60) * 60;
  let tot = Math.ceil((Math.max(...punten) + lucht) / 60) * 60;

  // Een korte dag helemaal uitrekken leest ook niet; onder deze breedte
  // groeit het venster aan beide kanten mee.
  const tekort = minimaalUren * 60 - (tot - van);
  if (tekort > 0) {
    van -= Math.ceil(tekort / 120) * 60;
    tot += Math.ceil(tekort / 120) * 60;
  }
  return { vanMinuut: van, totMinuut: tot };
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
  /**
   * Een gat tussen twee stops, of de tijd die na de laatste stop nog over is
   * binnen de dienst. Dat laatste is meestal het grootste gat van de dag en
   * de eerste plek waar een spoedorder heen kan.
   */
  soort: "tussen" | "na";
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
        soort: "tussen",
      });
    }

    // Wat er na de laatste stop nog binnen de dienst overblijft. Zonder een
    // ingeklokte dienst weten we niet tot hoe laat hij mag, en zeggen we niets.
    const einde = rij.markers.find((m) => m.soort === "dienst_einde")?.minuut;
    if (einde !== undefined && einde - rij.totMinuut >= minimaalMinuten) {
      gaten.push({
        ritId: rij.ritId,
        chauffeur: rij.chauffeur,
        vanMinuut: rij.totMinuut,
        totMinuut: einde,
        minuten: einde - rij.totMinuut,
        plaats: rij.segmenten[rij.segmenten.length - 1].plaats ?? "",
        soort: "na",
      });
    }
  }
  return gaten.sort((a, b) => b.minuten - a.minuten);
}

// ── Samenvatting en knelpuntenlijst ─────────────────────────────────────────
//
// Een planbord dat alleen gekleurde blokken toont laat de planner zelf tellen.
// Deze twee functies doen dat tellen: hoe de dag ervoor staat, en wat er
// precies misgaat. De UI hoeft dan niets meer te rekenen.

export interface BalkSamenvatting {
  ritten: number;
  /** Stops: laden, lossen en emballage samen. Rijden en wachten tellen niet. */
  stops: number;
  bezetteMinuten: number;
  wachtMinuten: number;
  /** Aandeel van de tijd tussen eerste en laatste stop dat echt werk is. */
  bezettingPct: number;
  knelpunten: number;
  /** Ritten zonder één knelpunt — de dag die vanzelf goed gaat. */
  schoneRitten: number;
  /** Minuten in gaten die groot genoeg zijn om nog iets in te plannen. */
  vrijeMinuten: number;
  vrijeGaten: number;
  vroegsteMinuut: number;
  laatsteMinuut: number;
}

export function balkSamenvatting(
  rijen: readonly TijdbalkRij[],
  minimaalGatMinuten = 60
): BalkSamenvatting {
  const gaten = vrijeGaten(rijen, minimaalGatMinuten);
  const bezetteMinuten = rijen.reduce((som, r) => som + r.bezetteMinuten, 0);
  const wachtMinuten = rijen.reduce((som, r) => som + r.wachtMinuten, 0);
  const totaal = bezetteMinuten + wachtMinuten;

  return {
    ritten: rijen.length,
    stops: rijen.reduce(
      (som, r) => som + r.segmenten.filter((s) => s.taakId !== undefined).length, 0
    ),
    bezetteMinuten,
    wachtMinuten,
    bezettingPct: totaal === 0 ? 0 : Math.round((bezetteMinuten / totaal) * 100),
    knelpunten: rijen.reduce((som, r) => som + r.knelpunten.length, 0),
    schoneRitten: rijen.filter((r) => r.knelpunten.length === 0).length,
    vrijeMinuten: gaten.reduce((som, g) => som + g.minuten, 0),
    vrijeGaten: gaten.length,
    vroegsteMinuut: rijen.length === 0 ? 0 : Math.min(...rijen.map((r) => r.vanMinuut)),
    laatsteMinuut: rijen.length === 0 ? 0 : Math.max(...rijen.map((r) => r.totMinuut)),
  };
}

export interface KnelpuntRegel extends Knelpunt {
  ritId: string;
  chauffeur: string;
  kentekenGenormaliseerd: string;
  landcode: string;
  /** Waar het misgaat, als dat bij een stop hoort. */
  plaats?: string;
}

/**
 * Volgorde van dringendheid. Te krap staat bovenaan: dat is een plan dat niet
 * te rijden is en alles erna schuift mee. Een gemist venster raakt één klant,
 * en de pauzemelding is een wettelijke grens die de chauffeur zelf nog kan
 * pakken door eerder te stoppen.
 */
const ERNST: Record<KnelpuntSoort, number> = {
  te_krap: 0,
  buiten_venster: 1,
  pauze_overschreden: 2,
};

/** Alle knelpunten van het bord op één rij, dringendste eerst. */
export function knelpuntenLijst(rijen: readonly TijdbalkRij[]): KnelpuntRegel[] {
  const regels: KnelpuntRegel[] = [];
  for (const rij of rijen) {
    for (const knelpunt of rij.knelpunten) {
      const bij = knelpunt.taakId
        ? rij.segmenten.find((s) => s.taakId === knelpunt.taakId)
        : rij.segmenten.find((s) => s.vanMinuut <= knelpunt.minuut && s.totMinuut >= knelpunt.minuut);
      regels.push({
        ...knelpunt,
        ritId: rij.ritId,
        chauffeur: rij.chauffeur,
        kentekenGenormaliseerd: rij.kentekenGenormaliseerd,
        landcode: rij.landcode,
        plaats: bij?.plaats,
      });
    }
  }
  return regels.sort(
    (a, b) => ERNST[a.soort] - ERNST[b.soort] || a.minuut - b.minuut
  );
}

/** Minuten sinds middernacht als HH:MM. */
export function balkTijd(minuut: number): string {
  const uren = Math.floor(minuut / 60);
  const minuten = Math.round(minuut - uren * 60);
  return `${String(uren % 24).padStart(2, "0")}:${String(minuten).padStart(2, "0")}`;
}
