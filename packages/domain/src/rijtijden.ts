// Rij- en rusttijden volgens Verordening (EG) 561/2006 en het
// Arbeidstijdenbesluit vervoer. Elke constante hieronder staat met bron in
// directives/rij_en_rusttijden.md — wijzig nooit een getal zonder die
// directive bij te werken.
//
// Alles wordt afgeleid uit de append-only werktijd-events (§5.1): net als een
// tachograaf leest deze motor een aaneengesloten reeks activiteiten en leidt
// daar dagen, weken, pauzes, rusten en overtredingen uit af. Er wordt niets
// als status opgeslagen.

import { lokaleDatum, nachtMinuten, weekStartMs } from "./tijd";
import type { WerktijdEvent } from "./werktijden";

export const RIJTIJD_REGELS = {
  // 561/2006 art. 6 — rijtijden
  maxDagRijMinuten: 9 * 60,
  maxDagRijVerlengdMinuten: 10 * 60,
  maxVerlengingenPerWeek: 2,
  maxWeekRijMinuten: 56 * 60,
  maxTweeWekenRijMinuten: 90 * 60,

  // 561/2006 art. 7 — onderbreking
  blokRijMinuten: 4.5 * 60,
  pauzeNaBlokMinuten: 45,
  pauzeDeel1Minuten: 15,
  pauzeDeel2Minuten: 30,

  // 561/2006 art. 8 — rusttijden
  dagRustMinuten: 11 * 60,
  dagRustVerkortMinuten: 9 * 60,
  dagRustGesplitstDeel1Minuten: 3 * 60,
  maxVerkorteDagRustenTussenWeekrust: 3,
  weekRustMinuten: 45 * 60,
  weekRustVerkortMinuten: 24 * 60,
  weekRustUiterlijkNaMinuten: 6 * 24 * 60,
  compensatieBinnenWeken: 3,

  // 561/2006 art. 4 sub o — dubbele bemanning
  dubbeleBemanningVensterMinuten: 30 * 60,
  dubbeleBemanningRustMinuten: 9 * 60,

  // Arbeidstijdenbesluit vervoer / richtlijn 2002/15/EG
  maxWeekArbeidMinuten: 60 * 60,
  gemiddeldeWeekArbeidMinuten: 48 * 60,
  referentieperiodeWeken: 16,
  maxDienstMinuten: 12 * 60,
  maxDienstMetNachtarbeidMinuten: 10 * 60,
  nachtarbeidDrempelMinuten: 60,
} as const;

// ── Activiteiten ────────────────────────────────────────────────────────────

export type ActiviteitSoort = "rijden" | "werk" | "beschikbaar" | "rust";

export interface Activiteit {
  soort: ActiviteitSoort;
  vanMs: number;
  totMs: number;
  minuten: number;
}

const SOORT_NA: Record<WerktijdEvent["type"], ActiviteitSoort> = {
  ingeklokt: "werk",
  rijden_gestart: "rijden",
  werk_gestart: "werk",
  beschikbaar_gestart: "beschikbaar",
  pauze_gestart: "rust",
  uitgeklokt: "rust",
};

/** Zet de event-log om in aaneengesloten activiteitsperioden. */
export function activiteiten(
  events: readonly WerktijdEvent[],
  nu: string
): Activiteit[] {
  const gesorteerd = [...events].sort((a, b) => a.tijdstip.localeCompare(b.tijdstip));
  const nuMs = Date.parse(nu);
  const lijst: Activiteit[] = [];
  for (let i = 0; i < gesorteerd.length; i++) {
    const vanMs = Date.parse(gesorteerd[i].tijdstip);
    const totMs = i + 1 < gesorteerd.length
      ? Date.parse(gesorteerd[i + 1].tijdstip)
      : nuMs;
    if (totMs <= vanMs) continue;
    lijst.push({
      soort: SOORT_NA[gesorteerd[i].type],
      vanMs,
      totMs,
      minuten: Math.round((totMs - vanMs) / 60_000),
    });
  }
  return lijst;
}

// ── Dagvensters en rusten ───────────────────────────────────────────────────

export type DagRustSoort = "normaal" | "gesplitst" | "verkort";

export interface Dagvenster {
  /** Lokale datum waarop het venster begint. */
  datum: string;
  vanMs: number;
  totMs: number;
  rijMinuten: number;
  arbeidMinuten: number;
  dienstMinuten: number;
  nachtMinuten: number;
  /** Verlenging naar 10 uur gebruikt (rijtijd boven 9 uur). */
  verlengd: boolean;
  /** De rust die dit venster afsloot; ontbreekt als het venster nog loopt. */
  afgeslotenMet?: { minuten: number; soort: DagRustSoort };
}

export interface WeekRust {
  vanMs: number;
  totMs: number;
  minuten: number;
  verkort: boolean;
  /** Tekort t.o.v. 45 uur, te compenseren vóór het einde van de 3e week. */
  tekortMinuten: number;
  compensatieVoorMs: number;
}

interface Verdeling {
  dagvensters: Dagvenster[];
  weekRusten: WeekRust[];
}

/**
 * Verdeelt de activiteiten in dagvensters (gescheiden door een dagelijkse rust
 * van minimaal 9 uur) en herkent de wekelijkse rusten (minimaal 24 uur).
 */
export function verdeelPerDag(lijst: readonly Activiteit[]): Verdeling {
  const dagvensters: Dagvenster[] = [];
  const weekRusten: WeekRust[] = [];
  let huidig: Dagvenster | null = null;
  // Een rust van ≥3 uur eerder in het venster maakt een aansluitende rust van
  // 9 uur tot een geldige gesplitste dagrust (3 + 9) in plaats van verkort.
  let langeRustInVenster = false;

  const start = (ms: number): Dagvenster => ({
    datum: lokaleDatum(new Date(ms).toISOString()),
    vanMs: ms, totMs: ms,
    rijMinuten: 0, arbeidMinuten: 0, dienstMinuten: 0, nachtMinuten: 0,
    verlengd: false,
  });

  for (const act of lijst) {
    if (act.soort === "rust" && act.minuten >= RIJTIJD_REGELS.dagRustVerkortMinuten) {
      if (huidig) {
        const soort: DagRustSoort =
          act.minuten >= RIJTIJD_REGELS.dagRustMinuten ? "normaal"
          : langeRustInVenster ? "gesplitst"
          : "verkort";
        huidig.afgeslotenMet = { minuten: act.minuten, soort };
        huidig.verlengd = huidig.rijMinuten > RIJTIJD_REGELS.maxDagRijMinuten;
        dagvensters.push(huidig);
        huidig = null;
      }
      if (act.minuten >= RIJTIJD_REGELS.weekRustVerkortMinuten) {
        const verkort = act.minuten < RIJTIJD_REGELS.weekRustMinuten;
        weekRusten.push({
          vanMs: act.vanMs, totMs: act.totMs, minuten: act.minuten, verkort,
          tekortMinuten: verkort ? RIJTIJD_REGELS.weekRustMinuten - act.minuten : 0,
          compensatieVoorMs:
            weekStartMs(act.vanMs) +
            (RIJTIJD_REGELS.compensatieBinnenWeken + 1) * 7 * 86_400_000,
        });
      }
      langeRustInVenster = false;
      continue;
    }

    if (!huidig) huidig = start(act.vanMs);
    huidig.totMs = act.totMs;
    if (act.soort === "rijden") huidig.rijMinuten += act.minuten;
    if (act.soort === "rijden" || act.soort === "werk") {
      huidig.arbeidMinuten += act.minuten;
      huidig.nachtMinuten += nachtMinuten(act.vanMs, act.totMs);
    }
    if (act.soort !== "rust") huidig.dienstMinuten += act.minuten;
    if (act.soort === "rust" && act.minuten >= RIJTIJD_REGELS.dagRustGesplitstDeel1Minuten) {
      langeRustInVenster = true;
    }
  }

  if (huidig) {
    huidig.verlengd = huidig.rijMinuten > RIJTIJD_REGELS.maxDagRijMinuten;
    dagvensters.push(huidig);
  }
  return { dagvensters, weekRusten };
}

// ── Onderbreking (pauze) ────────────────────────────────────────────────────

interface BlokStand {
  blokRijMinuten: number;
  deel1Gehad: boolean;
}

/**
 * Onafgebroken rijtijd sinds de laatste geldige onderbreking. Een pauze van
 * 45 minuten reset het blok; gesplitst mag ook, maar alleen in de volgorde
 * 15 minuten gevolgd door 30 minuten.
 */
export function blokStand(lijst: readonly Activiteit[]): BlokStand {
  let blok = 0;
  let deel1 = false;
  for (const act of lijst) {
    if (act.soort === "rijden") { blok += act.minuten; continue; }
    if (act.soort !== "rust") continue; // ander werk onderbreekt, maar telt niet
    if (act.minuten >= RIJTIJD_REGELS.pauzeNaBlokMinuten) { blok = 0; deel1 = false; }
    else if (act.minuten >= RIJTIJD_REGELS.pauzeDeel2Minuten && deel1) { blok = 0; deel1 = false; }
    else if (act.minuten >= RIJTIJD_REGELS.pauzeDeel1Minuten) { deel1 = true; }
  }
  return { blokRijMinuten: blok, deel1Gehad: deel1 };
}

// ── Status ──────────────────────────────────────────────────────────────────

export type OvertredingCode =
  | "dagrijtijd"
  | "verlengingen"
  | "weekrijtijd"
  | "tweewekenrijtijd"
  | "pauze"
  | "dagrust"
  | "verkorte_dagrusten"
  | "weekrust_termijn"
  | "weekarbeid"
  | "gemiddelde_arbeid"
  | "dienstduur"
  | "nachtdienst";

export interface Overtreding {
  code: OvertredingCode;
  ernst: "overtreding" | "waarschuwing";
  omschrijving: string;
}

export interface RijtijdStatus {
  // Dag
  dagRijMinuten: number;
  dagResterendMinuten: number;
  /** Extra ruimte als de planner bewust naar 10 uur verlengt. */
  dagResterendMetVerlengingMinuten: number;
  verlengingenGebruikt: number;
  verlengingenOver: number;
  // Blok
  blokRijMinuten: number;
  blokResterendMinuten: number;
  pauzeNodig: boolean;
  pauzeDeel1Gehad: boolean;
  // Week
  weekRijMinuten: number;
  weekResterendMinuten: number;
  tweeWekenRijMinuten: number;
  tweeWekenResterendMinuten: number;
  // Rust
  verkorteDagRustenGebruikt: number;
  verkorteDagRustenOver: number;
  minutenSindsWeekRust: number | null;
  minutenTotWeekRustDeadline: number | null;
  openstaandeCompensatieMinuten: number;
  // Arbeidstijd
  weekArbeidMinuten: number;
  weekArbeidResterendMinuten: number;
  gemiddeldeWeekArbeidMinuten: number;
  dienstMinuten: number;
  dienstResterendMinuten: number;
  nachtdienst: boolean;
  // Oordeel
  overtredingen: Overtreding[];
}

export interface RijtijdInvoer {
  events: readonly WerktijdEvent[];
  nu: string;
  /**
   * Rijtijd vóór de eerste dag in de event-log, per week (sleutel = UTC-ms van
   * maandag 00:00). Nodig zolang de historie niet volledig in de log zit.
   */
  eerdereRijMinutenPerWeek?: Record<number, number>;
  /** Arbeidsminuten per week over de referentieperiode, voor het gemiddelde. */
  eerdereArbeidMinutenPerWeek?: Record<number, number>;
}

const uren = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;

export function rijtijdStatus(invoer: RijtijdInvoer): RijtijdStatus {
  const { events, nu } = invoer;
  const nuMs = Date.parse(nu);
  const lijst = activiteiten(events, nu);
  const { dagvensters, weekRusten } = verdeelPerDag(lijst);
  const R = RIJTIJD_REGELS;

  const dezeWeekMs = weekStartMs(nuMs);
  const vorigeWeekMs = weekStartMs(dezeWeekMs - 86_400_000);
  const inWeek = (ms: number, weekMs: number) =>
    ms >= weekMs && ms < weekMs + 7 * 86_400_000;

  // Rijtijd per week: elk dagvenster telt bij de week waarin het begint.
  const rijInWeek = (weekMs: number) =>
    dagvensters.filter((d) => inWeek(d.vanMs, weekMs)).reduce((s, d) => s + d.rijMinuten, 0) +
    (invoer.eerdereRijMinutenPerWeek?.[weekMs] ?? 0);
  const arbeidInWeek = (weekMs: number) =>
    dagvensters.filter((d) => inWeek(d.vanMs, weekMs)).reduce((s, d) => s + d.arbeidMinuten, 0) +
    (invoer.eerdereArbeidMinutenPerWeek?.[weekMs] ?? 0);

  const weekRij = rijInWeek(dezeWeekMs);
  const tweeWeken = weekRij + rijInWeek(vorigeWeekMs);
  const weekArbeid = arbeidInWeek(dezeWeekMs);

  // Huidig (nog niet afgesloten) dagvenster.
  const huidig = dagvensters.at(-1);
  const lopend = huidig && !huidig.afgeslotenMet ? huidig : undefined;
  const dagRij = lopend?.rijMinuten ?? 0;

  const verlengingenGebruikt = dagvensters
    .filter((d) => inWeek(d.vanMs, dezeWeekMs) && d !== lopend && d.verlengd).length;

  const { blokRijMinuten, deel1Gehad } = blokStand(lijst);

  // Verkorte dagrusten sinds de laatste wekelijkse rust.
  const laatsteWeekRust = weekRusten.at(-1);
  const verkorteDagRusten = dagvensters.filter(
    (d) => d.afgeslotenMet?.soort === "verkort" &&
      (!laatsteWeekRust || d.totMs > laatsteWeekRust.totMs)
  ).length;

  const minutenSindsWeekRust = laatsteWeekRust
    ? Math.round((nuMs - laatsteWeekRust.totMs) / 60_000)
    : null;
  const minutenTotDeadline = minutenSindsWeekRust === null
    ? null
    : R.weekRustUiterlijkNaMinuten - minutenSindsWeekRust;

  const openstaandeCompensatie = weekRusten
    .filter((w) => w.verkort && w.compensatieVoorMs > nuMs)
    .reduce((s, w) => s + w.tekortMinuten, 0);

  // Gemiddelde arbeidstijd over de referentieperiode.
  const weken: number[] = [];
  for (let i = 0; i < R.referentieperiodeWeken; i++) {
    weken.push(weekStartMs(dezeWeekMs - i * 7 * 86_400_000));
  }
  const gemiddelde = Math.round(
    weken.reduce((s, w) => s + arbeidInWeek(w), 0) / R.referentieperiodeWeken
  );

  const dienstMinuten = lopend?.dienstMinuten ?? 0;
  const nachtdienst = (lopend?.nachtMinuten ?? 0) > R.nachtarbeidDrempelMinuten;
  const maxDienst = nachtdienst ? R.maxDienstMetNachtarbeidMinuten : R.maxDienstMinuten;

  const status: RijtijdStatus = {
    dagRijMinuten: dagRij,
    dagResterendMinuten: Math.max(0, R.maxDagRijMinuten - dagRij),
    dagResterendMetVerlengingMinuten:
      verlengingenGebruikt < R.maxVerlengingenPerWeek
        ? Math.max(0, R.maxDagRijVerlengdMinuten - dagRij)
        : Math.max(0, R.maxDagRijMinuten - dagRij),
    verlengingenGebruikt,
    verlengingenOver: Math.max(0, R.maxVerlengingenPerWeek - verlengingenGebruikt),
    blokRijMinuten,
    blokResterendMinuten: Math.max(0, R.blokRijMinuten - blokRijMinuten),
    pauzeNodig: blokRijMinuten >= R.blokRijMinuten,
    pauzeDeel1Gehad: deel1Gehad,
    weekRijMinuten: weekRij,
    weekResterendMinuten: Math.max(0, R.maxWeekRijMinuten - weekRij),
    tweeWekenRijMinuten: tweeWeken,
    tweeWekenResterendMinuten: Math.max(0, R.maxTweeWekenRijMinuten - tweeWeken),
    verkorteDagRustenGebruikt: verkorteDagRusten,
    verkorteDagRustenOver: Math.max(0, R.maxVerkorteDagRustenTussenWeekrust - verkorteDagRusten),
    minutenSindsWeekRust,
    minutenTotWeekRustDeadline: minutenTotDeadline,
    openstaandeCompensatieMinuten: openstaandeCompensatie,
    weekArbeidMinuten: weekArbeid,
    weekArbeidResterendMinuten: Math.max(0, R.maxWeekArbeidMinuten - weekArbeid),
    gemiddeldeWeekArbeidMinuten: gemiddelde,
    dienstMinuten,
    dienstResterendMinuten: Math.max(0, maxDienst - dienstMinuten),
    nachtdienst,
    overtredingen: [],
  };

  status.overtredingen = bepaalOvertredingen(status, dagvensters, dezeWeekMs, inWeek);
  return status;
}

function bepaalOvertredingen(
  s: RijtijdStatus,
  dagvensters: readonly Dagvenster[],
  dezeWeekMs: number,
  inWeek: (ms: number, weekMs: number) => boolean
): Overtreding[] {
  const R = RIJTIJD_REGELS;
  const lijst: Overtreding[] = [];
  const voeg = (code: OvertredingCode, ernst: Overtreding["ernst"], omschrijving: string) =>
    lijst.push({ code, ernst, omschrijving });

  const maxVandaag = s.verlengingenGebruikt < R.maxVerlengingenPerWeek
    ? R.maxDagRijVerlengdMinuten
    : R.maxDagRijMinuten;
  if (s.dagRijMinuten > maxVandaag) {
    voeg("dagrijtijd", "overtreding",
      `Dagelijkse rijtijd ${uren(s.dagRijMinuten)} overschrijdt het maximum van ${uren(maxVandaag)}.`);
  } else if (s.dagRijMinuten > R.maxDagRijMinuten) {
    voeg("verlengingen", "waarschuwing",
      `Verlengde rijdag in gebruik (${uren(s.dagRijMinuten)}); ${s.verlengingenOver} verlenging(en) over deze week.`);
  }

  const verlengdDezeWeek = dagvensters.filter((d) => inWeek(d.vanMs, dezeWeekMs) && d.verlengd).length;
  if (verlengdDezeWeek > R.maxVerlengingenPerWeek) {
    voeg("verlengingen", "overtreding",
      `${verlengdDezeWeek} verlengde rijdagen deze week; maximaal ${R.maxVerlengingenPerWeek} toegestaan.`);
  }

  if (s.weekRijMinuten > R.maxWeekRijMinuten) {
    voeg("weekrijtijd", "overtreding",
      `Wekelijkse rijtijd ${uren(s.weekRijMinuten)} boven het maximum van ${uren(R.maxWeekRijMinuten)}.`);
  }
  if (s.tweeWekenRijMinuten > R.maxTweeWekenRijMinuten) {
    voeg("tweewekenrijtijd", "overtreding",
      `Rijtijd over twee weken ${uren(s.tweeWekenRijMinuten)} boven het maximum van ${uren(R.maxTweeWekenRijMinuten)}.`);
  }
  if (s.pauzeNodig) {
    voeg("pauze", "overtreding",
      `${uren(s.blokRijMinuten)} onafgebroken gereden; na ${uren(R.blokRijMinuten)} is ${R.pauzeNaBlokMinuten} min pauze verplicht.`);
  }
  if (s.verkorteDagRustenGebruikt > R.maxVerkorteDagRustenTussenWeekrust) {
    voeg("verkorte_dagrusten", "overtreding",
      `${s.verkorteDagRustenGebruikt} verkorte dagrusten sinds de laatste weekrust; maximaal ${R.maxVerkorteDagRustenTussenWeekrust}.`);
  }
  if (s.minutenTotWeekRustDeadline !== null && s.minutenTotWeekRustDeadline < 0) {
    voeg("weekrust_termijn", "overtreding",
      `Wekelijkse rust had uiterlijk na zes perioden van 24 uur moeten beginnen; termijn ${uren(-s.minutenTotWeekRustDeadline)} verstreken.`);
  } else if (s.minutenTotWeekRustDeadline !== null && s.minutenTotWeekRustDeadline <= 24 * 60) {
    // Op de grens al waarschuwen: een planner moet de laatste dag kunnen zien
    // aankomen, niet pas als de termijn feitelijk al loopt af te tellen.
    voeg("weekrust_termijn", "waarschuwing",
      `Wekelijkse rust moet binnen ${uren(s.minutenTotWeekRustDeadline)} beginnen.`);
  }
  if (s.weekArbeidMinuten > R.maxWeekArbeidMinuten) {
    voeg("weekarbeid", "overtreding",
      `Arbeidstijd deze week ${uren(s.weekArbeidMinuten)} boven het maximum van ${uren(R.maxWeekArbeidMinuten)}.`);
  }
  if (s.gemiddeldeWeekArbeidMinuten > R.gemiddeldeWeekArbeidMinuten) {
    voeg("gemiddelde_arbeid", "waarschuwing",
      `Gemiddelde arbeidstijd ${uren(s.gemiddeldeWeekArbeidMinuten)} per week over ${R.referentieperiodeWeken} weken; norm is ${uren(R.gemiddeldeWeekArbeidMinuten)}.`);
  }
  const maxDienst = s.nachtdienst ? R.maxDienstMetNachtarbeidMinuten : R.maxDienstMinuten;
  if (s.dienstMinuten > maxDienst) {
    voeg(s.nachtdienst ? "nachtdienst" : "dienstduur", "overtreding",
      `Dienst ${uren(s.dienstMinuten)} boven het maximum van ${uren(maxDienst)}${s.nachtdienst ? " bij nachtarbeid" : ""}.`);
  }
  return lijst;
}

// ── Inplancontrole ──────────────────────────────────────────────────────────

export type InplanReden =
  | "dagrijtijd"
  | "weekrijtijd"
  | "tweewekenrijtijd"
  | "dienstduur"
  | "weekarbeid"
  | "weekrust_termijn"
  | "pauze_eerst";

export interface InplanControle {
  kan: boolean;
  redenen: InplanReden[];
  /** Past alleen als de planner bewust naar 10 uur verlengt. */
  vereistVerlenging: boolean;
  /** Er moet eerst 45 min pauze in voordat dit past. */
  vereistPauze: boolean;
}

/**
 * Past er nog `extraRijMinuten` bij deze chauffeur binnen alle grenzen?
 * Verlenging naar 10 uur wordt nooit stilzwijgend gebruikt: het resultaat
 * meldt expliciet dat de planner die keuze moet maken.
 */
export function kanInplannen(
  status: RijtijdStatus,
  extraRijMinuten: number
): InplanControle {
  const redenen: InplanReden[] = [];

  const vereistVerlenging =
    extraRijMinuten > status.dagResterendMinuten &&
    extraRijMinuten <= status.dagResterendMetVerlengingMinuten;
  if (extraRijMinuten > status.dagResterendMetVerlengingMinuten) redenen.push("dagrijtijd");
  if (extraRijMinuten > status.weekResterendMinuten) redenen.push("weekrijtijd");
  if (extraRijMinuten > status.tweeWekenResterendMinuten) redenen.push("tweewekenrijtijd");
  if (extraRijMinuten > status.dienstResterendMinuten) redenen.push("dienstduur");
  if (extraRijMinuten > status.weekArbeidResterendMinuten) redenen.push("weekarbeid");
  if (
    status.minutenTotWeekRustDeadline !== null &&
    extraRijMinuten > status.minutenTotWeekRustDeadline
  ) redenen.push("weekrust_termijn");

  // Meer rijden dan het blok toelaat kan alleen met een pauze ertussen.
  const vereistPauze = extraRijMinuten > status.blokResterendMinuten;
  if (status.pauzeNodig) redenen.push("pauze_eerst");

  return { kan: redenen.length === 0, redenen, vereistVerlenging, vereistPauze };
}
