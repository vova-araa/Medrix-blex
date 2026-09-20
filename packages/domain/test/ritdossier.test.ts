import { describe, expect, it } from "vitest";
import { bouwRitdossier, type DossierInvoer, type DossierTarieven } from "../src/ritdossier";
import type { TaakEvent, TaakEventType } from "../src/events";
import type { Rit, Taak, Zending } from "../src/types";

const iso = (uu: number, mm = 0) => new Date(Date.UTC(2026, 7, 7, uu - 2, mm)).toISOString();

const TARIEVEN: DossierTarieven = {
  vrijeWachtMinuten: 30,
  wachtuurCenten: 4_250,
  kostenPerKmCenten: 95,
  kostenPerUurCenten: 4_200,
};

const rit: Rit = {
  id: "R1", tenantId: "blex", datum: "2026-08-07", chauffeur: "J. Peeters", charter: false,
  voertuig: {
    kentekenGenormaliseerd: "43BKL7", landcode: "NL",
    omschrijving: "Trekker", capaciteitLaadmeters: 13.6,
  },
};

const taak = (
  id: string, soort: Taak["soort"], plaats: string, vanUur: number, totUur: number,
  zendingId?: string, venster?: [number, number]
): Taak => ({
  id, tenantId: "blex", ritId: "R1", soort,
  adres: {
    naam: `DC ${plaats}`, plaats, land: "NL",
    tijdvenster: venster ? { van: iso(venster[0]), tot: iso(venster[1]) } : undefined,
  },
  zendingId, geplandVan: iso(vanUur), geplandTot: iso(totUur),
});

let teller = 0;
const ev = (taakId: string, type: TaakEventType, uu: number, mm = 0): TaakEvent => ({
  id: `E-${++teller}`, tenantId: "blex", taakId, type,
  tijdstip: iso(uu, mm), wie: "J. Peeters", apparaat: "mobile",
});

const zending = (id: string, lm: number): Zending => ({
  id, tenantId: "blex", orderId: "O1", barcode: id,
  laadmeters: lm, gewichtKg: 1000, omschrijving: "pallets",
  van: { naam: "Depot", plaats: "Venlo", land: "NL" },
  naar: { naam: "DC", plaats: "Veghel", land: "NL" },
});

const invoerVan = (
  taken: Taak[], events: TaakEvent[], over: Partial<DossierInvoer> = {}
): DossierInvoer => ({
  rit, taken,
  eventsVanTaak: (taakId) => events.filter((e) => e.taakId === taakId),
  zendingen: { Z1: zending("Z1", 5.4), Z2: zending("Z2", 3.1) },
  vrachtCenten: (id) => (id === "Z1" ? 24_500 : 18_000),
  tarieven: TARIEVEN,
  ...over,
});

describe("bouwRitdossier — stops", () => {
  it("zet gepland naast werkelijk en rekent de afwijking uit", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "laden", "Venlo", 6, 7, "Z1")],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 6, 20), ev("T1", "geladen", 6, 55)]
    ));
    expect(dossier.stops[0]).toMatchObject({
      status: "afgerond",
      aangekomen: iso(6, 20),
      afgerond: iso(6, 55),
      afwijkingMinuten: 20,
      standtijdMinuten: 35,
    });
  });

  it("laat werkelijke tijden leeg zolang er niets geregistreerd is", () => {
    const dossier = bouwRitdossier(invoerVan([taak("T1", "laden", "Venlo", 6, 7)], []));
    expect(dossier.stops[0]).toMatchObject({
      status: "gepland", aangekomen: null, afgerond: null,
      afwijkingMinuten: null, standtijdMinuten: null, wachtMinuten: 0,
    });
  });

  it("rekent alleen standtijd boven de vrije periode als wachturen", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 9, "Z1")],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 8), ev("T1", "gelost", 9, 40)]
    ));
    // 100 minuten stand, 30 vrij → 70 minuten wachturen.
    expect(dossier.stops[0].standtijdMinuten).toBe(100);
    expect(dossier.stops[0].wachtMinuten).toBe(70);
  });

  it("rekent geen wachturen bij een stop binnen de vrije periode", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 9, "Z1")],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 8), ev("T1", "gelost", 8, 25)]
    ));
    expect(dossier.stops[0].wachtMinuten).toBe(0);
  });

  it("oordeelt over het venster alleen als er een venster én een aflevering is", () => {
    const metVenster = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 9, "Z1", [8, 9])],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 8), ev("T1", "gelost", 9, 30)]
    ));
    expect(metVenster.stops[0].binnenVenster).toBe(false);
    expect(metVenster.buitenVenster).toBe(1);

    const zonderVenster = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 9, "Z1")],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "gelost", 9, 30)]
    ));
    expect(zonderVenster.stops[0].binnenVenster).toBeNull();
    expect(zonderVenster.buitenVenster).toBe(0);
  });

  it("telt een vervallen stop niet mee in het totaal", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "laden", "Venlo", 6, 7, "Z1"), taak("T2", "lossen", "Veghel", 8, 9, "Z2")],
      [ev("T2", "taak_aangemaakt", 5), ev("T2", "vervallen", 5, 30)]
    ));
    expect(dossier.totaal).toBe(1);
    expect(dossier.stops).toHaveLength(2); // de regel blijft wel zichtbaar
  });
});

describe("bouwRitdossier — dag", () => {
  const volledig = () => bouwRitdossier(invoerVan(
    [taak("T1", "laden", "Venlo", 6, 7, "Z1"), taak("T2", "lossen", "Veghel", 9, 10, "Z1")],
    [
      ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 6), ev("T1", "geladen", 6, 40),
      ev("T2", "taak_aangemaakt", 5), ev("T2", "aangekomen", 9), ev("T2", "gelost", 10),
    ],
    { kilometers: 180 }
  ));

  it("meet de rit van eerste tot laatste registratie", () => {
    const dossier = volledig();
    expect(dossier.eersteActie).toBe(iso(6));
    expect(dossier.laatsteActie).toBe(iso(10));
    expect(dossier.duurMinuten).toBe(240);
  });

  it("telt afgeronde stops", () => {
    expect(volledig().afgerond).toBe(2);
    expect(volledig().totaal).toBe(2);
  });

  it("telt laadmeters alleen op de losstops", () => {
    // Z1 wordt geladen en gelost; alleen het lossen telt de laadmeters.
    expect(volledig().laadmeters).toBeCloseTo(5.4);
  });

  it("geeft geen duur zonder registraties", () => {
    const dossier = bouwRitdossier(invoerVan([taak("T1", "laden", "Venlo", 6, 7)], []));
    expect(dossier.duurMinuten).toBeNull();
    expect(dossier.eersteActie).toBeNull();
  });
});

describe("bouwRitdossier — geld", () => {
  it("telt vracht per zending één keer, ook bij laden en lossen", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "laden", "Venlo", 6, 7, "Z1"), taak("T2", "lossen", "Veghel", 9, 10, "Z1")],
      [
        ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 6), ev("T1", "geladen", 6, 20),
        ev("T2", "taak_aangemaakt", 5), ev("T2", "aangekomen", 9), ev("T2", "gelost", 9, 20),
      ],
      { kilometers: 100 }
    ));
    expect(dossier.geld.vracht.bedragCenten).toBe(24_500);
  });

  it("telt twee zendingen los op", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 9, "Z1"), taak("T2", "lossen", "Helmond", 10, 11, "Z2")],
      []
    ));
    expect(dossier.geld.vracht.bedragCenten).toBe(24_500 + 18_000);
  });

  it("rekent wachturen tegen het uurtarief", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 10, "Z1")],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 8), ev("T1", "gelost", 9, 30)]
    ));
    // 90 min stand, 30 vrij → 60 min wachturen → precies één uurtarief.
    expect(dossier.geld.wachturen.bedragCenten).toBe(4_250);
    expect(dossier.geld.opbrengst.bedragCenten).toBe(24_500 + 4_250);
  });

  it("rekent kosten uit kilometers en gedraaide uren", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "laden", "Venlo", 6, 7, "Z1"), taak("T2", "lossen", "Veghel", 9, 10, "Z1")],
      [
        ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 6), ev("T1", "geladen", 6, 20),
        ev("T2", "taak_aangemaakt", 5), ev("T2", "aangekomen", 9), ev("T2", "gelost", 10),
      ],
      { kilometers: 180 }
    ));
    expect(dossier.geld.kilometerkosten.bedragCenten).toBe(180 * 95);
    // 06:00 tot 10:00 is vier uur.
    expect(dossier.geld.uurkosten.bedragCenten).toBe(4 * 4_200);
    expect(dossier.geld.kosten.bedragCenten).toBe(180 * 95 + 4 * 4_200);
  });

  it("laat een verliesgevende rit als verlies zien", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 9, "Z2")],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 6), ev("T1", "gelost", 16)],
      { kilometers: 400 }
    ));
    expect(dossier.geld.saldo.bedragCenten).toBeLessThan(0);
    expect(dossier.geld.margePct).toBeLessThan(0);
  });

  it("rekent geen kilometerkosten zonder kilometerstand", () => {
    const dossier = bouwRitdossier(invoerVan([taak("T1", "lossen", "Veghel", 8, 9, "Z1")], []));
    expect(dossier.kilometers).toBeNull();
    expect(dossier.geld.kilometerkosten.bedragCenten).toBe(0);
  });

  it("geeft geen marge bij nul opbrengst", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "emballage_retour", "Venlo", 11, 12)], []
    ));
    expect(dossier.geld.opbrengst.bedragCenten).toBe(0);
    expect(dossier.geld.margePct).toBeNull();
  });

  it("telt de marge als percentage van de opbrengst", () => {
    const dossier = bouwRitdossier(invoerVan(
      [taak("T1", "lossen", "Veghel", 8, 9, "Z1")],
      [ev("T1", "taak_aangemaakt", 5), ev("T1", "aangekomen", 8), ev("T1", "gelost", 9)],
      { kilometers: 100 }
    ));
    const { opbrengst, kosten, saldo, margePct } = dossier.geld;
    expect(saldo.bedragCenten).toBe(opbrengst.bedragCenten - kosten.bedragCenten);
    expect(margePct).toBe(Math.round((saldo.bedragCenten / opbrengst.bedragCenten) * 100));
  });
});
