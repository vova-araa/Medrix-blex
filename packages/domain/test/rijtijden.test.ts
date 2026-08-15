import { describe, expect, it } from "vitest";
import { kanInplannen, rijtijdStatus, RIJTIJD_REGELS } from "../src/rijtijden";
import type { WerktijdEvent } from "../src/werktijden";

const ev = (type: WerktijdEvent["type"], tijdstip: string): WerktijdEvent => ({
  id: `W-${type}-${tijdstip}`,
  tenantId: "blex",
  chauffeur: "J. Peeters",
  type,
  tijdstip,
});

describe("rijtijdStatus", () => {
  it("telt dagrijtijd en resterende rijtijd", () => {
    const events = [
      ev("ingeklokt", "2026-08-07T04:00:00Z"),
      ev("rijden_gestart", "2026-08-07T04:30:00Z"), // 3 uur rijden
      ev("werk_gestart", "2026-08-07T07:30:00Z"),
    ];
    const status = rijtijdStatus(events, "2026-08-07T08:00:00Z");
    expect(status.dagRijMinuten).toBe(180);
    expect(status.dagResterendMinuten).toBe(RIJTIJD_REGELS.maxDagRijMinuten - 180);
  });

  it("eist pauze na 4,5 uur onafgebroken rijden; werk onderbreekt maar reset niet", () => {
    const events = [
      ev("ingeklokt", "2026-08-07T04:00:00Z"),
      ev("rijden_gestart", "2026-08-07T04:00:00Z"), // 3 uur rijden
      ev("werk_gestart", "2026-08-07T07:00:00Z"),   // 30 min werk — geen pauze
      ev("rijden_gestart", "2026-08-07T07:30:00Z"), // nog 2 uur rijden
    ];
    const status = rijtijdStatus(events, "2026-08-07T09:30:00Z");
    expect(status.blokRijMinuten).toBe(300); // 5 uur in het blok
    expect(status.pauzeNodig).toBe(true);
  });

  it("een pauze van 45 minuten reset het rijblok, niet de dagteller", () => {
    const events = [
      ev("ingeklokt", "2026-08-07T04:00:00Z"),
      ev("rijden_gestart", "2026-08-07T04:00:00Z"), // 4 uur rijden
      ev("pauze_gestart", "2026-08-07T08:00:00Z"),  // 45 min pauze
      ev("rijden_gestart", "2026-08-07T08:45:00Z"), // 1 uur rijden
    ];
    const status = rijtijdStatus(events, "2026-08-07T09:45:00Z");
    expect(status.blokRijMinuten).toBe(60);
    expect(status.dagRijMinuten).toBe(300);
    expect(status.pauzeNodig).toBe(false);
  });

  it("een korte pauze (< 45 min) reset het blok niet", () => {
    const events = [
      ev("rijden_gestart", "2026-08-07T04:00:00Z"),
      ev("pauze_gestart", "2026-08-07T07:00:00Z"),  // 20 min — te kort
      ev("rijden_gestart", "2026-08-07T07:20:00Z"),
    ];
    const status = rijtijdStatus(events, "2026-08-07T09:00:00Z");
    expect(status.blokRijMinuten).toBe(280);
    expect(status.pauzeNodig).toBe(true);
  });

  it("telt weekrijtijd op bij eerdere dagen", () => {
    const events = [ev("rijden_gestart", "2026-08-07T04:00:00Z")];
    const status = rijtijdStatus(events, "2026-08-07T06:00:00Z", 50 * 60);
    expect(status.weekRijMinuten).toBe(50 * 60 + 120);
    expect(status.weekResterendMinuten).toBe(RIJTIJD_REGELS.maxWeekRijMinuten - (50 * 60 + 120));
  });
});

describe("kanInplannen", () => {
  it("blokkeert als de dag- of weekrijtijd het niet toelaat", () => {
    const bijnaOp = rijtijdStatus(
      [ev("rijden_gestart", "2026-08-07T00:00:00Z")], // 8,5 uur gereden
      "2026-08-07T08:30:00Z",
      47 * 60 // week bijna vol: 47u + 8,5u = 55,5u van de 56u
    );
    expect(kanInplannen(bijnaOp, 20).kan).toBe(true);
    const teVeel = kanInplannen(bijnaOp, 45);
    expect(teVeel.kan).toBe(false);
    expect(teVeel.redenen).toContain("dagrijtijd");
    expect(teVeel.redenen).toContain("weekrijtijd");
  });
});
