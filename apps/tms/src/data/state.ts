import {
  ritStatus,
  taakStatus,
  voegEventToe,
  type Rit,
  type RitStatus,
  type Taak,
  type TaakEvent,
  type TaakStatus,
  type Zending,
} from "@sharzi/domain";
import type { DagSnapshot } from "./bron";

export interface AppState extends DagSnapshot {
  offline: boolean;
  outbox: number;
}

export type Actie =
  | { type: "dag_geladen"; snapshot: DagSnapshot }
  | { type: "plan_zending"; zendingId: string; taak: Taak; event: TaakEvent }
  | { type: "registreer"; event: TaakEvent }
  | { type: "zet_offline"; offline: boolean };

export const leegState: AppState = {
  ritten: [], taken: [], events: [], zendingen: {}, ongepland: [],
  offline: false, outbox: 0,
};

export function reducer(state: AppState, actie: Actie): AppState {
  switch (actie.type) {
    case "dag_geladen":
      return { ...state, ...actie.snapshot };
    case "plan_zending":
      return {
        ...state,
        taken: [...state.taken, actie.taak],
        events: voegEventToe(state.events, actie.event),
        ongepland: state.ongepland.filter((id) => id !== actie.zendingId),
      };
    case "registreer":
      return {
        ...state,
        events: voegEventToe(state.events, actie.event),
        outbox: state.offline ? state.outbox + 1 : state.outbox,
      };
    case "zet_offline":
      return { ...state, offline: actie.offline, outbox: actie.offline ? state.outbox : 0 };
  }
}

// ── Selectors: alles afgeleid, niets dubbel opgeslagen ──────────────────────

export function takenVanRit(state: AppState, ritId: string): Taak[] {
  return state.taken
    .filter((t) => t.ritId === ritId)
    .sort((a, b) => a.geplandVan.localeCompare(b.geplandVan));
}

export function eventsVanTaak(state: AppState, taakId: string): TaakEvent[] {
  return state.events.filter((e) => e.taakId === taakId);
}

export function statusVanTaak(state: AppState, taakId: string): TaakStatus {
  return taakStatus(eventsVanTaak(state, taakId));
}

export function statusVanRit(state: AppState, ritId: string): RitStatus {
  return ritStatus(takenVanRit(state, ritId).map((t) => statusVanTaak(state, t.id)));
}

export function gebruikteLaadmeters(state: AppState, ritId: string): number {
  const zendingIds = new Set(
    takenVanRit(state, ritId).flatMap((t) => (t.zendingId ? [t.zendingId] : []))
  );
  let som = 0;
  for (const id of zendingIds) som += state.zendingen[id]?.laadmeters ?? 0;
  return Math.round(som * 10) / 10;
}

export function huidigeTaak(state: AppState, ritId: string): Taak | undefined {
  return takenVanRit(state, ritId).find((t) => statusVanTaak(state, t.id) !== "afgerond");
}

export function ritVanChauffeur(state: AppState, chauffeur: string): Rit | undefined {
  return state.ritten.find((r) => r.chauffeur === chauffeur);
}

export function zendingVan(state: AppState, taak: Taak): Zending | undefined {
  return taak.zendingId ? state.zendingen[taak.zendingId] : undefined;
}
