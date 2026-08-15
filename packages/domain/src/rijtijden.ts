// Rij- en rusttijden (EU-verordening 561/2006, dagelijkse kern):
// - maximaal 9 uur rijtijd per dag (verlenging naar 10 uur mag 2× per week —
//   die uitzondering plant Sharzi bewust NIET automatisch in);
// - na 4,5 uur onafgebroken rijden is 45 minuten pauze verplicht
//   (ander werk onderbreekt het rijden, maar telt níét als pauze);
// - maximaal 56 uur rijtijd per week.
// Alles wordt afgeleid uit de append-only werktijd-events (§5.1).

import type { WerktijdEvent } from "./werktijden";

export const RIJTIJD_REGELS = {
  maxDagRijMinuten: 9 * 60,
  blokRijMinuten: 4.5 * 60,
  pauzeNaBlokMinuten: 45,
  maxWeekRijMinuten: 56 * 60,
} as const;

export interface RijtijdStatus {
  dagRijMinuten: number;
  dagResterendMinuten: number;
  /** Onafgebroken rijtijd sinds de laatste pauze/rust van ≥ 45 minuten. */
  blokRijMinuten: number;
  blokResterendMinuten: number;
  weekRijMinuten: number;
  weekResterendMinuten: number;
  pauzeNodig: boolean;
}

type Toestand = "rijden" | "werk" | "pauze" | null;

const TOESTAND_NA: Record<WerktijdEvent["type"], Toestand> = {
  ingeklokt: "werk",
  rijden_gestart: "rijden",
  werk_gestart: "werk",
  pauze_gestart: "pauze",
  uitgeklokt: null,
};

const minuten = (vanIso: string, totIso: string) =>
  Math.max(0, Math.round((Date.parse(totIso) - Date.parse(vanIso)) / 60_000));

export function rijtijdStatus(
  events: readonly WerktijdEvent[],
  nu: string,
  /** Rijtijd eerder deze week (vóór vandaag), in minuten. */
  weekEerderMinuten = 0
): RijtijdStatus {
  const gesorteerd = [...events].sort((a, b) => a.tijdstip.localeCompare(b.tijdstip));

  let dagRij = 0;
  let blok = 0;
  for (let i = 0; i < gesorteerd.length; i++) {
    const toestand = TOESTAND_NA[gesorteerd[i].type];
    const tot = i + 1 < gesorteerd.length ? gesorteerd[i + 1].tijdstip : nu;
    const duur = minuten(gesorteerd[i].tijdstip, tot);
    if (toestand === "rijden") {
      dagRij += duur;
      blok += duur;
    } else if (
      (toestand === "pauze" || toestand === null) &&
      duur >= RIJTIJD_REGELS.pauzeNaBlokMinuten
    ) {
      blok = 0; // volwaardige pauze of rust: het rijblok begint opnieuw
    }
    // "werk" onderbreekt het rijden maar telt niet als pauze: blok blijft staan.
  }

  const weekRij = weekEerderMinuten + dagRij;
  return {
    dagRijMinuten: dagRij,
    dagResterendMinuten: Math.max(0, RIJTIJD_REGELS.maxDagRijMinuten - dagRij),
    blokRijMinuten: blok,
    blokResterendMinuten: Math.max(0, RIJTIJD_REGELS.blokRijMinuten - blok),
    weekRijMinuten: weekRij,
    weekResterendMinuten: Math.max(0, RIJTIJD_REGELS.maxWeekRijMinuten - weekRij),
    pauzeNodig: blok >= RIJTIJD_REGELS.blokRijMinuten,
  };
}

export interface InplanControle {
  kan: boolean;
  redenen: Array<"dagrijtijd" | "weekrijtijd">;
}

/** Kan deze chauffeur er nog `extraRijMinuten` bij hebben binnen de regels? */
export function kanInplannen(
  status: RijtijdStatus,
  extraRijMinuten: number
): InplanControle {
  const redenen: InplanControle["redenen"] = [];
  if (extraRijMinuten > status.dagResterendMinuten) redenen.push("dagrijtijd");
  if (extraRijMinuten > status.weekResterendMinuten) redenen.push("weekrijtijd");
  return { kan: redenen.length === 0, redenen };
}
