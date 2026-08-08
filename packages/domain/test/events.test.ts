import { describe, expect, it } from "vitest";
import {
  ritStatus,
  taakStatus,
  voegEventToe,
  type TaakEvent,
} from "../src/events";

const ev = (type: TaakEvent["type"], tijdstip: string): TaakEvent => ({
  id: `E-${type}-${tijdstip}`,
  tenantId: "blex",
  taakId: "T-001",
  type,
  tijdstip,
  wie: "J. Peeters",
  apparaat: "mobile",
});

describe("taakStatus", () => {
  it("leidt de status af uit het laatste event", () => {
    const log = [ev("taak_aangemaakt", "2026-08-07T04:00:00Z")];
    expect(taakStatus(log)).toBe("gepland");
    expect(taakStatus(voegEventToe(log, ev("vertrokken", "2026-08-07T05:00:00Z")))).toBe("onderweg");
  });

  it("laden en lossen ronden allebei af", () => {
    const basis = [ev("taak_aangemaakt", "2026-08-07T04:00:00Z"), ev("aangekomen", "2026-08-07T05:00:00Z")];
    expect(taakStatus(voegEventToe(basis, ev("geladen", "2026-08-07T05:30:00Z")))).toBe("afgerond");
    expect(taakStatus(voegEventToe(basis, ev("gelost", "2026-08-07T05:30:00Z")))).toBe("afgerond");
  });

  it("een probleem kan worden hervat met een nieuw event, zonder de log te herschrijven", () => {
    let log = [
      ev("taak_aangemaakt", "2026-08-07T04:00:00Z"),
      ev("aangekomen", "2026-08-07T05:00:00Z"),
      ev("probleem_gemeld", "2026-08-07T05:10:00Z"),
    ];
    expect(taakStatus(log)).toBe("probleem");
    log = voegEventToe(log, ev("aangekomen", "2026-08-07T05:40:00Z"));
    expect(taakStatus(log)).toBe("bezig");
    expect(log).toHaveLength(4);
  });

  it("weigert een taak zonder events", () => {
    expect(() => taakStatus([])).toThrow();
  });

  it("voegEventToe muteert de bestaande log niet (append-only)", () => {
    const log = [ev("taak_aangemaakt", "2026-08-07T04:00:00Z")];
    const nieuw = voegEventToe(log, ev("vertrokken", "2026-08-07T05:00:00Z"));
    expect(log).toHaveLength(1);
    expect(nieuw).toHaveLength(2);
    expect(nieuw).not.toBe(log);
  });
});

describe("taakStatus vervallen", () => {
  it("een 0-CMR laat een taak vervallen via een event, zonder de log te herschrijven", () => {
    const log = [
      ev("taak_aangemaakt", "2026-08-07T04:00:00Z"),
      ev("vervallen", "2026-08-07T05:00:00Z"),
    ];
    expect(taakStatus(log)).toBe("vervallen");
    expect(log).toHaveLength(2);
  });
});

describe("ritStatus", () => {
  it("vervallen taken tellen niet mee voor de ritvoortgang", () => {
    expect(ritStatus(["afgerond", "vervallen"])).toBe("afgerond");
    expect(ritStatus(["gepland", "vervallen"])).toBe("gepland");
    expect(ritStatus(["vervallen", "vervallen"])).toBe("afgerond");
  });

  it("een rit zonder taken is gepland", () => {
    expect(ritStatus([])).toBe("gepland");
  });

  it("één probleem kleurt de hele rit", () => {
    expect(ritStatus(["afgerond", "probleem", "gepland"])).toBe("probleem");
  });

  it("alles afgerond → afgerond; iets gestart → onderweg", () => {
    expect(ritStatus(["afgerond", "afgerond"])).toBe("afgerond");
    expect(ritStatus(["afgerond", "gepland"])).toBe("onderweg");
    expect(ritStatus(["gepland", "gepland"])).toBe("gepland");
  });
});
