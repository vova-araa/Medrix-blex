// Route herordenen: de planner sleept stops in een andere volgorde. Dat is de
// meest gebruikte handeling op een planbord, en er zitten harde regels onder.
//
// Twee dingen mogen nooit gebeuren:
// 1. Een zending lossen vóórdat hij geladen is. Dat is fysiek onmogelijk en
//    zou een onuitvoerbare rit opleveren.
// 2. Een afgeronde stop verplaatsen. Wat gebeurd is, ligt vast in de
//    event-log (§5.1); de volgorde van het verleden verander je niet.

import type { Taak } from "./types";
import type { TaakStatus } from "./events";

export type VolgordeFout =
  | { soort: "lossen_voor_laden"; taakId: string; zendingId: string }
  | { soort: "afgeronde_stop_verplaatst"; taakId: string }
  | { soort: "afgeronde_na_open"; taakId: string };

export interface Herordening {
  taken: Taak[];
  fouten: VolgordeFout[];
  geldig: boolean;
}

/**
 * Controleert een voorgestelde volgorde. Geeft alle fouten terug, niet alleen
 * de eerste — een planner wil in één keer zien wat er mis is.
 */
export function controleerVolgorde(
  volgorde: readonly Taak[],
  statusVan: (taakId: string) => TaakStatus,
  oorspronkelijk: readonly Taak[]
): VolgordeFout[] {
  const fouten: VolgordeFout[] = [];
  const geladen = new Set<string>();
  let openGezien = false;

  const isAfgerond = (taak: Taak) => {
    const s = statusVan(taak.id);
    return s === "afgerond" || s === "vervallen";
  };

  volgorde.forEach((taak, index) => {
    // Een afgeronde stop mag niet van plek veranderen.
    if (isAfgerond(taak) && oorspronkelijk[index]?.id !== taak.id) {
      fouten.push({ soort: "afgeronde_stop_verplaatst", taakId: taak.id });
    }
    // Afgerond werk hoort vóór openstaand werk te staan.
    if (isAfgerond(taak) && openGezien) {
      fouten.push({ soort: "afgeronde_na_open", taakId: taak.id });
    }
    if (!isAfgerond(taak)) openGezien = true;

    if (taak.soort === "laden" && taak.zendingId) geladen.add(taak.zendingId);
    if (taak.soort === "lossen" && taak.zendingId) {
      // Een zending zonder laadstop op deze rit stond er al op: die telt mee.
      const heeftLaadstopOpRit = volgorde.some(
        (t) => t.soort === "laden" && t.zendingId === taak.zendingId
      );
      if (heeftLaadstopOpRit && !geladen.has(taak.zendingId)) {
        fouten.push({
          soort: "lossen_voor_laden", taakId: taak.id, zendingId: taak.zendingId,
        });
      }
    }
  });

  return fouten;
}

/**
 * Verplaatst één stop naar een andere positie en toetst het resultaat.
 * De taken zelf worden niet gemuteerd; er komt een nieuwe lijst terug.
 */
export function verplaatsStop(
  taken: readonly Taak[],
  taakId: string,
  richting: "omhoog" | "omlaag",
  statusVan: (taakId: string) => TaakStatus
): Herordening {
  const van = taken.findIndex((t) => t.id === taakId);
  const naar = richting === "omhoog" ? van - 1 : van + 1;
  if (van < 0 || naar < 0 || naar >= taken.length) {
    return { taken: [...taken], fouten: [], geldig: false };
  }
  const nieuw = [...taken];
  [nieuw[van], nieuw[naar]] = [nieuw[naar], nieuw[van]];

  const fouten = controleerVolgorde(nieuw, statusVan, taken);
  return { taken: nieuw, fouten, geldig: fouten.length === 0 };
}

export interface HertijdOpties {
  /** Wanneer de rit vanaf de eerste te herplannen stop verder loopt. */
  startIso: string;
  reistijdMinuten: (van: string, naar: string) => number;
  /**
   * Handelingstijd per stop; standaard 30 minuten. Geeft undefined terug als
   * er geen meting voor die plaats is — dan geldt de standaard.
   */
  handelingstijdMinuten?: (plaats: string) => number | undefined;
}

/**
 * Herberekent de geplande tijden na een herordening. Afgeronde stops houden
 * hun tijden — die zijn geen planning meer maar geschiedenis.
 */
export function hertijden(
  taken: readonly Taak[],
  statusVan: (taakId: string) => TaakStatus,
  opties: HertijdOpties
): Taak[] {
  const standaard = 30;
  const handeling = (plaats: string) =>
    opties.handelingstijdMinuten?.(plaats) ?? standaard;

  let klokMs = Date.parse(opties.startIso);
  let vorigePlaats: string | null = null;

  return taken.map((taak) => {
    const status = statusVan(taak.id);
    if (status === "afgerond" || status === "vervallen") {
      vorigePlaats = taak.adres.plaats;
      // Loopt de klok achter op wat al gebeurd is, dan schuift hij mee.
      klokMs = Math.max(klokMs, Date.parse(taak.geplandTot));
      return taak;
    }
    const reis = vorigePlaats
      ? opties.reistijdMinuten(vorigePlaats, taak.adres.plaats)
      : 0;
    const vanMs = klokMs + reis * 60_000;
    const duur = handeling(taak.adres.plaats);
    const totMs = vanMs + duur * 60_000;
    klokMs = totMs;
    vorigePlaats = taak.adres.plaats;
    return {
      ...taak,
      geplandVan: new Date(vanMs).toISOString(),
      geplandTot: new Date(totMs).toISOString(),
    };
  });
}
