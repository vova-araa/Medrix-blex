import { describe, expect, it } from "vitest";
import { laadlijsten, type DockEvent, type DockEventType } from "../src/dock";

let teller = 0;
const ev = (zendingId: string, type: DockEventType, locatie?: string): DockEvent => ({
  id: `D-${++teller}`, tenantId: "blex", zendingId, type, locatie,
  tijdstip: `2026-08-07T0${teller % 9}:00:00Z`, wie: "F. Janssen", apparaat: "dock-scanner",
});

const rit = (id: string, chauffeur: string, kenteken: string) =>
  ({ id, chauffeur, voertuig: { kentekenGenormaliseerd: kenteken } });

const zending = (id: string, lm = 2) =>
  ({ id, barcode: id, omschrijving: `lading ${id}`, laadmeters: lm });

function bouw(
  perRit: Record<string, string[]>,
  events: Record<string, DockEvent[]>
) {
  return laadlijsten({
    ritten: Object.keys(perRit).map((id, i) => rit(id, `Chauffeur ${i + 1}`, `43BKL${i}`)),
    zendingenVanRit: (ritId) => (perRit[ritId] ?? []).map((z) => zending(z)),
    eventsVanZending: (zendingId) => events[zendingId] ?? [],
  });
}

describe("laadlijsten", () => {
  it("zet elke zending op de stand die uit de dock-events volgt", () => {
    const [lijst] = bouw({ R1: ["Z1", "Z2", "Z3", "Z4"] }, {
      Z1: [],
      Z2: [ev("Z2", "aangemeld"), ev("Z2", "ingescand", "A1")],
      Z3: [ev("Z3", "aangemeld"), ev("Z3", "ingescand", "A2"), ev("Z3", "uitgescand")],
      Z4: [ev("Z4", "aangemeld"), ev("Z4", "ingescand", "B1"), ev("Z4", "schade_gemeld", "Schadevak")],
    });
    expect(lijst.regels.map((r) => r.stand)).toEqual(["verwacht", "gereed", "geladen", "schade"]);
  });

  it("toont waar een zending op het depot staat", () => {
    const [lijst] = bouw({ R1: ["Z1"] }, {
      Z1: [ev("Z1", "ingescand", "A1"), ev("Z1", "verplaatst", "C2")],
    });
    expect(lijst.regels[0].locatie).toBe("C2");
  });

  it("laat de locatie leeg zodra de zending op de auto staat", () => {
    const [lijst] = bouw({ R1: ["Z1"] }, {
      Z1: [ev("Z1", "ingescand", "A1"), ev("Z1", "uitgescand")],
    });
    expect(lijst.regels[0].locatie).toBeNull();
  });

  it("telt geladen en openstaand", () => {
    const [lijst] = bouw({ R1: ["Z1", "Z2", "Z3"] }, {
      Z1: [ev("Z1", "ingescand", "A1"), ev("Z1", "uitgescand")],
      Z2: [ev("Z2", "ingescand", "A2"), ev("Z2", "uitgescand")],
      Z3: [ev("Z3", "ingescand", "A3")],
    });
    expect(lijst.geladen).toBe(2);
    expect(lijst.openstaand).toBe(1);
    expect(lijst.totaal).toBe(3);
    expect(lijst.gereedVoorVertrek).toBe(false);
  });

  it("is gereed voor vertrek als alles op de auto staat", () => {
    const [lijst] = bouw({ R1: ["Z1"] }, {
      Z1: [ev("Z1", "ingescand", "A1"), ev("Z1", "uitgescand")],
    });
    expect(lijst.gereedVoorVertrek).toBe(true);
  });

  it("noemt een lege rit niet gereed: er is niets te vertrekken", () => {
    const [lijst] = bouw({ R1: [] }, {});
    expect(lijst.totaal).toBe(0);
    expect(lijst.gereedVoorVertrek).toBe(false);
  });

  it("houdt schade openstaand, ook al ligt de zending op het depot", () => {
    const [lijst] = bouw({ R1: ["Z1"] }, {
      Z1: [ev("Z1", "ingescand", "A1"), ev("Z1", "schade_gemeld", "Schadevak")],
    });
    expect(lijst.openstaand).toBe(1);
    expect(lijst.gereedVoorVertrek).toBe(false);
  });

  it("houdt ritten strikt gescheiden", () => {
    const lijsten = bouw({ R1: ["Z1"], R2: ["Z2"] }, {
      Z1: [ev("Z1", "ingescand", "A1"), ev("Z1", "uitgescand")],
      Z2: [],
    });
    expect(lijsten.map((l) => l.gereedVoorVertrek)).toEqual([true, false]);
    expect(lijsten[1].regels.map((r) => r.zendingId)).toEqual(["Z2"]);
  });

  it("neemt chauffeur en kenteken over uit de rit", () => {
    const [lijst] = bouw({ R1: ["Z1"] }, { Z1: [] });
    expect(lijst.chauffeur).toBe("Chauffeur 1");
    expect(lijst.kentekenGenormaliseerd).toBe("43BKL0");
  });
});
