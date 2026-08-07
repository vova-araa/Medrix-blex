// De event-log is append-only (CLAUDE.md §5.1). Statussen zijn altijd afgeleid
// uit events en worden nergens als primair veld opgeslagen.

export type TaakEventType =
  | "taak_aangemaakt"
  | "vertrokken"
  | "aangekomen"
  | "geladen"
  | "gelost"
  | "probleem_gemeld";

export interface TaakEvent {
  id: string;
  tenantId: string;
  taakId: string;
  type: TaakEventType;
  tijdstip: string;
  wie: string;
  apparaat: string;
}

export type TaakStatus =
  | "gepland"
  | "onderweg"
  | "bezig"
  | "afgerond"
  | "probleem";

const STATUS_VAN_EVENT: Record<TaakEventType, TaakStatus> = {
  taak_aangemaakt: "gepland",
  vertrokken: "onderweg",
  aangekomen: "bezig",
  geladen: "afgerond",
  gelost: "afgerond",
  probleem_gemeld: "probleem",
};

export function taakStatus(events: readonly TaakEvent[]): TaakStatus {
  if (events.length === 0) {
    throw new Error("Een taak zonder events bestaat niet: elke taak begint met taak_aangemaakt.");
  }
  return STATUS_VAN_EVENT[events[events.length - 1].type];
}

/** Voegt een event toe zonder de bestaande log te muteren. */
export function voegEventToe(
  events: readonly TaakEvent[],
  event: TaakEvent
): TaakEvent[] {
  return [...events, event];
}

export type RitStatus = "gepland" | "onderweg" | "afgerond" | "probleem";

export function ritStatus(taakStatussen: readonly TaakStatus[]): RitStatus {
  if (taakStatussen.length === 0) return "gepland";
  if (taakStatussen.includes("probleem")) return "probleem";
  if (taakStatussen.every((s) => s === "afgerond")) return "afgerond";
  if (taakStatussen.some((s) => s !== "gepland")) return "onderweg";
  return "gepland";
}
