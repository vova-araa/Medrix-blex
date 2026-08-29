import { describe, expect, it } from "vitest";
import { urenTotalen, type WerktijdEvent } from "../src/werktijden";

const ev = (type: WerktijdEvent["type"], tijdstip: string): WerktijdEvent => ({
  id: `W-${type}-${tijdstip}`,
  tenantId: "blex",
  chauffeur: "J. Peeters",
  type,
  tijdstip,
});

describe("urenTotalen", () => {
  it("verdeelt de dienst over werk, rijden en pauze", () => {
    const events = [
      ev("ingeklokt", "2026-08-07T04:00:00Z"),      // 30 min werk (laden)
      ev("rijden_gestart", "2026-08-07T04:30:00Z"), // 90 min rijden
      ev("pauze_gestart", "2026-08-07T06:00:00Z"),  // 45 min pauze
      ev("rijden_gestart", "2026-08-07T06:45:00Z"), // 75 min rijden
      ev("uitgeklokt", "2026-08-07T08:00:00Z"),
    ];
    const uren = urenTotalen(events, "2026-08-07T12:00:00Z");
    expect(uren.werkMinuten).toBe(30);
    expect(uren.rijMinuten).toBe(165);
    expect(uren.pauzeMinuten).toBe(45);
    expect(uren.dienstMinuten).toBe(240);
    expect(uren.actief).toBeNull();
  });

  it("telt een lopende dienst door tot nu", () => {
    const events = [
      ev("ingeklokt", "2026-08-07T04:00:00Z"),
      ev("rijden_gestart", "2026-08-07T04:20:00Z"),
    ];
    const uren = urenTotalen(events, "2026-08-07T05:00:00Z");
    expect(uren.actief).toBe("rijden");
    expect(uren.rijMinuten).toBe(40);
    expect(uren.dienstMinuten).toBe(60);
  });

  it("is leeg zonder events", () => {
    expect(urenTotalen([], "2026-08-07T05:00:00Z")).toEqual({
      dienstMinuten: 0, rijMinuten: 0, werkMinuten: 0, pauzeMinuten: 0, beschikbaarMinuten: 0, actief: null,
    });
  });
});
