// Continue heroptimalisatie: loopt een rit vast (probleem gemeld of het
// tijdvenster wordt gemist), dan zoekt de herstel-lus voor elke zending op
// die rit die nog volledig op "gepland" staat een andere rit via de
// autoplanner. Uitvoeren gebeurt in de app: vervallen-events op de oude
// taken (de log blijft append-only) plus nieuwe taken op de doelrit.

import { automatischPlan, type PlanOpdracht, type PlanVoorstel, type Taak } from "@sharzi/domain";
import { ritEta } from "../kaart/simulatie";
import { planKandidaten, planOpties } from "./planner";
import { statusVanRit, statusVanTaak, takenVanRit, type AppState } from "./state";

export type HerstelReden = "probleem" | "venster";

export interface HerstelVoorstel {
  /** De vastgelopen rit waar de zending nu op staat. */
  ritId: string;
  chauffeur: string;
  zendingId: string;
  /** Taken die vervallen zodra het voorstel wordt uitgevoerd. */
  taakIds: string[];
  reden: HerstelReden;
  /** Doelrit, tijden en motivatie uit de autoplanner. */
  voorstel: PlanVoorstel;
}

export function herstelVoorstellen(state: AppState, nu: string): HerstelVoorstel[] {
  const resultaten: HerstelVoorstel[] = [];

  for (const rit of state.ritten) {
    if (!rit.chauffeur) continue;
    const status = statusVanRit(state, rit.id);
    const eta = ritEta(state, rit.id, nu);
    const reden: HerstelReden | null =
      status === "probleem" ? "probleem" : eta?.naVenster ? "venster" : null;
    if (!reden) continue;

    for (const [zendingId, taken] of zendingenOpRit(state, rit.id)) {
      // Alleen zendingen waar nog niets voor gebeurd is, zijn verplaatsbaar.
      if (!taken.every((taak) => statusVanTaak(state, taak.id) === "gepland")) continue;
      const zending = state.zendingen[zendingId];
      if (!zending) continue;

      const opdracht: PlanOpdracht = {
        id: zendingId,
        laadmeters: zending.laadmeters,
        vanPlaats: zending.van.plaats,
        naarPlaats: zending.naar.plaats,
        vensterVan: zending.naar.tijdvenster?.van,
        vensterTot: zending.naar.tijdvenster?.tot,
      };
      const resultaat = automatischPlan(
        [opdracht],
        planKandidaten(state, nu, rit.id),
        planOpties(state, nu)
      );
      const voorstel = resultaat.voorstellen[0];
      if (!voorstel) continue;

      resultaten.push({
        ritId: rit.id,
        chauffeur: rit.chauffeur,
        zendingId,
        taakIds: taken.map((taak) => taak.id),
        reden,
        voorstel,
      });
    }
  }

  return resultaten;
}

function zendingenOpRit(state: AppState, ritId: string): Map<string, Taak[]> {
  const perZending = new Map<string, Taak[]>();
  for (const taak of takenVanRit(state, ritId)) {
    if (!taak.zendingId) continue;
    const lijst = perZending.get(taak.zendingId) ?? [];
    lijst.push(taak);
    perZending.set(taak.zendingId, lijst);
  }
  return perZending;
}
