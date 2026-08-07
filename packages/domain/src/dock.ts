// Sharzi Dock: depot-events op zendingniveau, zelfde principe als de
// taak-event-log (§5.1): append-only, status en locatie zijn afgeleid.
// Cross-dock betekent meerdere legs; het depot registreert wat er fysiek
// met de zending gebeurt tussen aankomst en vertrek.

export type DockEventType =
  | "aangemeld"
  | "ingescand"
  | "verplaatst"
  | "uitgescand"
  | "schade_gemeld";

export interface DockEvent {
  id: string;
  tenantId: string;
  zendingId: string;
  type: DockEventType;
  /** Vak of dok op het depot, bijv. "A2" of "dok 6". */
  locatie?: string;
  tijdstip: string;
  wie: string;
  apparaat: string;
}

export type DockStatus = "verwacht" | "op_depot" | "schade" | "uitgeleverd";

const STATUS_VAN_DOCK_EVENT: Record<DockEventType, DockStatus> = {
  aangemeld: "verwacht",
  ingescand: "op_depot",
  verplaatst: "op_depot",
  uitgescand: "uitgeleverd",
  schade_gemeld: "schade",
};

export function dockStatus(events: readonly DockEvent[]): DockStatus {
  if (events.length === 0) return "verwacht";
  return STATUS_VAN_DOCK_EVENT[events[events.length - 1].type];
}

/** Laatst bekende locatie op het depot, of null als de zending er niet (meer) staat. */
export function dockLocatie(events: readonly DockEvent[]): string | null {
  const status = dockStatus(events);
  if (status === "verwacht" || status === "uitgeleverd") return null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].locatie) return events[i].locatie ?? null;
  }
  return null;
}
