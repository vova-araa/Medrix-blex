import { describe, expect, it } from "vitest";
import { dockLocatie, dockStatus, type DockEvent } from "../src/dock";

let teller = 0;
const ev = (
  type: DockEvent["type"],
  locatie?: string
): DockEvent => ({
  id: `D-${String(++teller).padStart(3, "0")}`,
  tenantId: "blex",
  zendingId: "SHZ-114-002",
  type,
  locatie,
  tijdstip: `2026-08-07T0${teller % 10}:00:00Z`,
  wie: "depot",
  apparaat: "dock-scanner",
});

describe("dockStatus", () => {
  it("volgt de keten verwacht → op depot → uitgeleverd", () => {
    const log: DockEvent[] = [ev("aangemeld")];
    expect(dockStatus(log)).toBe("verwacht");
    log.push(ev("ingescand", "A2"));
    expect(dockStatus(log)).toBe("op_depot");
    log.push(ev("uitgescand"));
    expect(dockStatus(log)).toBe("uitgeleverd");
  });

  it("schade zet de status op schade, hervatten kan met een nieuw event", () => {
    const log = [ev("aangemeld"), ev("ingescand", "A2"), ev("schade_gemeld")];
    expect(dockStatus(log)).toBe("schade");
    log.push(ev("verplaatst", "schadevak"));
    expect(dockStatus(log)).toBe("op_depot");
  });

  it("zonder events is een zending verwacht", () => {
    expect(dockStatus([])).toBe("verwacht");
  });
});

describe("dockLocatie", () => {
  it("volgt de laatste verplaatsing", () => {
    const log = [ev("aangemeld"), ev("ingescand", "A2"), ev("verplaatst", "B1")];
    expect(dockLocatie(log)).toBe("B1");
  });

  it("is null vóór aankomst en na vertrek", () => {
    expect(dockLocatie([ev("aangemeld")])).toBeNull();
    expect(dockLocatie([ev("aangemeld"), ev("ingescand", "A2"), ev("uitgescand")])).toBeNull();
  });

  it("houdt de locatie vast door een schademelding zonder locatie heen", () => {
    const log = [ev("ingescand", "C3"), ev("schade_gemeld")];
    expect(dockLocatie(log)).toBe("C3");
  });
});
