// Automatische planner: verdeelt openstaande vervoersopdrachten over
// chauffeurs met een greedy-insertion-heuristiek. Harde restricties:
// laadmetercapaciteit, tijdvensters, en de rij- en rusttijden (EU 561/2006)
// inclusief het incalculeren van de verplichte 45-minutenpauze.
//
// De planner doet VOORSTELLEN met een motivatie per regel; de menselijke
// planner accepteert of grijpt in. Wat niet past komt terug als
// "onplanbaar" met redenen — nooit stilzwijgend weggelaten.
//
// Reistijd is een geïnjecteerde functie zodat dit domein puur en testbaar
// blijft (de app voert de kaart-/verkeersschatting aan).

import { RIJTIJD_REGELS, type RijtijdStatus } from "./rijtijden";

export interface PlanOpdracht {
  id: string;
  laadmeters: number;
  vanPlaats: string;
  naarPlaats: string;
  vensterVan?: string;
  vensterTot?: string;
}

export interface PlanKandidaat {
  ritId: string;
  chauffeur: string;
  huidigePlaats: string;
  beschikbaarVanafIso: string;
  resterendeLaadmeters: number;
  rijtijd: RijtijdStatus;
}

export interface PlanOpties {
  nuIso: string;
  reistijdMinuten: (van: string, naar: string) => number;
  /** Vaste handelingstijd per laad-/losstop, in minuten. */
  laadLosMinuten?: number;
  /**
   * Geleerde handelingstijd per plaats (uit de event-log), in minuten.
   * Wint van laadLosMinuten; geef undefined terug als er geen metingen zijn.
   */
  laadLosMinutenVoorPlaats?: (plaats: string) => number | undefined;
}

export type OnplanbaarReden =
  | "capaciteit"
  | "dagrijtijd"
  | "weekrijtijd"
  | "venster"
  | "geen_chauffeurs";

export interface PlanVoorstel {
  opdrachtId: string;
  ritId: string;
  chauffeur: string;
  vertrekIso: string;
  aankomstIso: string;
  extraRijMinuten: number;
  pauzeIngepland: boolean;
  motivatie: string[];
}

export interface PlanResultaat {
  voorstellen: PlanVoorstel[];
  onplanbaar: Array<{ opdrachtId: string; redenen: OnplanbaarReden[] }>;
}

interface KandidaatStand {
  bron: PlanKandidaat;
  plaats: string;
  beschikbaarMs: number;
  restLm: number;
  dagResterend: number;
  blokResterend: number;
  weekResterend: number;
}

interface Passing {
  stand: KandidaatStand;
  extraRij: number;
  vertrekMs: number;
  aankomstMs: number;
  pauze: boolean;
  score: number;
}

export function automatischPlan(
  opdrachten: readonly PlanOpdracht[],
  kandidaten: readonly PlanKandidaat[],
  opties: PlanOpties
): PlanResultaat {
  const standaardLaadLos = opties.laadLosMinuten ?? 30;
  const handelMs = (plaats: string) =>
    (opties.laadLosMinutenVoorPlaats?.(plaats) ?? standaardLaadLos) * 60_000;
  const nuMs = Date.parse(opties.nuIso);

  const standen: KandidaatStand[] = kandidaten.map((k) => ({
    bron: k,
    plaats: k.huidigePlaats,
    beschikbaarMs: Math.max(nuMs, Date.parse(k.beschikbaarVanafIso)),
    restLm: k.resterendeLaadmeters,
    dagResterend: k.rijtijd.dagResterendMinuten,
    blokResterend: k.rijtijd.blokResterendMinuten,
    weekResterend: k.rijtijd.weekResterendMinuten,
  }));

  const voorstellen: PlanVoorstel[] = [];
  const onplanbaar: PlanResultaat["onplanbaar"] = [];

  // Urgentste vensters eerst: wat het krapst zit, krijgt eerste keus.
  const volgorde = [...opdrachten].sort((a, b) =>
    (a.vensterTot ?? "9999").localeCompare(b.vensterTot ?? "9999")
  );

  for (const opdracht of volgorde) {
    if (standen.length === 0) {
      onplanbaar.push({ opdrachtId: opdracht.id, redenen: ["geen_chauffeurs"] });
      continue;
    }

    const redenen = new Set<OnplanbaarReden>();
    let beste: Passing | null = null;

    for (const stand of standen) {
      if (opdracht.laadmeters > stand.restLm) {
        redenen.add("capaciteit");
        continue;
      }

      const aanrij = opties.reistijdMinuten(stand.plaats, opdracht.vanPlaats);
      const beladen = opties.reistijdMinuten(opdracht.vanPlaats, opdracht.naarPlaats);
      const extraRij = aanrij + beladen;

      if (extraRij > stand.dagResterend) { redenen.add("dagrijtijd"); continue; }
      if (extraRij > stand.weekResterend) { redenen.add("weekrijtijd"); continue; }

      // Verplichte pauze incalculeren als het rijblok vol raakt (§561/2006).
      const pauze = extraRij > stand.blokResterend;
      const pauzeMs = pauze ? RIJTIJD_REGELS.pauzeNaBlokMinuten * 60_000 : 0;

      const vertrekMs = stand.beschikbaarMs;
      const aankomstLaadMs = vertrekMs + aanrij * 60_000 + pauzeMs;
      let aankomstMs = aankomstLaadMs + handelMs(opdracht.vanPlaats) + beladen * 60_000;
      if (opdracht.vensterVan) {
        const vroegst = Date.parse(opdracht.vensterVan);
        if (aankomstMs < vroegst) aankomstMs = vroegst; // wachten tot het venster opent
      }
      if (opdracht.vensterTot && aankomstMs > Date.parse(opdracht.vensterTot)) {
        redenen.add("venster");
        continue;
      }

      // Score: minste extra rijtijd wint; wie bijna aan zijn grens zit,
      // krijgt een straf zodat de werkdruk in balans blijft.
      const bijnaOpStraf = stand.dagResterend - extraRij < 60 ? 90 : 0;
      const score = extraRij + bijnaOpStraf;
      if (!beste || score < beste.score) {
        beste = { stand, extraRij, vertrekMs, aankomstMs, pauze, score };
      }
    }

    if (!beste) {
      onplanbaar.push({
        opdrachtId: opdracht.id,
        redenen: redenen.size ? [...redenen] : ["geen_chauffeurs"],
      });
      continue;
    }

    // Kandidaat bijwerken zodat het volgende voorstel op de nieuwe stand rekent.
    const stand = beste.stand;
    stand.plaats = opdracht.naarPlaats;
    stand.beschikbaarMs = beste.aankomstMs + handelMs(opdracht.naarPlaats);
    stand.restLm = Math.round((stand.restLm - opdracht.laadmeters) * 10) / 10;
    stand.dagResterend -= beste.extraRij;
    stand.weekResterend -= beste.extraRij;
    stand.blokResterend = beste.pauze
      ? RIJTIJD_REGELS.blokRijMinuten - beste.extraRij
      : stand.blokResterend - beste.extraRij;

    voorstellen.push({
      opdrachtId: opdracht.id,
      ritId: stand.bron.ritId,
      chauffeur: stand.bron.chauffeur,
      vertrekIso: new Date(beste.vertrekMs).toISOString(),
      aankomstIso: new Date(beste.aankomstMs).toISOString(),
      extraRijMinuten: beste.extraRij,
      pauzeIngepland: beste.pauze,
      motivatie: [
        `dichtstbij: +${beste.extraRij} min rijtijd`,
        `rijtijd na inplannen: ${stand.dagResterend} min dag / ${Math.round(stand.weekResterend / 60)} u week over`,
        ...(beste.pauze ? ["verplichte pauze van 45 min ingecalculeerd"] : []),
        ...geleerdeTijden(opties, opdracht),
      ],
    });
  }

  return { voorstellen, onplanbaar };
}

function geleerdeTijden(opties: PlanOpties, opdracht: PlanOpdracht): string[] {
  const regels: string[] = [];
  if (!opties.laadLosMinutenVoorPlaats) return regels;
  const laad = opties.laadLosMinutenVoorPlaats(opdracht.vanPlaats);
  const los = opties.laadLosMinutenVoorPlaats(opdracht.naarPlaats);
  if (laad !== undefined) regels.push(`geleerde laadtijd ${opdracht.vanPlaats}: ${laad} min`);
  if (los !== undefined) regels.push(`geleerde lostijd ${opdracht.naarPlaats}: ${los} min`);
  return regels;
}
