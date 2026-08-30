import { describe, expect, it } from "vitest";
import {
  bewakingVan, bewakingVanVloot, kostenVanDag, WAGENPARK_REGELS, type WagenparkVoertuig,
} from "../src/wagenpark";

const NU = "2026-08-07T10:00:00Z";
const voertuig = (over: Partial<WagenparkVoertuig> = {}): WagenparkVoertuig => ({
  kentekenGenormaliseerd: "43BKL7",
  landcode: "NL",
  omschrijving: "Trekker + city-trailer",
  kmStand: 412_512,
  apkTotIso: "2027-03-01T00:00:00Z",
  volgendeOnderhoudKm: 425_000,
  tachograafGekeurdIso: "2025-06-01T00:00:00Z",
  verbruikL100: 28.5,
  kostenPerMaandCenten: 385_000,
  ...over,
});

describe("APK-bewaking", () => {
  it("meldt ok als de APK ver weg is", () => {
    const apk = bewakingVan(voertuig(), NU).find((b) => b.soort === "apk")!;
    expect(apk.ernst).toBe("ok");
    expect(apk.dagenResterend).toBeGreaterThan(WAGENPARK_REGELS.apkWaarschuwDagen);
  });

  it("waarschuwt zes weken van tevoren", () => {
    const apk = bewakingVan(voertuig({ apkTotIso: "2026-09-10T00:00:00Z" }), NU)
      .find((b) => b.soort === "apk")!;
    expect(apk.dagenResterend).toBe(33);
    expect(apk.ernst).toBe("waarschuwing");
  });

  it("meldt een verlopen APK als verlopen, met het aantal dagen", () => {
    const apk = bewakingVan(voertuig({ apkTotIso: "2026-07-20T00:00:00Z" }), NU)
      .find((b) => b.soort === "apk")!;
    expect(apk.ernst).toBe("verlopen");
    expect(apk.omschrijving).toMatch(/18 dagen verlopen/);
  });
});

describe("onderhoudsbewaking op kilometerstand", () => {
  it("rekent de resterende kilometers uit", () => {
    const o = bewakingVan(voertuig(), NU).find((b) => b.soort === "onderhoud")!;
    expect(o.kmResterend).toBe(12_488);
    expect(o.ernst).toBe("ok");
  });

  it("waarschuwt binnen 2500 km", () => {
    const o = bewakingVan(voertuig({ volgendeOnderhoudKm: 414_000 }), NU)
      .find((b) => b.soort === "onderhoud")!;
    expect(o.kmResterend).toBe(1488);
    expect(o.ernst).toBe("waarschuwing");
  });

  it("meldt een gemiste beurt als verlopen", () => {
    const o = bewakingVan(voertuig({ volgendeOnderhoudKm: 410_000 }), NU)
      .find((b) => b.soort === "onderhoud")!;
    expect(o.ernst).toBe("verlopen");
    expect(o.omschrijving).toMatch(/2\.512 km over tijd/);
  });
});

describe("tachograafkeuring", () => {
  it("rekent twee jaar vanaf de laatste keuring", () => {
    const k = bewakingVan(voertuig({ tachograafGekeurdIso: "2025-06-01T00:00:00Z" }), NU)
      .find((b) => b.soort === "tachograafkeuring")!;
    // Vervalt 1 juni 2027 — ruim weg.
    expect(k.ernst).toBe("ok");
    expect(WAGENPARK_REGELS.tachograafKeuringMaanden).toBe(24);
  });

  it("meldt een keuring van meer dan twee jaar geleden als verlopen", () => {
    const k = bewakingVan(voertuig({ tachograafGekeurdIso: "2024-01-01T00:00:00Z" }), NU)
      .find((b) => b.soort === "tachograafkeuring")!;
    expect(k.ernst).toBe("verlopen");
  });

  it("behandelt een onbekende keuringsdatum als verlopen, niet als ok", () => {
    const k = bewakingVan(voertuig({ tachograafGekeurdIso: undefined }), NU)
      .find((b) => b.soort === "tachograafkeuring")!;
    expect(k.ernst).toBe("verlopen");
    expect(k.omschrijving).toMatch(/onbekend/i);
  });
});

describe("vlootoverzicht", () => {
  it("zet het urgentste bovenaan", () => {
    const lijst = bewakingVanVloot([
      voertuig({ kentekenGenormaliseerd: "GOED" }),
      voertuig({ kentekenGenormaliseerd: "STUK", apkTotIso: "2026-07-01T00:00:00Z" }),
    ], NU);
    expect(lijst[0].ernst).toBe("verlopen");
    expect(lijst[0].kenteken).toBe("STUK");
  });
});

describe("kostprijs per kilometer", () => {
  it("telt vaste kosten en brandstof bij elkaar", () => {
    // 380 km × 28,5 l/100 = 108,3 l × € 1,72 = € 186,28 brandstof.
    // Vaste kosten € 3.850 / 21 dagen = € 183,33.
    const k = kostenVanDag(voertuig(), 380, 172);
    expect(k.brandstofCenten).toBe(18_628);
    expect(k.vasteKostenCenten).toBe(18_333);
    expect(k.totaalCenten).toBe(36_961);
    expect(k.kostprijsPerKmCenten).toBe(97);
  });

  it("geeft geen kostprijs per km bij nul kilometers", () => {
    const k = kostenVanDag(voertuig(), 0, 172);
    expect(k.kostprijsPerKmCenten).toBeNull();
    expect(k.brandstofCenten).toBe(0);
    expect(k.vasteKostenCenten).toBeGreaterThan(0);
  });
});
