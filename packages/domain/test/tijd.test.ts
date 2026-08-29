import { describe, expect, it } from "vitest";
import { lokaleDatum, nachtMinuten, weekStartMs, zoneOffsetMinuten } from "../src/tijd";

const iso = (ms: number) => new Date(ms).toISOString();

describe("tijd (Europe/Amsterdam)", () => {
  it("kent de zomertijd- en wintertijdoffset", () => {
    expect(zoneOffsetMinuten(Date.parse("2026-08-07T12:00:00Z"))).toBe(120);
    expect(zoneOffsetMinuten(Date.parse("2026-01-15T12:00:00Z"))).toBe(60);
  });

  it("begint de week op maandag 00:00 lokale tijd", () => {
    // Vrijdag 7 aug 2026 → maandag 3 aug 2026 00:00 Amsterdam = 02:00Z ervoor.
    const start = weekStartMs(Date.parse("2026-08-07T10:42:00Z"));
    expect(iso(start)).toBe("2026-08-02T22:00:00.000Z");
  });

  it("houdt maandag 00:15 lokaal in dezelfde week als vrijdag erna", () => {
    const maandag = weekStartMs(Date.parse("2026-08-02T22:15:00Z"));
    const vrijdag = weekStartMs(Date.parse("2026-08-07T10:42:00Z"));
    expect(maandag).toBe(vrijdag);
  });

  it("zet zondag 23:00 lokaal nog in de aflopende week", () => {
    // Zondag 9 aug 23:00 lokaal = 21:00Z; week begint 2 aug 22:00Z.
    expect(iso(weekStartMs(Date.parse("2026-08-09T21:00:00Z")))).toBe("2026-08-02T22:00:00.000Z");
    // Maandag 10 aug 00:30 lokaal = 22:30Z op 9 aug → nieuwe week.
    expect(iso(weekStartMs(Date.parse("2026-08-09T22:30:00Z")))).toBe("2026-08-09T22:00:00.000Z");
  });

  it("geeft de lokale datum, niet de UTC-datum", () => {
    // 22:30Z op 9 aug is al 00:30 lokaal op 10 aug.
    expect(lokaleDatum("2026-08-09T22:30:00Z")).toBe("2026-08-10");
  });

  it("telt de minuten die in het nachtvenster 00:00–06:00 vallen", () => {
    // 03:00–07:00 lokaal = 01:00Z–05:00Z; drie uur ervan is nacht.
    const van = Date.parse("2026-08-07T01:00:00Z");
    const tot = Date.parse("2026-08-07T05:00:00Z");
    expect(nachtMinuten(van, tot)).toBe(180);
  });

  it("telt geen nacht voor een dienst die overdag valt", () => {
    expect(nachtMinuten(Date.parse("2026-08-07T08:00:00Z"), Date.parse("2026-08-07T16:00:00Z"))).toBe(0);
  });
});
