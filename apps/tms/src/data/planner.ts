// Gedeelde bouwstenen voor de autoplanner en de herstel-lus: de actuele
// kandidaatstand per rit (plaats, beschikbaarheid, restcapaciteit, rijtijd)
// en de planopties met reistijd- en geleerde-handelingstijdfuncties.

import type { PlanKandidaat, PlanOpties } from "@sharzi/domain";
import { geschatteRijMinuten } from "../kaart/simulatie";
import { leertijdVoorPlaats } from "./leertijden";
import {
  actieveTakenVanRit,
  gebruikteLaadmeters,
  rijtijdVan,
  type AppState,
} from "./state";

export function planKandidaten(
  state: AppState,
  nu: string,
  behalveRitId?: string
): PlanKandidaat[] {
  const nuMs = Date.parse(nu);
  return state.ritten
    .filter((rit) => rit.chauffeur && rit.id !== behalveRitId)
    .map((rit) => {
      const actief = actieveTakenVanRit(state, rit.id);
      const laatste = actief.at(-1);
      return {
        ritId: rit.id,
        chauffeur: rit.chauffeur,
        huidigePlaats: laatste?.adres.plaats ?? "Venlo",
        beschikbaarVanafIso: laatste
          ? new Date(Math.max(Date.parse(laatste.geplandTot), nuMs)).toISOString()
          : nu,
        resterendeLaadmeters:
          Math.round((rit.voertuig.capaciteitLaadmeters - gebruikteLaadmeters(state, rit.id)) * 10) / 10,
        rijtijd: rijtijdVan(state, rit.chauffeur, nu),
      };
    });
}

export function planOpties(state: AppState, nu: string): PlanOpties {
  return {
    nuIso: nu,
    reistijdMinuten: geschatteRijMinuten,
    laadLosMinutenVoorPlaats: leertijdVoorPlaats(state),
  };
}
