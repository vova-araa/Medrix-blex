import { describe, expect, it } from "vitest";
import { beoordeelHerplan, type HerplanInvoer } from "../src/herplan";
import type { TaakStatus } from "../src/events";
import type { Rit, Taak } from "../src/types";

// 07:00 lokaal in de zomer is 05:00 UTC; de tests rekenen in lokale uren.
const iso = (uu: number, mm = 0) =>
  new Date(Date.UTC(2026, 7, 7, 0, Math.round(uu * 60) + mm - 120)).toISOString();

const rit = (id: string, capaciteit = 13.6, chauffeur = "J. Peeters"): Rit => ({
  id, tenantId: "blex", datum: "2026-08-07", chauffeur, charter: false,
  voertuig: {
    kentekenGenormaliseerd: id === "R1" ? "43BKL7" : "87TDF3", landcode: "NL",
    omschrijving: "Trekker", capaciteitLaadmeters: capaciteit,
  },
});

const taak = (
  id: string, ritId: string, soort: Taak["soort"], plaats: string,
  vanUur: number, totUur: number,
  over: { zendingId?: string; venster?: [number, number] } = {}
): Taak => ({
  id, tenantId: "blex", ritId, soort,
  zendingId: over.zendingId,
  adres: {
    naam: `Adres ${plaats}`, plaats, land: "NL",
    tijdvenster: over.venster ? { van: iso(over.venster[0]), tot: iso(over.venster[1]) } : undefined,
  },
  geplandVan: iso(vanUur), geplandTot: iso(totUur),
});

function invoerVan(over: Partial<HerplanInvoer> & Pick<HerplanInvoer, "taakId" | "nieuweStartIso">): HerplanInvoer {
  const bron = over.bron ?? [];
  return {
    bron,
    doel: over.doel ?? bron,
    doelRit: over.doelRit ?? rit("R1"),
    statusVan: over.statusVan ?? (() => "gepland" as TaakStatus),
    // Synthetische reistijd: een uur tussen verschillende plaatsen.
    reistijdMinuten: over.reistijdMinuten ?? ((van, naar) => (van === naar ? 0 : 60)),
    laadmetersVan: over.laadmetersVan ?? (() => 3),
    nu: over.nu ?? iso(5),
    dienstEindeIso: over.dienstEindeIso,
    ...over,
  };
}

describe("beoordeelHerplan — verschuiven binnen een rit", () => {
  const bron = () => [
    taak("T1", "R1", "laden", "Venlo", 6, 7, { zendingId: "Z1" }),
    taak("T2", "R1", "lossen", "Veghel", 9, 10, { zendingId: "Z1" }),
  ];

  it("staat een verschuiving toe die past", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(10), bron: bron(),
    }));
    expect(uit.toegestaan).toBe(true);
    expect(uit.doelTaken.find((t) => t.id === "T2")!.geplandVan).toBe(iso(10));
    // De duur van de stop blijft gelijk.
    expect(uit.doelTaken.find((t) => t.id === "T2")!.geplandTot).toBe(iso(11));
  });

  it("weigert een stop die te dicht op de vorige komt", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(7, 30), bron: bron(),
    }));
    expect(uit.toegestaan).toBe(false);
    expect(uit.fouten).toContainEqual({ code: "rijtijd", taakId: "T2", minuten: 30 });
  });

  it("weigert een afgeronde stop", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T1", nieuweStartIso: iso(7), bron: bron(),
      statusVan: (id) => (id === "T1" ? "afgerond" : "gepland"),
    }));
    expect(uit.fouten.some((f) => f.code === "afgeronde_stop")).toBe(true);
  });

  it("weigert een stop waar de chauffeur al staat", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(11), bron: bron(),
      statusVan: (id) => (id === "T2" ? "bezig" : "gepland"),
    }));
    expect(uit.fouten.some((f) => f.code === "stop_bezig")).toBe(true);
  });

  it("weigert plannen in het verleden", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(8), bron: bron(), nu: iso(8, 30),
    }));
    expect(uit.fouten).toContainEqual({ code: "in_verleden", taakId: "T2", minuten: 30 });
  });

  it("weigert lossen vóór laden", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(4), bron: bron(), nu: iso(3),
    }));
    expect(uit.fouten.some((f) => f.code === "volgorde")).toBe(true);
  });

  it("waarschuwt bij een venster dat niet gehaald wordt, maar staat het toe", () => {
    const metVenster = [
      taak("T1", "R1", "laden", "Venlo", 6, 7, { zendingId: "Z1" }),
      taak("T2", "R1", "lossen", "Veghel", 9, 10, { zendingId: "Z1", venster: [9, 11] }),
    ];
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(11), bron: metVenster,
    }));
    expect(uit.toegestaan).toBe(true);
    expect(uit.waarschuwingen).toEqual([{ code: "buiten_venster", taakId: "T2", minuten: 60 }]);
  });

  it("meldt te vroeg als een negatieve afwijking", () => {
    const metVenster = [
      taak("T1", "R1", "laden", "Venlo", 6, 7, { zendingId: "Z1" }),
      taak("T2", "R1", "lossen", "Veghel", 10, 11, { zendingId: "Z1", venster: [10, 12] }),
    ];
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(9), bron: metVenster,
    }));
    expect(uit.waarschuwingen[0].minuten).toBe(-60);
  });

  it("weigert een rit die na de dienst doorloopt", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(17), bron: bron(), dienstEindeIso: iso(17, 30),
    }));
    expect(uit.fouten).toContainEqual({ code: "buiten_dienst", minuten: 30 });
  });
});

describe("beoordeelHerplan — naar een andere auto", () => {
  // De doelrit laadt zelf al om 06:00; deze rit begint later, zodat de twee
  // elkaar niet in de weg zitten zolang de tijden kloppen.
  const bron = () => [
    taak("T1", "R1", "laden", "Venlo", 8, 9, { zendingId: "Z1" }),
    taak("T2", "R1", "lossen", "Veghel", 11, 12, { zendingId: "Z1" }),
  ];
  const doel = () => [taak("T9", "R2", "laden", "Venlo", 6, 6.5, { zendingId: "Z9" })];

  it("neemt de laadstop mee als de losstop verhuist", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(12), bron: bron(), doel: doel(),
      doelRit: rit("R2", 13.6, "M. Kowalski"),
      reistijdMinuten: () => 30,
    }));
    expect(uit.toegestaan).toBe(true);
    expect(uit.meeverhuisd).toEqual(["Z1"]);
    expect(uit.doelTaken.map((t) => t.id)).toEqual(["T9", "T1", "T2"]);
    // Het laden schuift even ver mee als het lossen: een uur later.
    expect(uit.doelTaken.find((t) => t.id === "T1")!.geplandVan).toBe(iso(9));
    expect(uit.doelTaken.every((t) => t.ritId === "R2")).toBe(true);
    // De bronrit houdt niets van deze zending meer over.
    expect(uit.bronTaken).toEqual([]);
  });

  it("weigert de losstop als de vracht al op de andere auto staat", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(12), bron: bron(), doel: doel(),
      doelRit: rit("R2", 13.6, "M. Kowalski"),
      statusVan: (id) => (id === "T1" ? "afgerond" : "gepland"),
      reistijdMinuten: () => 30,
    }));
    expect(uit.toegestaan).toBe(false);
    expect(uit.fouten).toContainEqual({ code: "paar_gescheiden", taakId: "T1" });
  });

  it("weigert als de laadmeters niet op de auto passen", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(12), bron: bron(), doel: doel(),
      doelRit: rit("R2", 8, "M. Kowalski"),
      laadmetersVan: () => 5,
      reistijdMinuten: () => 30,
    }));
    expect(uit.fouten.some((f) => f.code === "capaciteit" && f.laadmeters === 2)).toBe(true);
  });

  it("telt alleen de piek, niet alles bij elkaar", () => {
    // Z9 wordt gelost voordat Z1 erop gaat: nooit meer dan 5 lm tegelijk.
    const ruimDoel = [
      taak("T9", "R2", "laden", "Venlo", 6, 6.5, { zendingId: "Z9" }),
      taak("T10", "R2", "lossen", "Breda", 8, 8.5, { zendingId: "Z9" }),
    ];
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T2", nieuweStartIso: iso(13), bron: [
        taak("T1", "R1", "laden", "Venlo", 10, 10.5, { zendingId: "Z1" }),
        taak("T2", "R1", "lossen", "Veghel", 12, 12.5, { zendingId: "Z1" }),
      ],
      doel: ruimDoel, doelRit: rit("R2", 6, "M. Kowalski"),
      laadmetersVan: () => 5, reistijdMinuten: () => 30,
    }));
    expect(uit.fouten.some((f) => f.code === "capaciteit")).toBe(false);
  });

  it("rekent vracht die al aan boord was mee vanaf het begin", () => {
    // Z8 is gisteren geladen: alleen de losstop staat op de rit.
    const doelMetVracht = [taak("T8", "R2", "lossen", "Breda", 15, 15.5, { zendingId: "Z8" })];
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T1", nieuweStartIso: iso(8), bron: bron(), doel: doelMetVracht,
      doelRit: rit("R2", 8, "M. Kowalski"),
      laadmetersVan: () => 5, reistijdMinuten: () => 30,
    }));
    expect(uit.fouten.some((f) => f.code === "capaciteit" && f.laadmeters === 2)).toBe(true);
  });

  it("weigert een stop die niet te halen is vanaf de vorige op de doelrit", () => {
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T1", nieuweStartIso: iso(6, 45), bron: bron(), doel: doel(),
      doelRit: rit("R2", 13.6, "M. Kowalski"),
      reistijdMinuten: () => 120,
    }));
    expect(uit.fouten.some((f) => f.code === "rijtijd")).toBe(true);
  });

  it("laat de bronrit over met wat er niet mee verhuist", () => {
    const bronDrie = [
      ...bron(),
      taak("T3", "R1", "lossen", "Breda", 11, 12, { zendingId: "Z2" }),
    ];
    const uit = beoordeelHerplan(invoerVan({
      taakId: "T3", nieuweStartIso: iso(13), bron: bronDrie, doel: doel(),
      doelRit: rit("R2", 13.6, "M. Kowalski"), reistijdMinuten: () => 30,
    }));
    expect(uit.bronTaken.map((t) => t.id)).toEqual(["T1", "T2"]);
    expect(uit.meeverhuisd).toEqual([]);
  });
});
