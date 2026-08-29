// Schaduwdraaien: onze berekende rij- en rusttijden naast de cijfers van het
// bestaande pakket (Roadsoft) leggen. Zolang die twee naast elkaar draaien
// blijft het bestaande pakket leidend; deze vergelijking is het bewijs dat
// Sharzi klopt vóórdat er iets verandert.
//
// Zie directives/tacho_overgang_actielijst.md, fase 3.

import type { RijtijdStatus } from "./rijtijden";

export const VERGELIJK_DREMPELS = {
  /** Afwijking op dag- en weektotalen die nog acceptabel is, in minuten. */
  minutenDrempel: 5,
} as const;

/** Referentiecijfers zoals het bestaande pakket ze rapporteert. */
export interface Referentie {
  chauffeur: string;
  datum: string;
  dagRijMinuten: number;
  weekRijMinuten: number;
  /** Codes van overtredingen die het referentiepakket meldt. */
  overtredingen: string[];
  bron: string;
}

export type VerschilSoort = "dagrijtijd" | "weekrijtijd" | "overtreding_gemist" | "overtreding_extra";

export interface Verschil {
  soort: VerschilSoort;
  /** Blokkerend = mag niet doorgaan naar een overstap. */
  blokkerend: boolean;
  omschrijving: string;
  sharzi: string;
  referentie: string;
}

export interface VergelijkResultaat {
  chauffeur: string;
  datum: string;
  verschillen: Verschil[];
  /** Geen verschillen boven de drempel en geen verschil in overtredingen. */
  akkoord: boolean;
}

const uren = (m: number) => `${Math.floor(m / 60)}:${String(Math.abs(Math.round(m)) % 60).padStart(2, "0")}`;

/**
 * Vergelijkt één chauffeurdag. Een verschil in overtredingen is altijd
 * blokkerend: dan zijn de systemen het oneens over naleving, en dat is precies
 * wat je niet wilt ontdekken bij een controle. Een tijdsverschil binnen de
 * drempel wordt wel gemeld maar blokkeert niet.
 */
export function vergelijk(
  status: RijtijdStatus,
  referentie: Referentie
): VergelijkResultaat {
  const verschillen: Verschil[] = [];

  const dagVerschil = status.dagRijMinuten - referentie.dagRijMinuten;
  if (Math.abs(dagVerschil) > 0) {
    verschillen.push({
      soort: "dagrijtijd",
      blokkerend: Math.abs(dagVerschil) > VERGELIJK_DREMPELS.minutenDrempel,
      omschrijving: `Dagrijtijd wijkt ${Math.abs(dagVerschil)} min af`,
      sharzi: uren(status.dagRijMinuten),
      referentie: uren(referentie.dagRijMinuten),
    });
  }

  const weekVerschil = status.weekRijMinuten - referentie.weekRijMinuten;
  if (Math.abs(weekVerschil) > 0) {
    verschillen.push({
      soort: "weekrijtijd",
      blokkerend: Math.abs(weekVerschil) > VERGELIJK_DREMPELS.minutenDrempel,
      omschrijving: `Weekrijtijd wijkt ${Math.abs(weekVerschil)} min af`,
      sharzi: uren(status.weekRijMinuten),
      referentie: uren(referentie.weekRijMinuten),
    });
  }

  // Codes uit een extern pakket zijn vrije tekst, niet onze eigen union.
  const onze = new Set<string>(
    status.overtredingen.filter((o) => o.ernst === "overtreding").map((o) => o.code)
  );
  const hunne = new Set<string>(referentie.overtredingen);

  for (const code of hunne) {
    if (!onze.has(code)) {
      verschillen.push({
        soort: "overtreding_gemist",
        blokkerend: true,
        omschrijving: `${referentie.bron} meldt "${code}", Sharzi niet`,
        sharzi: "geen melding",
        referentie: code,
      });
    }
  }
  for (const code of onze) {
    if (!hunne.has(code)) {
      verschillen.push({
        soort: "overtreding_extra",
        blokkerend: true,
        omschrijving: `Sharzi meldt "${code}", ${referentie.bron} niet`,
        sharzi: code,
        referentie: "geen melding",
      });
    }
  }

  return {
    chauffeur: referentie.chauffeur,
    datum: referentie.datum,
    verschillen,
    akkoord: verschillen.every((v) => !v.blokkerend),
  };
}

export interface VergelijkSamenvatting {
  totaal: number;
  akkoord: number;
  blokkerend: number;
  /** Klaar om te overwegen: alles akkoord én er is daadwerkelijk vergeleken. */
  gereedVoorOverstap: boolean;
}

export function vatSamen(resultaten: readonly VergelijkResultaat[]): VergelijkSamenvatting {
  const akkoord = resultaten.filter((r) => r.akkoord).length;
  const blokkerend = resultaten.reduce(
    (som, r) => som + r.verschillen.filter((v) => v.blokkerend).length, 0
  );
  return {
    totaal: resultaten.length,
    akkoord,
    blokkerend,
    gereedVoorOverstap: resultaten.length > 0 && blokkerend === 0,
  };
}
