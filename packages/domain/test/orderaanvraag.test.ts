import { describe, expect, it } from "vitest";
import {
  controleerAanvraag, naarOrderEnZending, STANDAARD_GRENZEN,
  type Orderaanvraag,
} from "../src/orderaanvraag";

const NU = "2026-08-07T10:42:00Z"; // vrijdag 12:42 Amsterdam

const goed = (over: Partial<Orderaanvraag> = {}): Orderaanvraag => ({
  opdrachtgever: "Jumbo Supermarkten BV",
  klantreferentie: "PO-88213",
  vanNaam: "Depot Venlo", vanPlaats: "Venlo",
  naarNaam: "DC Jumbo", naarPlaats: "Veghel",
  omschrijving: "12 rolcontainers diepvries",
  laadmeters: 5.4, gewichtKg: 4100,
  datum: "2026-08-10", vensterVan: "06:00", vensterTot: "08:00",
  ...over,
});

describe("controleerAanvraag", () => {
  it("keurt een volledige aanvraag goed", () => {
    expect(controleerAanvraag(goed(), NU)).toEqual({ fouten: [], waarschuwingen: [], mag: true });
  });

  it("eist opdrachtgever, laadadres en losadres", () => {
    const oordeel = controleerAanvraag(
      goed({ opdrachtgever: "  ", vanNaam: "", naarPlaats: "" }), NU
    );
    expect(oordeel.fouten).toEqual(["opdrachtgever_leeg", "laadadres_leeg", "losadres_leeg"]);
    expect(oordeel.mag).toBe(false);
  });

  it("weigert een zending die groter is dan één trailer", () => {
    expect(controleerAanvraag(goed({ laadmeters: 14 }), NU).fouten).toContain("laadmeters_te_groot");
    expect(controleerAanvraag(goed({ laadmeters: 13.6 }), NU).mag).toBe(true);
  });

  it("weigert nul of negatieve laadmeters", () => {
    expect(controleerAanvraag(goed({ laadmeters: 0 }), NU).fouten).toContain("laadmeters_ongeldig");
    expect(controleerAanvraag(goed({ laadmeters: Number.NaN }), NU).fouten).toContain("laadmeters_ongeldig");
  });

  it("weigert meer gewicht dan het laadvermogen", () => {
    expect(controleerAanvraag(goed({ gewichtKg: 27_500 }), NU).fouten).toContain("gewicht_te_zwaar");
    expect(controleerAanvraag(goed({ gewichtKg: 0 }), NU).mag).toBe(true);
    expect(controleerAanvraag(goed({ gewichtKg: -1 }), NU).fouten).toContain("gewicht_ongeldig");
  });

  it("weigert een omgekeerd of ongeldig venster", () => {
    expect(controleerAanvraag(goed({ vensterVan: "16:00", vensterTot: "09:00" }), NU).fouten)
      .toContain("venster_omgekeerd");
    expect(controleerAanvraag(goed({ vensterTot: "25:00" }), NU).fouten).toContain("venster_ongeldig");
  });

  it("waarschuwt bij een venster van een kwartier maar laat het toe", () => {
    const oordeel = controleerAanvraag(goed({ vensterVan: "06:00", vensterTot: "06:15" }), NU);
    expect(oordeel.waarschuwingen).toContain("venster_te_kort");
    expect(oordeel.mag).toBe(true);
  });

  it("weigert een datum in het verleden, lokaal gerekend", () => {
    expect(controleerAanvraag(goed({ datum: "2026-08-06" }), NU).fouten).toContain("datum_verleden");
    // Vandaag mag nog wel — dat wordt alleen een krappe aanmelding.
    const vandaag = controleerAanvraag(goed({ datum: "2026-08-07", vensterVan: "16:00", vensterTot: "18:00" }), NU);
    expect(vandaag.fouten).toEqual([]);
    expect(vandaag.waarschuwingen).toContain("krappe_aanmeldtijd");
  });

  it("waarschuwt onder de aanmeldtijd en zwijgt erboven", () => {
    // Nu is vrijdag 12:42 lokaal. Zaterdag 02:00 ligt 13,3 uur weg: krap.
    expect(controleerAanvraag(goed({ datum: "2026-08-08", vensterVan: "02:00", vensterTot: "04:00" }), NU)
      .waarschuwingen).toContain("krappe_aanmeldtijd");
    // Zaterdag 06:00 ligt 17,3 uur weg en haalt de aanmeldtijd van 16 uur net.
    expect(controleerAanvraag(goed({ datum: "2026-08-08" }), NU).waarschuwingen).toEqual([]);
  });

  it("laat de grenzen per tenant overschrijven", () => {
    const kleineVloot = { ...STANDAARD_GRENZEN, maxLaadmeters: 7.2 };
    expect(controleerAanvraag(goed({ laadmeters: 10 }), NU, kleineVloot).fouten)
      .toContain("laadmeters_te_groot");
  });

  it("waarschuwt niet over aanmeldtijd als de datum al fout is", () => {
    expect(controleerAanvraag(goed({ datum: "2026-08-01" }), NU).waarschuwingen).toEqual([]);
  });
});

describe("naarOrderEnZending", () => {
  const ids = {
    tenantId: "blex", orderId: "o-1", zendingId: "z-1",
    referentie: "ORD-031", barcode: "SHZ-114-031",
  };

  it("zet het lokale venster om naar UTC", () => {
    const { zending } = naarOrderEnZending(goed(), ids);
    expect(zending.naar.tijdvenster).toEqual({
      van: "2026-08-10T04:00:00.000Z", // 06:00 zomertijd
      tot: "2026-08-10T06:00:00.000Z",
    });
  });

  it("houdt de klantreferentie aan als die er is", () => {
    expect(naarOrderEnZending(goed(), ids).order.referentie).toBe("PO-88213");
  });

  it("valt terug op ons eigen ordernummer zonder klantreferentie", () => {
    expect(naarOrderEnZending(goed({ klantreferentie: "  " }), ids).order.referentie).toBe("ORD-031");
  });

  it("trimt namen en plaatsen", () => {
    const { zending } = naarOrderEnZending(goed({ naarNaam: "  DC Jumbo  " }), ids);
    expect(zending.naar.naam).toBe("DC Jumbo");
  });

  it("weigert te raden bij een onbruikbare datum", () => {
    expect(() => naarOrderEnZending(goed({ datum: "morgen" }), ids)).toThrow(/controleer hem eerst/);
  });
});
