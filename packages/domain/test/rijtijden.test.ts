import { describe, expect, it } from "vitest";
import {
  activiteiten, blokStand, kanInplannen, RIJTIJD_REGELS, rijtijdStatus, verdeelPerDag,
} from "../src/rijtijden";
import type { WerktijdEvent, WerktijdEventType } from "../src/werktijden";

// De demoweek loopt van ma 3 t/m zo 9 augustus 2026. Amsterdam staat die week
// op UTC+2, dus 06:00 lokaal = 04:00Z.
let teller = 0;
const ev = (type: WerktijdEventType, iso: string): WerktijdEvent => ({
  id: `W-${++teller}`, tenantId: "blex", chauffeur: "Test", type, tijdstip: iso,
});
const reeks = (paren: Array<[WerktijdEventType, string]>) => paren.map(([t, i]) => ev(t, i));

const status = (events: WerktijdEvent[], nu: string, extra = {}) =>
  rijtijdStatus({ events, nu, ...extra });

describe("onderbreking (pauze)", () => {
  it("telt ander werk niet als pauze — het rijblok loopt door", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-07T04:00:00Z"],
      ["werk_gestart", "2026-08-07T06:00:00Z"],
      ["rijden_gestart", "2026-08-07T06:30:00Z"],
    ]);
    const s = blokStand(activiteiten(events, "2026-08-07T09:00:00Z"));
    expect(s.blokRijMinuten).toBe(2 * 60 + 150);
  });

  it("reset het blok na 45 minuten pauze", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-07T04:00:00Z"],
      ["pauze_gestart", "2026-08-07T08:00:00Z"],
      ["rijden_gestart", "2026-08-07T08:45:00Z"],
    ]);
    expect(blokStand(activiteiten(events, "2026-08-07T09:15:00Z")).blokRijMinuten).toBe(30);
  });

  it("accepteert de gesplitste pauze 15 + 30 in die volgorde", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-07T04:00:00Z"],
      ["pauze_gestart", "2026-08-07T06:00:00Z"],
      ["rijden_gestart", "2026-08-07T06:15:00Z"],
      ["pauze_gestart", "2026-08-07T08:00:00Z"],
      ["rijden_gestart", "2026-08-07T08:30:00Z"],
    ]);
    expect(blokStand(activiteiten(events, "2026-08-07T09:00:00Z")).blokRijMinuten).toBe(30);
  });

  it("weigert 30 + 15: die volgorde is geen geldige onderbreking", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-07T04:00:00Z"],
      ["pauze_gestart", "2026-08-07T06:00:00Z"],
      ["rijden_gestart", "2026-08-07T06:30:00Z"],
      ["pauze_gestart", "2026-08-07T08:00:00Z"],
      ["rijden_gestart", "2026-08-07T08:15:00Z"],
    ]);
    expect(blokStand(activiteiten(events, "2026-08-07T08:45:00Z")).blokRijMinuten).toBe(240);
  });
});

describe("dagvensters en rusten", () => {
  it("splitst dagen op een dagelijkse rust van 9 uur of meer", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-03T04:00:00Z"],
      ["uitgeklokt", "2026-08-03T12:00:00Z"],
      ["rijden_gestart", "2026-08-04T04:00:00Z"],
      ["uitgeklokt", "2026-08-04T10:00:00Z"],
    ]);
    const { dagvensters } = verdeelPerDag(activiteiten(events, "2026-08-04T12:00:00Z"));
    expect(dagvensters).toHaveLength(2);
    expect(dagvensters[0].rijMinuten).toBe(8 * 60);
    expect(dagvensters[0].afgeslotenMet?.soort).toBe("normaal");
    expect(dagvensters[1].rijMinuten).toBe(6 * 60);
  });

  it("merkt een rust van precies 9 uur aan als verkort", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-03T04:00:00Z"],
      ["uitgeklokt", "2026-08-03T12:00:00Z"],
      ["rijden_gestart", "2026-08-03T21:00:00Z"],
      ["uitgeklokt", "2026-08-04T02:00:00Z"],
    ]);
    const { dagvensters } = verdeelPerDag(activiteiten(events, "2026-08-04T04:00:00Z"));
    expect(dagvensters[0].afgeslotenMet?.soort).toBe("verkort");
  });

  it("ziet 3 uur + 9 uur als geldige gesplitste dagrust, niet als verkort", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-03T04:00:00Z"],
      ["pauze_gestart", "2026-08-03T08:00:00Z"],
      ["rijden_gestart", "2026-08-03T11:00:00Z"],
      ["uitgeklokt", "2026-08-03T15:00:00Z"],
      ["rijden_gestart", "2026-08-04T00:00:00Z"],
    ]);
    const { dagvensters } = verdeelPerDag(activiteiten(events, "2026-08-04T02:00:00Z"));
    expect(dagvensters[0].afgeslotenMet?.soort).toBe("gesplitst");
  });

  it("herkent een verkorte weekrust en berekent het te compenseren tekort", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-03T04:00:00Z"],
      ["uitgeklokt", "2026-08-03T12:00:00Z"],
      ["rijden_gestart", "2026-08-04T12:00:00Z"],
    ]);
    const { weekRusten } = verdeelPerDag(activiteiten(events, "2026-08-04T14:00:00Z"));
    expect(weekRusten).toHaveLength(1);
    expect(weekRusten[0].verkort).toBe(true);
    expect(weekRusten[0].tekortMinuten).toBe(21 * 60);
  });
});

describe("rijtijdgrenzen", () => {
  const dagVan = (uren: number) => reeks([
    ["rijden_gestart", "2026-08-07T04:00:00Z"],
    ["uitgeklokt", `2026-08-07T${String(4 + uren).padStart(2, "0")}:00:00Z`],
  ]);

  it("houdt 9 uur aan, met 10 uur alleen na bewuste verlenging", () => {
    const s = status(dagVan(8), "2026-08-07T12:00:00Z");
    expect(s.dagRijMinuten).toBe(8 * 60);
    expect(s.dagResterendMinuten).toBe(60);
    expect(s.dagResterendMetVerlengingMinuten).toBe(120);
    expect(s.verlengingenOver).toBe(2);
  });

  it("biedt geen derde verlenging aan als er al twee gebruikt zijn", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-03T04:00:00Z"],
      ["uitgeklokt", "2026-08-03T13:30:00Z"],
      ["rijden_gestart", "2026-08-04T04:00:00Z"],
      ["uitgeklokt", "2026-08-04T13:30:00Z"],
      ["rijden_gestart", "2026-08-05T04:00:00Z"],
    ]);
    const s = status(events, "2026-08-05T10:00:00Z");
    expect(s.verlengingenGebruikt).toBe(2);
    expect(s.verlengingenOver).toBe(0);
    expect(s.dagResterendMetVerlengingMinuten).toBe(s.dagResterendMinuten);
  });

  it("bewaakt 56 uur per week en 90 uur over twee weken", () => {
    const weekMs = Date.parse("2026-08-02T22:00:00Z");
    const vorigeWeekMs = Date.parse("2026-07-26T22:00:00Z");
    const s = status([], "2026-08-07T10:00:00Z", {
      eerdereRijMinutenPerWeek: { [weekMs]: 50 * 60, [vorigeWeekMs]: 38 * 60 },
    });
    expect(s.weekRijMinuten).toBe(50 * 60);
    expect(s.weekResterendMinuten).toBe(6 * 60);
    expect(s.tweeWekenRijMinuten).toBe(88 * 60);
    expect(s.tweeWekenResterendMinuten).toBe(2 * 60);
  });

  it("meldt een overtreding zodra de weekgrens gepasseerd is", () => {
    const weekMs = Date.parse("2026-08-02T22:00:00Z");
    const s = status([], "2026-08-07T10:00:00Z", {
      eerdereRijMinutenPerWeek: { [weekMs]: 57 * 60 },
    });
    expect(s.overtredingen.find((o) => o.code === "weekrijtijd")?.ernst).toBe("overtreding");
  });

  it("telt verkorte dagrusten sinds de laatste weekrust", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-03T04:00:00Z"],
      ["uitgeklokt", "2026-08-03T13:00:00Z"],
      ["rijden_gestart", "2026-08-03T22:00:00Z"],
      ["uitgeklokt", "2026-08-04T07:00:00Z"],
      ["rijden_gestart", "2026-08-04T16:00:00Z"],
    ]);
    const s = status(events, "2026-08-04T18:00:00Z");
    expect(s.verkorteDagRustenGebruikt).toBe(2);
    expect(s.verkorteDagRustenOver).toBe(1);
  });

  it("waarschuwt binnen 24 uur voor de termijn van zes perioden van 24 uur", () => {
    const events = reeks([
      ["uitgeklokt", "2026-07-31T12:00:00Z"],
      ["rijden_gestart", "2026-08-02T09:00:00Z"],
    ]);
    const s = status(events, "2026-08-07T09:00:00Z");
    expect(s.minutenSindsWeekRust).toBe(5 * 24 * 60);
    expect(s.minutenTotWeekRustDeadline).toBe(24 * 60);
    expect(s.overtredingen.map((o) => o.code)).toContain("weekrust_termijn");
  });

  it("meldt een overtreding als de zes perioden verstreken zijn", () => {
    const events = reeks([
      ["uitgeklokt", "2026-07-31T12:00:00Z"],
      ["rijden_gestart", "2026-08-02T09:00:00Z"],
    ]);
    const s = status(events, "2026-08-08T15:00:00Z");
    expect(s.overtredingen.find((o) => o.code === "weekrust_termijn")?.ernst).toBe("overtreding");
  });
});

describe("arbeidstijd (Arbeidstijdenbesluit vervoer)", () => {
  it("rekent beschikbaarheidstijd niet mee als arbeidstijd", () => {
    const events = reeks([
      ["rijden_gestart", "2026-08-07T04:00:00Z"],
      ["beschikbaar_gestart", "2026-08-07T08:00:00Z"],
      ["werk_gestart", "2026-08-07T10:00:00Z"],
    ]);
    const s = status(events, "2026-08-07T11:00:00Z");
    expect(s.weekArbeidMinuten).toBe(5 * 60);
    expect(s.dienstMinuten).toBe(7 * 60);
  });

  it("bewaakt de weekgrens van 60 uur arbeidstijd", () => {
    const weekMs = Date.parse("2026-08-02T22:00:00Z");
    const s = status([], "2026-08-07T10:00:00Z", {
      eerdereArbeidMinutenPerWeek: { [weekMs]: 61 * 60 },
    });
    expect(s.overtredingen.map((o) => o.code)).toContain("weekarbeid");
  });

  it("beperkt de dienst tot 10 uur bij nachtarbeid", () => {
    const events = reeks([["rijden_gestart", "2026-08-06T23:00:00Z"]]);
    const s = status(events, "2026-08-07T09:30:00Z");
    expect(s.nachtdienst).toBe(true);
    expect(s.overtredingen.map((o) => o.code)).toContain("nachtdienst");
  });

  it("laat een dagdienst van 11 uur toe zonder nachtmelding", () => {
    const events = reeks([["werk_gestart", "2026-08-07T06:00:00Z"]]);
    const s = status(events, "2026-08-07T17:00:00Z");
    expect(s.nachtdienst).toBe(false);
    expect(s.overtredingen.map((o) => o.code)).not.toContain("dienstduur");
  });
});

describe("kanInplannen", () => {
  const basis = (over: Partial<ReturnType<typeof rijtijdStatus>> = {}) => ({
    ...rijtijdStatus({ events: [], nu: "2026-08-07T10:00:00Z" }),
    dagResterendMinuten: 120,
    dagResterendMetVerlengingMinuten: 180,
    weekResterendMinuten: 600,
    tweeWekenResterendMinuten: 600,
    dienstResterendMinuten: 600,
    weekArbeidResterendMinuten: 600,
    blokResterendMinuten: 120,
    ...over,
  });

  it("staat een rit toe die binnen alle grenzen past", () => {
    const c = kanInplannen(basis(), 90);
    expect(c.kan).toBe(true);
    expect(c.vereistVerlenging).toBe(false);
  });

  it("markeert dat een rit alleen past met de verlenging naar 10 uur", () => {
    const c = kanInplannen(basis(), 150);
    expect(c.kan).toBe(true);
    expect(c.vereistVerlenging).toBe(true);
  });

  it("weigert een rit die ook met verlenging niet past", () => {
    const c = kanInplannen(basis(), 200);
    expect(c.kan).toBe(false);
    expect(c.redenen).toContain("dagrijtijd");
  });

  it("weigert op de weekgrens", () => {
    expect(kanInplannen(basis({ weekResterendMinuten: 60 }), 90).redenen).toContain("weekrijtijd");
  });

  it("weigert op de tweewekengrens van 90 uur", () => {
    expect(kanInplannen(basis({ tweeWekenResterendMinuten: 30 }), 90).redenen)
      .toContain("tweewekenrijtijd");
  });

  it("weigert als de weekrust binnen de rit zou moeten beginnen", () => {
    expect(kanInplannen(basis({ minutenTotWeekRustDeadline: 45 }), 90).redenen)
      .toContain("weekrust_termijn");
  });

  it("blokkeert zolang er eerst pauze gehouden moet worden", () => {
    const c = kanInplannen(basis({ pauzeNodig: true }), 30);
    expect(c.kan).toBe(false);
    expect(c.redenen).toContain("pauze_eerst");
  });

  it("meldt een pauze binnen de rit zonder hem te weigeren", () => {
    const c = kanInplannen(basis({ blokResterendMinuten: 30 }), 90);
    expect(c.kan).toBe(true);
    expect(c.vereistPauze).toBe(true);
  });
});

describe("regelconstanten komen overeen met de directive", () => {
  it("bevat de nagezochte waarden uit 561/2006 en het ATB-V", () => {
    expect(RIJTIJD_REGELS.maxDagRijMinuten).toBe(540);
    expect(RIJTIJD_REGELS.maxDagRijVerlengdMinuten).toBe(600);
    expect(RIJTIJD_REGELS.maxVerlengingenPerWeek).toBe(2);
    expect(RIJTIJD_REGELS.maxWeekRijMinuten).toBe(3360);
    expect(RIJTIJD_REGELS.maxTweeWekenRijMinuten).toBe(5400);
    expect(RIJTIJD_REGELS.blokRijMinuten).toBe(270);
    expect(RIJTIJD_REGELS.pauzeNaBlokMinuten).toBe(45);
    expect(RIJTIJD_REGELS.dagRustMinuten).toBe(660);
    expect(RIJTIJD_REGELS.dagRustVerkortMinuten).toBe(540);
    expect(RIJTIJD_REGELS.maxVerkorteDagRustenTussenWeekrust).toBe(3);
    expect(RIJTIJD_REGELS.weekRustMinuten).toBe(2700);
    expect(RIJTIJD_REGELS.weekRustVerkortMinuten).toBe(1440);
    expect(RIJTIJD_REGELS.weekRustUiterlijkNaMinuten).toBe(8640);
    expect(RIJTIJD_REGELS.maxWeekArbeidMinuten).toBe(3600);
    expect(RIJTIJD_REGELS.gemiddeldeWeekArbeidMinuten).toBe(2880);
    expect(RIJTIJD_REGELS.referentieperiodeWeken).toBe(16);
    expect(RIJTIJD_REGELS.maxDienstMetNachtarbeidMinuten).toBe(600);
  });
});
