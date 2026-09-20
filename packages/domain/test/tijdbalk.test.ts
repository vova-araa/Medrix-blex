import { describe, expect, it } from "vitest";
import { balkVenster, bouwTijdbalk, vrijeGaten, type TijdbalkInvoer } from "../src/tijdbalk";
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
  it("geeft een standaarddag als er niets staat", () => {
    expect(balkVenster([])).toEqual({ vanMinuut: minuut(4), totMinuut: minuut(20) });
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

  it("krimpt nooit onder de standaarddag", () => {
    const rijen = bouwTijdbalk(invoerVan([rit("R1")], [taak("T1", "R1", "laden", "Venlo", 10, 11)]));
    expect(balkVenster(rijen)).toEqual({ vanMinuut: minuut(4), totMinuut: minuut(20) });
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
});
