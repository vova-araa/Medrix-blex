import { describe, expect, it } from "vitest";
import {
  balkSamenvatting, balkTijd, balkVenster, bouwTijdbalk, knelpuntenLijst, vrijeGaten,
  type TijdbalkInvoer,
} from "../src/tijdbalk";
import type { TaakEvent, TaakEventType } from "../src/events";
import type { Rit, Taak } from "../src/types";

const DATUM = "2026-08-07";
// 06:00 lokaal in de zomer is 04:00 UTC; de balk rekent in lokale minuten.
// Uren mogen een halve zijn: Date.UTC kapt breuken af, dus eerst naar minuten.
const minuut = (uu: number, mm = 0) => Math.round(uu * 60) + mm;
const iso = (uu: number, mm = 0) =>
  new Date(Date.UTC(2026, 7, 7, 0, minuut(uu, mm) - 120)).toISOString();

const rit = (id: string, chauffeur = "J. Peeters"): Rit => ({
  id, tenantId: "blex", datum: DATUM, chauffeur, charter: false,
  voertuig: {
    kentekenGenormaliseerd: "43BKL7", landcode: "NL",
    omschrijving: "Trekker", capaciteitLaadmeters: 13.6,
  },
});

const taak = (
  id: string, ritId: string, soort: Taak["soort"], plaats: string,
  vanUur: number, totUur: number, venster?: [number, number]
): Taak => ({
  id, tenantId: "blex", ritId, soort,
  adres: {
    naam: `Adres ${plaats}`, plaats, land: "NL",
    tijdvenster: venster ? { van: iso(venster[0]), tot: iso(venster[1]) } : undefined,
  },
  geplandVan: iso(vanUur), geplandTot: iso(totUur),
});

let evTeller = 0;
const ev = (taakId: string, type: TaakEventType, uu: number, mm = 0): TaakEvent => ({
  id: `E-${++evTeller}`, tenantId: "blex", taakId, type,
  tijdstip: iso(uu, mm), wie: "J. Peeters", apparaat: "mobile",
});

function invoerVan(
  ritten: Rit[],
  taken: Taak[],
  events: TaakEvent[] = [],
  over: Partial<TijdbalkInvoer> = {}
): TijdbalkInvoer {
  return {
    datum: DATUM,
    ritten,
    takenVanRit: (ritId) => taken.filter((t) => t.ritId === ritId),
    eventsVanTaak: (taakId) => events.filter((e) => e.taakId === taakId),
    // Synthetische reistijd: 60 minuten tussen verschillende plaatsen.
    reistijdMinuten: (van, naar) => (van === naar ? 0 : 60),
    ...over,
  };
}

describe("bouwTijdbalk", () => {
  it("zet een stop op zijn geplande tijd", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [taak("T1", "R1", "laden", "Venlo", 6, 7)]));
    expect(rij.segmenten).toHaveLength(1);
    expect(rij.segmenten[0]).toMatchObject({
      soort: "laden", vanMinuut: minuut(6), totMinuut: minuut(7), werkelijk: false,
    });
  });

  it("splitst het gat tussen twee stops in rijden en wachten", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "laden", "Venlo", 6, 7),
      taak("T2", "R1", "lossen", "Veghel", 9, 10),
    ]));
    expect(rij.segmenten.map((s) => [s.soort, s.vanMinuut, s.totMinuut])).toEqual([
      ["laden", minuut(6), minuut(7)],
      ["rijden", minuut(7), minuut(8)],
      ["wachten", minuut(8), minuut(9)],
      ["lossen", minuut(9), minuut(10)],
    ]);
  });

  it("laat het wachtblok weg als het gat precies de reistijd is", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "laden", "Venlo", 6, 7),
      taak("T2", "R1", "lossen", "Veghel", 8, 9),
    ]));
    expect(rij.segmenten.map((s) => s.soort)).toEqual(["laden", "rijden", "lossen"]);
  });

  it("meldt te krap plannen en houdt het rijblok binnen het gat", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "laden", "Venlo", 6, 7),
      taak("T2", "R1", "lossen", "Veghel", 7, 8), // geen ruimte om te rijden
    ]));
    expect(rij.knelpunten).toContainEqual({
      soort: "te_krap", minuut: minuut(7), taakId: "T2", minuten: 60,
    });
    expect(rij.segmenten.map((s) => s.soort)).toEqual(["laden", "lossen"]);
  });

  it("gebruikt de werkelijke tijden zodra de stop is afgerond", () => {
    const [rij] = bouwTijdbalk(invoerVan(
      [rit("R1")],
      [taak("T1", "R1", "laden", "Venlo", 6, 7)],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 6, 20), ev("T1", "geladen", 7, 5)]
    ));
    expect(rij.segmenten[0]).toMatchObject({
      vanMinuut: minuut(6, 20), totMinuut: minuut(7, 5), werkelijk: true, status: "afgerond",
    });
  });

  it("houdt een lopende stop open tot minstens het geplande eind", () => {
    const [rij] = bouwTijdbalk(invoerVan(
      [rit("R1")],
      [taak("T1", "R1", "lossen", "Venlo", 6, 7)],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 6, 40)]
    ));
    expect(rij.segmenten[0]).toMatchObject({
      vanMinuut: minuut(6, 40), totMinuut: minuut(7), status: "bezig", werkelijk: true,
    });
  });

  it("laat een vervallen stop helemaal weg", () => {
    const [rij] = bouwTijdbalk(invoerVan(
      [rit("R1")],
      [taak("T1", "R1", "laden", "Venlo", 6, 7), taak("T2", "R1", "lossen", "Veghel", 9, 10)],
      [ev("T2", "taak_aangemaakt", 5), ev("T2", "vervallen", 5, 30)]
    ));
    expect(rij.segmenten.map((s) => s.soort)).toEqual(["laden"]);
  });

  it("neemt het tijdvenster over en meldt te laat lossen", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "lossen", "Veghel", 9, 11, [8, 10]),
    ]));
    expect(rij.segmenten[0].venster).toEqual({ vanMinuut: minuut(8), totMinuut: minuut(10) });
    expect(rij.segmenten[0].buitenVenster).toBe(true);
    expect(rij.knelpunten).toContainEqual({
      soort: "buiten_venster", minuut: minuut(10), taakId: "T1", minuten: 60,
    });
  });

  it("meldt niets als de stop binnen zijn venster valt", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "lossen", "Veghel", 9, 10, [8, 11]),
    ]));
    expect(rij.segmenten[0].buitenVenster).toBe(false);
    expect(rij.knelpunten).toEqual([]);
  });

  it("meldt meer dan vierenhalf uur aaneengesloten rijden", () => {
    // Drie stops ver uit elkaar met steeds 3 uur rijden ertussen, zonder pauze.
    const [rij] = bouwTijdbalk(invoerVan(
      [rit("R1")],
      [
        taak("T1", "R1", "laden", "Venlo", 6, 6.5),
        taak("T2", "R1", "lossen", "Groningen", 9.5, 10),
        taak("T3", "R1", "lossen", "Leeuwarden", 13, 13.5),
      ],
      [],
      { reistijdMinuten: () => 180 }
    ));
    const pauze = rij.knelpunten.find((k) => k.soort === "pauze_overschreden");
    expect(pauze).toBeDefined();
    expect(pauze!.minuten).toBe(90); // 360 gereden - 270 toegestaan
  });

  it("telt de rijtijd opnieuw vanaf nul na een gat van 45 minuten", () => {
    const [rij] = bouwTijdbalk(invoerVan(
      [rit("R1")],
      [
        taak("T1", "R1", "laden", "Venlo", 6, 6.5),
        taak("T2", "R1", "lossen", "Groningen", 10.5, 11),
        taak("T3", "R1", "lossen", "Leeuwarden", 14, 14.5),
      ],
      [],
      { reistijdMinuten: () => 180 }
    ));
    // Tussen T1 en T2 zit 240 min: 180 rijden en 60 wachten. Die 60 minuten
    // resetten het blok, dus de 180 daarna blijven onder de grens.
    expect(rij.knelpunten.filter((k) => k.soort === "pauze_overschreden")).toEqual([]);
  });

  it("telt bezette en wachtende minuten", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "laden", "Venlo", 6, 7),
      taak("T2", "R1", "lossen", "Veghel", 9, 10),
    ]));
    expect(rij.bezetteMinuten).toBe(180); // 60 laden + 60 rijden + 60 lossen
    expect(rij.wachtMinuten).toBe(60);
    expect(rij.vanMinuut).toBe(minuut(6));
    expect(rij.totMinuut).toBe(minuut(10));
  });

  it("laat een rit zonder taken weg uit de balk", () => {
    expect(bouwTijdbalk(invoerVan([rit("R1")], []))).toEqual([]);
  });

  it("zet een nu-streep en het einde van de dienst", () => {
    const [rij] = bouwTijdbalk(invoerVan(
      [rit("R1")],
      [taak("T1", "R1", "laden", "Venlo", 6, 7)],
      [],
      { nu: iso(10, 30), dienstStart: () => iso(5) }
    ));
    expect(rij.markers).toContainEqual({ soort: "nu", minuut: minuut(10, 30) });
    // 12 uur dienst vanaf 05:00 loopt tot 17:00.
    expect(rij.markers).toContainEqual({ soort: "dienst_einde", minuut: minuut(17) });
  });

  it("zet geen dienst-einde zonder ingeklokte chauffeur", () => {
    const [rij] = bouwTijdbalk(invoerVan([rit("R1")], [taak("T1", "R1", "laden", "Venlo", 6, 7)]));
    expect(rij.markers.filter((m) => m.soort === "dienst_einde")).toEqual([]);
  });

  it("houdt ritten strikt gescheiden", () => {
    const rijen = bouwTijdbalk(invoerVan(
      [rit("R1", "Peeters"), rit("R2", "Kowalski")],
      [taak("T1", "R1", "laden", "Venlo", 6, 7), taak("T2", "R2", "laden", "Venlo", 8, 9)]
    ));
    expect(rijen.map((r) => r.chauffeur)).toEqual(["Peeters", "Kowalski"]);
    expect(rijen[0].segmenten).toHaveLength(1);
    expect(rijen[1].segmenten[0].vanMinuut).toBe(minuut(8));
  });
});

describe("balkVenster", () => {
  it("geeft een werkdag als er niets staat", () => {
    expect(balkVenster([])).toEqual({ vanMinuut: minuut(6), totMinuut: minuut(14) });
  });

  it("rekt op naar hele uren met een uur lucht", () => {
    const rijen = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "laden", "Venlo", 2.5, 3),
      taak("T2", "R1", "lossen", "Veghel", 21, 22.5),
    ]));
    const venster = balkVenster(rijen);
    expect(venster.vanMinuut).toBe(minuut(1));
    expect(venster.totMinuut).toBe(minuut(24));
  });

  it("volgt een korte dag in plaats van het hele etmaal te tonen", () => {
    const rijen = bouwTijdbalk(invoerVan([rit("R1")], [taak("T1", "R1", "laden", "Venlo", 10, 11)]));
    expect(balkVenster(rijen)).toEqual({ vanMinuut: minuut(6), totMinuut: minuut(15) });
  });

  it("houdt de streep voor einde dienst binnen beeld", () => {
    const rijen = bouwTijdbalk(invoerVan(
      [rit("R1")], [taak("T1", "R1", "laden", "Venlo", 6, 7)], [],
      { dienstStart: () => iso(5, 30) }
    ));
    // Dienst van 05:30 duurt tot 17:30; die streep moet in het venster passen.
    expect(balkVenster(rijen).totMinuut).toBeGreaterThanOrEqual(minuut(18));
  });

  it("laat de nu-streep van een andere dag het venster niet uitrekken", () => {
    const rijen = bouwTijdbalk(invoerVan(
      [rit("R1")], [taak("T1", "R1", "laden", "Venlo", 9, 10)], [],
      // Nu is de dag ervoor: dat levert een negatieve minuut op.
      { nu: new Date(Date.UTC(2026, 7, 6, 8)).toISOString() }
    ));
    expect(balkVenster(rijen).vanMinuut).toBeGreaterThanOrEqual(0);
  });
});

describe("vrijeGaten", () => {
  const rijen = () => bouwTijdbalk(invoerVan(
    [rit("R1", "Peeters"), rit("R2", "Kowalski")],
    [
      taak("T1", "R1", "laden", "Venlo", 6, 7),
      taak("T2", "R1", "lossen", "Veghel", 11, 12),   // gat van 3 uur
      taak("T3", "R2", "laden", "Venlo", 6, 7),
      taak("T4", "R2", "lossen", "Veghel", 8.5, 9),   // gat van 30 min
    ]
  ));

  it("vindt gaten waar nog werk in past, grootste eerst", () => {
    const gaten = vrijeGaten(rijen(), 60);
    expect(gaten).toHaveLength(1);
    expect(gaten[0]).toMatchObject({ ritId: "R1", chauffeur: "Peeters", minuten: 180 });
  });

  it("laat gaten onder de drempel weg", () => {
    expect(vrijeGaten(rijen(), 240)).toEqual([]);
  });

  it("vindt het kleine gat als de drempel lager staat", () => {
    expect(vrijeGaten(rijen(), 15).map((g) => g.minuten)).toEqual([180, 30]);
  });

  it("rekent de tijd na de laatste stop mee tot einde dienst", () => {
    const metDienst = bouwTijdbalk(invoerVan(
      [rit("R1", "Peeters")],
      [taak("T1", "R1", "laden", "Venlo", 6, 7)],
      [],
      { dienstStart: () => iso(6) }   // dienst tot 18:00
    ));
    const gaten = vrijeGaten(metDienst, 60);
    expect(gaten).toHaveLength(1);
    expect(gaten[0]).toMatchObject({
      soort: "na", vanMinuut: minuut(7), totMinuut: minuut(18), plaats: "Venlo",
    });
  });

  it("zwijgt over de tijd erna als de chauffeur niet is ingeklokt", () => {
    expect(vrijeGaten(rijen(), 60).every((g) => g.soort === "tussen")).toBe(true);
  });
});

describe("balkSamenvatting", () => {
  it("telt ritten, stops en bezetting over het hele bord", () => {
    const rijen = bouwTijdbalk(invoerVan(
      [rit("R1"), rit("R2", "M. Bakker")],
      [
        taak("T1", "R1", "laden", "Venlo", 6, 7),
        taak("T2", "R1", "lossen", "Veghel", 9, 10),
        taak("T3", "R2", "laden", "Venlo", 8, 9),
      ]
    ));
    const samen = balkSamenvatting(rijen);
    expect(samen.ritten).toBe(2);
    expect(samen.stops).toBe(3);
    // R1: 60 + 60 werk + 60 rijden = 180 bezet, 60 wachten. R2: 60 bezet.
    expect(samen.bezetteMinuten).toBe(240);
    expect(samen.wachtMinuten).toBe(60);
    expect(samen.bezettingPct).toBe(80);
  });

  it("geeft nullen terug voor een leeg bord", () => {
    expect(balkSamenvatting([])).toMatchObject({
      ritten: 0, stops: 0, bezettingPct: 0, knelpunten: 0, vrijeMinuten: 0,
    });
  });

  it("telt de ritten zonder knelpunt apart", () => {
    const rijen = bouwTijdbalk(invoerVan(
      [rit("R1"), rit("R2", "M. Bakker")],
      [
        // R1 is te krap: een uur rijden in een half uur.
        taak("T1", "R1", "laden", "Venlo", 6, 7),
        taak("T2", "R1", "lossen", "Veghel", 7.5, 8),
        taak("T3", "R2", "laden", "Venlo", 8, 9),
      ]
    ));
    const samen = balkSamenvatting(rijen);
    expect(samen.knelpunten).toBe(1);
    expect(samen.schoneRitten).toBe(1);
  });

  it("telt alleen gaten die groot genoeg zijn om iets in te plannen", () => {
    const rijen = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "laden", "Venlo", 6, 7),
      taak("T2", "R1", "lossen", "Veghel", 10, 11),
    ]));
    // Gat van 10:00 - 08:00 = 120 minuten wachten na een uur rijden.
    expect(balkSamenvatting(rijen, 60)).toMatchObject({ vrijeGaten: 1, vrijeMinuten: 120 });
    expect(balkSamenvatting(rijen, 180)).toMatchObject({ vrijeGaten: 0, vrijeMinuten: 0 });
  });

  it("geeft het eerste en laatste moment van de dag", () => {
    const rijen = bouwTijdbalk(invoerVan(
      [rit("R1"), rit("R2", "M. Bakker")],
      [taak("T1", "R1", "laden", "Venlo", 6, 7), taak("T2", "R2", "lossen", "Veghel", 14, 15)]
    ));
    expect(balkSamenvatting(rijen)).toMatchObject({
      vroegsteMinuut: minuut(6), laatsteMinuut: minuut(15),
    });
  });
});

describe("knelpuntenLijst", () => {
  it("zet de dringendste bovenaan", () => {
    const rijen = bouwTijdbalk(invoerVan(
      [rit("R1"), rit("R2", "M. Bakker")],
      [
        // R1: te laat op het venster van 08:00-09:00.
        taak("T1", "R1", "lossen", "Veghel", 9.5, 10, [8, 9]),
        // R2: te krap, een uur rijden in een half uur.
        taak("T2", "R2", "laden", "Venlo", 6, 7),
        taak("T3", "R2", "lossen", "Veghel", 7.5, 8),
      ]
    ));
    expect(knelpuntenLijst(rijen).map((k) => [k.soort, k.ritId])).toEqual([
      ["te_krap", "R2"],
      ["buiten_venster", "R1"],
    ]);
  });

  it("hangt chauffeur, kenteken en plaats aan elk knelpunt", () => {
    const rijen = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "lossen", "Veghel", 9.5, 10, [8, 9]),
    ]));
    expect(knelpuntenLijst(rijen)[0]).toMatchObject({
      soort: "buiten_venster", chauffeur: "J. Peeters",
      kentekenGenormaliseerd: "43BKL7", landcode: "NL", plaats: "Veghel", minuten: 60,
    });
  });

  it("vindt de plaats ook bij een knelpunt zonder taak", () => {
    // Vijf uur aaneengesloten rijden zonder gat van 45 minuten.
    const rijen = bouwTijdbalk(invoerVan([rit("R1")], [
      taak("T1", "R1", "laden", "Venlo", 6, 7),
      taak("T2", "R1", "lossen", "Veghel", 10, 10.5),
      taak("T3", "R1", "lossen", "Breda", 14, 14.5),
    ], [], { reistijdMinuten: () => 180 }));
    const pauze = knelpuntenLijst(rijen).find((k) => k.soort === "pauze_overschreden");
    expect(pauze).toBeDefined();
    expect(pauze!.plaats).toBeTruthy();
  });

  it("geeft een lege lijst als er niets misgaat", () => {
    const rijen = bouwTijdbalk(invoerVan([rit("R1")], [taak("T1", "R1", "laden", "Venlo", 6, 7)]));
    expect(knelpuntenLijst(rijen)).toEqual([]);
  });
});

describe("balkTijd", () => {
  it("schrijft minuten sinds middernacht als klok", () => {
    expect(balkTijd(0)).toBe("00:00");
    expect(balkTijd(minuut(6, 5))).toBe("06:05");
    expect(balkTijd(minuut(14.5))).toBe("14:30");
  });

  it("loopt door na middernacht", () => {
    expect(balkTijd(minuut(25))).toBe("01:00");
  });
});
