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

// ── Laadlijst ───────────────────────────────────────────────────────────────
//
// Het cross-dock werk is niet "scan wat je ziet" maar "krijg deze auto vol en
// op tijd weg". De laadlijst zet daarom de zendingen per uitgaande rit, met
// wat er nog moet gebeuren.

export type LaadRegelStand =
  /** Nog niet op het depot binnen. */
  | "verwacht"
  /** Op het depot, klaar om geladen te worden. */
  | "gereed"
  /** Uitgescand: staat op de auto. */
  | "geladen"
  /** Schade gemeld — laden pas na overleg. */
  | "schade";

export interface LaadRegel {
  zendingId: string;
  barcode: string;
  omschrijving: string;
  laadmeters: number;
  locatie: string | null;
  stand: LaadRegelStand;
}

export interface Laadlijst {
  ritId: string;
  chauffeur: string;
  kentekenGenormaliseerd: string;
  regels: LaadRegel[];
  /** Aantal zendingen dat al op de auto staat. */
  geladen: number;
  totaal: number;
  /** Blokkeert vertrek: schade of nog niet binnen. */
  openstaand: number;
  gereedVoorVertrek: boolean;
}

const STAND_VAN_STATUS: Record<DockStatus, LaadRegelStand> = {
  verwacht: "verwacht",
  op_depot: "gereed",
  schade: "schade",
  uitgeleverd: "geladen",
};

/**
 * Laadlijsten per uitgaande rit. `eventsVanZending` levert de dock-events van
 * één zending; de status en de locatie worden daaruit afgeleid, nooit apart
 * opgeslagen.
 */
export function laadlijsten(invoer: {
  ritten: readonly {
    id: string;
    chauffeur: string;
    voertuig: { kentekenGenormaliseerd: string };
  }[];
  /** Zendingen per rit, in laadvolgorde. */
  zendingenVanRit: (ritId: string) => readonly {
    id: string;
    barcode: string;
    omschrijving: string;
    laadmeters: number;
  }[];
  eventsVanZending: (zendingId: string) => readonly DockEvent[];
}): Laadlijst[] {
  return invoer.ritten.map((rit) => {
    const regels: LaadRegel[] = invoer.zendingenVanRit(rit.id).map((zending) => {
      const events = invoer.eventsVanZending(zending.id);
      return {
        zendingId: zending.id,
        barcode: zending.barcode,
        omschrijving: zending.omschrijving,
        laadmeters: zending.laadmeters,
        locatie: dockLocatie(events),
        stand: STAND_VAN_STATUS[dockStatus(events)],
      };
    });

    const geladen = regels.filter((r) => r.stand === "geladen").length;
    const openstaand = regels.filter((r) => r.stand !== "geladen").length;
    return {
      ritId: rit.id,
      chauffeur: rit.chauffeur,
      kentekenGenormaliseerd: rit.voertuig.kentekenGenormaliseerd,
      regels,
      geladen,
      totaal: regels.length,
      openstaand,
      // Een lege rit is niet "gereed" maar leeg; dat is geen vertrekmoment.
      gereedVoorVertrek: regels.length > 0 && openstaand === 0,
    };
  });
}
