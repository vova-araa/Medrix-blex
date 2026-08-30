import { describe, expect, it } from "vitest";
import {
  CMR_VERPLICHTE_VELDEN, controleerVrachtbrief, NL_FEESTDAGEN, termijnenVan,
  voorbehoudDeadline, vrachtbriefVan,
  type Voorbehoud, type VrachtbriefGegevens,
} from "../src/vrachtbrief";
import type { Zending } from "../src/types";

const volledig = (over: Partial<VrachtbriefGegevens> = {}): VrachtbriefGegevens => ({
  plaatsOpmaak: "Venlo",
  datumOpmaak: "2026-08-07T05:00:00Z",
  afzender: { naam: "Depot Venlo", plaats: "Venlo", land: "NL" },
  vervoerder: "Blex Logistics",
  plaatsInontvangstneming: "Venlo",
  datumInontvangstneming: "2026-08-07T06:30:00Z",
  geadresseerde: { naam: "DC Jumbo", plaats: "Veghel", land: "NL" },
  aardGoederen: "12 rolcontainers diepvries",
  verpakkingswijze: "rolcontainer",
  aantalColli: 12,
  brutogewichtKg: 4100,
  vervoerskostenCenten: 24_500,
  cmrBeding: true,
  ...over,
});

describe("controleerVrachtbrief", () => {
  it("keurt een volledig ingevulde vrachtbrief goed", () => {
    expect(controleerVrachtbrief(volledig())).toEqual({ ontbrekend: [], volledig: true });
  });

  it("noemt elk verplicht veld dat ontbreekt", () => {
    const controle = controleerVrachtbrief(volledig({
      afzender: null, aardGoederen: "  ", aantalColli: null, cmrBeding: false,
    }));
    expect(controle.ontbrekend).toEqual([
      "afzender", "aard_goederen", "aantal_colli", "cmr_beding",
    ]);
    expect(controle.volledig).toBe(false);
  });

  it("ziet nul colli of nul kilo als ontbrekend, niet als ingevuld", () => {
    const controle = controleerVrachtbrief(volledig({ aantalColli: 0, brutogewichtKg: 0 }));
    expect(controle.ontbrekend).toContain("aantal_colli");
    expect(controle.ontbrekend).toContain("brutogewicht");
  });

  it("laat nul vervoerskosten staan: gratis is een bedrag, leeg niet", () => {
    expect(controleerVrachtbrief(volledig({ vervoerskostenCenten: 0 })).volledig).toBe(true);
    expect(controleerVrachtbrief(volledig({ vervoerskostenCenten: null })).ontbrekend)
      .toContain("vervoerskosten");
  });

  it("splitst geadresseerde en plaats van aflevering", () => {
    const zonderPlaats = controleerVrachtbrief(volledig({
      geadresseerde: { naam: "DC Jumbo", plaats: "  ", land: "NL" },
    }));
    expect(zonderPlaats.ontbrekend).toEqual(["plaats_aflevering"]);
  });

  it("dekt alle velden uit art. 6 lid 1 die wij controleren", () => {
    const alles = controleerVrachtbrief({
      plaatsOpmaak: "", datumOpmaak: null, afzender: null, vervoerder: "",
      plaatsInontvangstneming: "", datumInontvangstneming: null, geadresseerde: null,
      aardGoederen: "", verpakkingswijze: "", aantalColli: null, brutogewichtKg: null,
      vervoerskostenCenten: null, cmrBeding: false,
    });
    expect(alles.ontbrekend).toEqual([...CMR_VERPLICHTE_VELDEN]);
  });
});

describe("voorbehoudDeadline", () => {
  it("telt de dag van aflevering niet mee (art. 30 lid 4)", () => {
    // Maandag 10 augustus 2026 + 7 telbare dagen = maandag 17 augustus
    // (zondag 16 augustus telt niet mee).
    expect(voorbehoudDeadline("2026-08-10T14:00:00Z", "niet_zichtbaar")).toBe("2026-08-18");
  });

  it("slaat zondagen over", () => {
    // Zaterdag 8 augustus: zondag 9 en zondag 16 vallen weg, dus 17 augustus.
    expect(voorbehoudDeadline("2026-08-08T14:00:00Z", "niet_zichtbaar")).toBe("2026-08-17");
  });

  it("slaat feestdagen over", () => {
    // Vanaf 22 december 2026: 25 en 26 december zijn feestdagen, 27 is een
    // zondag, dus de zeven telbare dagen lopen door tot 1 januari 2027 —
    // dat is zelf een feestdag, dus 2 januari.
    expect(voorbehoudDeadline("2026-12-22T09:00:00Z", "niet_zichtbaar")).toBe("2027-01-02");
  });

  it("telt bij vertraging alle kalenderdagen", () => {
    expect(voorbehoudDeadline("2026-08-10T14:00:00Z", "vertraging")).toBe("2026-08-31");
  });

  it("laat de feestdagenlijst per land zetten", () => {
    // Zonder feestdagen valt 25 en 26 december gewoon mee.
    expect(voorbehoudDeadline("2026-12-22T09:00:00Z", "niet_zichtbaar", [])).toBe("2026-12-30");
  });

  it("weigert een onbruikbare datum", () => {
    expect(() => voorbehoudDeadline("gisteren", "vertraging")).toThrow(/Onbruikbare afleverdatum/);
  });

  it("gebruikt de Nederlandse feestdagen als standaard", () => {
    expect(voorbehoudDeadline("2026-12-22T09:00:00Z", "niet_zichtbaar"))
      .toBe(voorbehoudDeadline("2026-12-22T09:00:00Z", "niet_zichtbaar", NL_FEESTDAGEN));
  });
});

describe("termijnenVan", () => {
  const vb = (soort: Voorbehoud["soort"]): Voorbehoud => ({
    id: `V-${soort}`, tenantId: "blex", zendingId: "Z1", soort,
    omschrijving: "twee pallets ingedeukt", wie: "geadresseerde",
    tijdstip: "2026-08-11T10:00:00Z",
  });

  it("telt de resterende dagen per soort", () => {
    const stand = termijnenVan("2026-08-10T14:00:00Z", [], "2026-08-12T09:00:00Z");
    const nietZichtbaar = stand.termijnen.find((t) => t.soort === "niet_zichtbaar")!;
    expect(nietZichtbaar.uiterlijk).toBe("2026-08-18");
    expect(nietZichtbaar.dagenOver).toBe(6);
    expect(nietZichtbaar.verstreken).toBe(false);
  });

  it("markeert een verstreken termijn", () => {
    const stand = termijnenVan("2026-08-10T14:00:00Z", [], "2026-08-20T09:00:00Z");
    expect(stand.termijnen.find((t) => t.soort === "niet_zichtbaar")!.verstreken).toBe(true);
    expect(stand.termijnen.find((t) => t.soort === "vertraging")!.verstreken).toBe(false);
  });

  it("is op de laatste dag nog niet verstreken", () => {
    const stand = termijnenVan("2026-08-10T14:00:00Z", [], "2026-08-18T23:00:00Z");
    const nietZichtbaar = stand.termijnen.find((t) => t.soort === "niet_zichtbaar")!;
    expect(nietZichtbaar.dagenOver).toBe(0);
    expect(nietZichtbaar.verstreken).toBe(false);
  });

  it("laat zien welke soort al gemeld is", () => {
    const stand = termijnenVan("2026-08-10T14:00:00Z", [vb("zichtbaar"), vb("vertraging")], "2026-08-12T09:00:00Z");
    expect(stand.zichtbaarGemeld).toBe(true);
    expect(stand.termijnen.find((t) => t.soort === "vertraging")!.gemeld).toBe(true);
    expect(stand.termijnen.find((t) => t.soort === "niet_zichtbaar")!.gemeld).toBe(false);
  });
});

describe("vrachtbriefVan", () => {
  const zending: Zending = {
    id: "Z1", tenantId: "blex", orderId: "O1", barcode: "SHZ-114-001",
    laadmeters: 5.4, gewichtKg: 4100, omschrijving: "12 rolcontainers diepvries",
    van: { naam: "Depot Venlo", plaats: "Venlo", land: "NL" },
    naar: { naam: "DC Jumbo", plaats: "Veghel", land: "NL" },
  };
  const basis = {
    zending, vervoerder: "Blex Logistics", plaatsOpmaak: "Venlo",
    datumOpmaak: "2026-08-07T05:00:00Z", geladenOp: "2026-08-07T06:30:00Z",
    aantalColli: 12, verpakkingswijze: "rolcontainer", vervoerskostenCenten: 24_500,
  };

  it("levert een volledige vrachtbrief als alles bekend is", () => {
    expect(controleerVrachtbrief(vrachtbriefVan(basis)).volledig).toBe(true);
  });

  it("laat onbekende gegevens leeg in plaats van ze te verzinnen", () => {
    const zonderLading = vrachtbriefVan({ ...basis, geladenOp: null, aantalColli: null });
    expect(zonderLading.datumInontvangstneming).toBeNull();
    expect(controleerVrachtbrief(zonderLading).ontbrekend)
      .toEqual(["plaats_datum_inontvangstneming", "aantal_colli"]);
  });

  it("neemt gewicht nul over als ontbrekend", () => {
    const licht = vrachtbriefVan({ ...basis, zending: { ...zending, gewichtKg: 0 } });
    expect(licht.brutogewichtKg).toBeNull();
  });
});
