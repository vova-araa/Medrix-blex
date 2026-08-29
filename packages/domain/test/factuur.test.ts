import { describe, expect, it } from "vitest";
import { geld } from "../src/geld";
import {
  achterstallig, FACTUUR_REGELS, maakCreditnota, magVerstuurdWorden,
  ontbrekendeGegevens, totalenVan, vervaldatum, volgendFactuurnummer,
  type Factuur, type Uitgever,
} from "../src/factuur";

const uitgever: Uitgever = {
  naam: "Blex Logistics BV",
  adres: "Havenweg 12",
  postcodePlaats: "5928 NX Venlo",
  kvkNummer: "12345678",
  btwNummer: "NL001234567B01",
  iban: "NL00BANK0123456789",
};

const factuur = (over: Partial<Factuur> = {}): Factuur => ({
  nummer: "2026-0001",
  tenantId: "blex",
  ontvanger: { naam: "Jumbo Supermarkten BV", adres: "Rijksweg 15", postcodePlaats: "5462 CE Veghel" },
  datumIso: "2026-08-07T10:00:00Z",
  vervaldatumIso: "2026-09-06T10:00:00Z",
  regels: [{ omschrijving: "Transport Venlo → Veghel", bedrag: geld(13300) }],
  btwBehandeling: "standaard",
  status: "concept",
  ...over,
});

describe("factuurnummering", () => {
  it("begint bij 0001 in een jaar zonder facturen", () => {
    expect(volgendFactuurnummer([], 2026)).toBe("2026-0001");
  });

  it("telt door op het hoogste nummer van dat jaar", () => {
    expect(volgendFactuurnummer(["2026-0001", "2026-0002", "2026-0007"], 2026)).toBe("2026-0008");
  });

  it("houdt jaren gescheiden", () => {
    expect(volgendFactuurnummer(["2025-0042", "2026-0003"], 2026)).toBe("2026-0004");
    expect(volgendFactuurnummer(["2025-0042"], 2026)).toBe("2026-0001");
  });

  it("laat geen gat vallen als er tussendoor genummerd is", () => {
    // Doorlopend betekent: doortellen op het hoogste, niet gaten opvullen.
    expect(volgendFactuurnummer(["2026-0001", "2026-0003"], 2026)).toBe("2026-0004");
  });

  it("negeert nummers die niet op het jaarpatroon lijken", () => {
    expect(volgendFactuurnummer(["concept", "2026-XX", "2026-0005"], 2026)).toBe("2026-0006");
  });
});

describe("btw en totalen", () => {
  it("rekent 21% bij een standaardfactuur", () => {
    const t = totalenVan(factuur());
    expect(t.subtotaal.bedragCenten).toBe(13300);
    expect(t.btw.bedragCenten).toBe(2793);
    expect(t.totaal.bedragCenten).toBe(16093);
  });

  it("rekent 0% bij verlegde btw", () => {
    const t = totalenVan(factuur({ btwBehandeling: "verlegd" }));
    expect(t.btw.bedragCenten).toBe(0);
    expect(t.totaal.bedragCenten).toBe(13300);
  });

  it("berekent de vervaldatum op 30 dagen", () => {
    expect(vervaldatum("2026-08-07T10:00:00Z")).toBe("2026-09-06T10:00:00.000Z");
    expect(FACTUUR_REGELS.standaardBetaaltermijnDagen).toBe(30);
  });
});

describe("wettelijk verplichte gegevens", () => {
  it("laat een volledige factuur door", () => {
    expect(ontbrekendeGegevens(factuur(), uitgever)).toEqual([]);
    expect(magVerstuurdWorden(factuur(), uitgever)).toBe(true);
  });

  it("houdt een factuur zonder nummer tegen", () => {
    expect(ontbrekendeGegevens(factuur({ nummer: null }), uitgever)).toContain("factuurnummer");
  });

  it("houdt een factuur zonder adres van de ontvanger tegen", () => {
    const zonder = factuur({ ontvanger: { naam: "Jumbo Supermarkten BV" } });
    expect(ontbrekendeGegevens(zonder, uitgever)).toContain("ontvanger_adres");
  });

  it("eist KvK- en btw-nummer van de uitgever", () => {
    const gebrekkig = { ...uitgever, kvkNummer: "", btwNummer: "  " };
    const ontbreekt = ontbrekendeGegevens(factuur(), gebrekkig);
    expect(ontbreekt).toContain("uitgever_kvk");
    expect(ontbreekt).toContain("uitgever_btw");
  });

  it("eist het btw-nummer van de ontvanger bij verlegde btw", () => {
    const verlegd = factuur({ btwBehandeling: "verlegd" });
    expect(ontbrekendeGegevens(verlegd, uitgever)).toContain("ontvanger_btw_bij_verlegd");
    const compleet = factuur({
      btwBehandeling: "verlegd",
      ontvanger: { ...factuur().ontvanger, btwNummer: "DE123456789" },
    });
    expect(ontbrekendeGegevens(compleet, uitgever)).toEqual([]);
  });

  it("houdt een factuur zonder regels of zonder omschrijving tegen", () => {
    expect(ontbrekendeGegevens(factuur({ regels: [] }), uitgever)).toContain("regels");
    const leegLabel = factuur({ regels: [{ omschrijving: "", bedrag: geld(100) }] });
    expect(ontbrekendeGegevens(leegLabel, uitgever)).toContain("omschrijving");
  });
});

describe("creditnota", () => {
  it("boekt de bedragen tegen en verwijst naar het origineel", () => {
    const origineel = factuur({ status: "verstuurd" });
    const credit = maakCreditnota(origineel, "2026-0002", "2026-08-20T10:00:00Z");
    expect(credit.crediteertNummer).toBe("2026-0001");
    expect(credit.regels[0].bedrag.bedragCenten).toBe(-13300);
    expect(totalenVan(credit).totaal.bedragCenten).toBe(-16093);
  });

  it("laat het origineel ongewijzigd — een factuur wordt nooit aangepast", () => {
    const origineel = factuur({ status: "verstuurd" });
    maakCreditnota(origineel, "2026-0002", "2026-08-20T10:00:00Z");
    expect(origineel.regels[0].bedrag.bedragCenten).toBe(13300);
    expect(origineel.status).toBe("verstuurd");
  });

  it("kan gedeeltelijk crediteren", () => {
    const origineel = factuur({
      status: "verstuurd",
      regels: [
        { omschrijving: "Transport", bedrag: geld(13300) },
        { omschrijving: "Wachturen", bedrag: geld(1983) },
      ],
    });
    const credit = maakCreditnota(origineel, "2026-0002", "2026-08-20T10:00:00Z", [origineel.regels[1]]);
    expect(credit.regels).toHaveLength(1);
    expect(credit.regels[0].bedrag.bedragCenten).toBe(-1983);
  });

  it("weigert een concept te crediteren — dat pas je gewoon aan", () => {
    expect(() => maakCreditnota(factuur({ nummer: null }), "2026-0002", "2026-08-20T10:00:00Z"))
      .toThrow(/concept/i);
  });
});

describe("openstaande posten", () => {
  const nu = "2026-10-01T10:00:00Z";

  it("meldt alleen verstuurde facturen die over de vervaldatum zijn", () => {
    const posten = achterstallig([
      factuur({ nummer: "2026-0001", status: "verstuurd", vervaldatumIso: "2026-09-06T10:00:00Z" }),
      factuur({ nummer: "2026-0002", status: "betaald", vervaldatumIso: "2026-09-01T10:00:00Z" }),
      factuur({ nummer: "2026-0003", status: "verstuurd", vervaldatumIso: "2026-11-01T10:00:00Z" }),
      factuur({ nummer: null, status: "concept" }),
    ], nu);
    expect(posten.map((p) => p.nummer)).toEqual(["2026-0001"]);
    expect(posten[0].dagenTeLaat).toBe(25);
  });

  it("zet de langst openstaande bovenaan", () => {
    const posten = achterstallig([
      factuur({ nummer: "2026-0001", status: "verstuurd", vervaldatumIso: "2026-09-20T10:00:00Z" }),
      factuur({ nummer: "2026-0002", status: "verstuurd", vervaldatumIso: "2026-08-01T10:00:00Z" }),
    ], nu);
    expect(posten.map((p) => p.nummer)).toEqual(["2026-0002", "2026-0001"]);
  });
});
