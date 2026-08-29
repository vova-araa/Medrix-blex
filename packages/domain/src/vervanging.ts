// Vervanging bij uitval: valt een chauffeur weg, dan rekent Sharzi door welke
// collega's de rit kunnen overnemen binnen de rij- en rusttijden — en wat dat
// hen kost. Het resultaat is een gerangschikte lijst met onderbouwing; de
// planner beslist. Chauffeurs die het niet mogen rijden komen terug mét reden,
// nooit stilzwijgend weggelaten (zelfde principe als de autoplanner).

import { kanInplannen, RIJTIJD_REGELS, type InplanReden, type RijtijdStatus } from "./rijtijden";

export interface UitgevallenRit {
  ritId: string;
  chauffeur: string;
  /** Waar de rit opgepakt moet worden. */
  startPlaats: string;
  /** Rijtijd van de resterende rit zelf, exclusief aanrijden. */
  resterendeRijMinuten: number;
  /** Uiterste aankomsttijd van de eerstvolgende stop, indien afgesproken. */
  vensterTotIso?: string;
  laadmeters: number;
}

export interface VervangKandidaat {
  chauffeur: string;
  ritId: string;
  huidigePlaats: string;
  beschikbaarVanafIso: string;
  resterendeLaadmeters: number;
  rijtijd: RijtijdStatus;
  /** Heeft deze chauffeur vandaag al een eigen rit? Dan wordt het extra werk. */
  heeftEigenRit: boolean;
}

export type AfwijzingReden = InplanReden | "capaciteit" | "venster";

export interface VervangVoorstel {
  chauffeur: string;
  ritId: string;
  /** "vervanging" = neemt de rit over; "extra" = rijdt hem naast zijn eigen werk. */
  soort: "vervanging" | "extra";
  aanrijMinuten: number;
  totaalExtraRijMinuten: number;
  aankomstIso: string;
  /** Past alleen als de planner de rijdag naar 10 uur verlengt. */
  vereistVerlenging: boolean;
  /** Er moet een pauze van 45 minuten in gepland worden. */
  vereistPauze: boolean;
  /** Het afgesproken venster was al verstreken toen de uitval werd gemeld. */
  vensterAlVerstreken: boolean;
  /** Lager is beter; alleen bedoeld voor de rangschikking. */
  score: number;
  motivatie: string[];
  /** Waar de chauffeur na deze rit staat qua grenzen. */
  restRuimte: { dagMinuten: number; weekMinuten: number };
}

export interface VervangResultaat {
  voorstellen: VervangVoorstel[];
  afgewezen: Array<{ chauffeur: string; redenen: AfwijzingReden[] }>;
}

export interface VervangOpties {
  nuIso: string;
  reistijdMinuten: (van: string, naar: string) => number;
}

const uren = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, "0")}`;

/**
 * Zoekt vervangers voor een uitgevallen rit. Weegt reistijd naar de startplaats,
 * de resterende rijtijdruimte en de werkdrukbalans; een chauffeur die alleen
 * met een verlenging naar 10 uur past krijgt een straf, zodat een collega die
 * het binnen de normale 9 uur redt altijd bovenaan komt.
 */
export function zoekVervanging(
  rit: UitgevallenRit,
  kandidaten: readonly VervangKandidaat[],
  opties: VervangOpties
): VervangResultaat {
  const nuMs = Date.parse(opties.nuIso);
  const voorstellen: VervangVoorstel[] = [];
  const afgewezen: VervangResultaat["afgewezen"] = [];

  for (const kandidaat of kandidaten) {
    if (kandidaat.chauffeur === rit.chauffeur) continue;
    const redenen: AfwijzingReden[] = [];

    // Laadruimte telt alleen als de chauffeur dit náást zijn eigen rit doet:
    // een vervanger die het voertuig overneemt, rijdt de lading mee die er al
    // op staat en hoeft daar geen eigen capaciteit voor te hebben.
    if (kandidaat.heeftEigenRit && rit.laadmeters > kandidaat.resterendeLaadmeters) {
      redenen.push("capaciteit");
    }

    const aanrij = opties.reistijdMinuten(kandidaat.huidigePlaats, rit.startPlaats);
    const extraRij = aanrij + rit.resterendeRijMinuten;
    const controle = kanInplannen(kandidaat.rijtijd, extraRij);
    redenen.push(...controle.redenen);

    const vertrekMs = Math.max(nuMs, Date.parse(kandidaat.beschikbaarVanafIso));
    const pauzeMs = controle.vereistPauze ? RIJTIJD_REGELS.pauzeNaBlokMinuten * 60_000 : 0;
    const aankomstMs = vertrekMs + extraRij * 60_000 + pauzeMs;
    // Een venster dat nú al verstreken is, haalt niemand meer — dat is geen
    // reden om iedereen af te wijzen. Dan telt juist wie er het snelst staat.
    const vensterMs = rit.vensterTotIso ? Date.parse(rit.vensterTotIso) : null;
    const vensterAlVerstreken = vensterMs !== null && vensterMs <= nuMs;
    if (vensterMs !== null && !vensterAlVerstreken && aankomstMs > vensterMs) {
      redenen.push("venster");
    }

    if (redenen.length > 0) {
      afgewezen.push({ chauffeur: kandidaat.chauffeur, redenen: [...new Set(redenen)] });
      continue;
    }

    // Score: dichtstbij wint. Straffen voor een verlenging (mag, maar liever
    // niet), voor een pauze die erin moet, en voor wie al krap in zijn week zit.
    const dagNa = kandidaat.rijtijd.dagResterendMinuten - extraRij;
    const weekNa = kandidaat.rijtijd.weekResterendMinuten - extraRij;
    const straffen =
      (controle.vereistVerlenging ? 240 : 0) +
      (controle.vereistPauze ? 45 : 0) +
      (dagNa < 60 ? 60 : 0) +
      (weekNa < 4 * 60 ? 90 : 0) +
      (kandidaat.heeftEigenRit ? 30 : 0);

    const motivatie = [
      `${aanrij} min aanrijden vanaf ${kandidaat.huidigePlaats}, daarna ${uren(rit.resterendeRijMinuten)} rit`,
      `na afloop nog ${uren(Math.max(0, dagNa))} dagrijtijd en ${uren(Math.max(0, weekNa))} weekrijtijd over`,
    ];
    if (controle.vereistVerlenging) {
      motivatie.push(
        `alleen haalbaar met een verlengde rijdag van 10 uur — deze week nog ${kandidaat.rijtijd.verlengingenOver} van de ${RIJTIJD_REGELS.maxVerlengingenPerWeek} beschikbaar`
      );
    }
    if (controle.vereistPauze) {
      motivatie.push(`${RIJTIJD_REGELS.pauzeNaBlokMinuten} min pauze ingecalculeerd (rijblok vol)`);
    }
    if (vensterAlVerstreken) {
      motivatie.push("het afgesproken venster is al verstreken — dit is de snelst haalbare aankomst");
    }
    if (kandidaat.heeftEigenRit) {
      motivatie.push("rijdt dit naast zijn eigen rit van vandaag");
    }

    voorstellen.push({
      chauffeur: kandidaat.chauffeur,
      ritId: kandidaat.ritId,
      soort: kandidaat.heeftEigenRit ? "extra" : "vervanging",
      aanrijMinuten: aanrij,
      totaalExtraRijMinuten: extraRij,
      aankomstIso: new Date(aankomstMs).toISOString(),
      vereistVerlenging: controle.vereistVerlenging,
      vereistPauze: controle.vereistPauze,
      vensterAlVerstreken,
      score: extraRij + straffen,
      motivatie,
      restRuimte: { dagMinuten: Math.max(0, dagNa), weekMinuten: Math.max(0, weekNa) },
    });
  }

  voorstellen.sort((a, b) => a.score - b.score || a.chauffeur.localeCompare(b.chauffeur));
  return { voorstellen, afgewezen };
}
