import { describe, expect, it } from "vitest";
import {
  boekTransactie, emballageStand, langOpenstaand, maakCorrectie,
  STANDAARD_STATIEGELD, type EmballageSoort, type EmballageTransactie,
} from "../src/emballage";

const NU = "2026-08-07T10:00:00Z";
let teller = 0;
const tx = (
  klant: string, soort: EmballageSoort, geleverd: number, retour: number, dag: string
): EmballageTransactie => ({
  id: `E-${++teller}`, tenantId: "blex", klant, soort, geleverd, retour,
  tijdstip: `${dag}T08:00:00Z`, wie: "chauffeur",
});

describe("emballageStand", () => {
  it("houdt het saldo gelijk aan geleverd min retour", () => {
    const [stand] = emballageStand([
      tx("Jumbo", "europallet", 26, 0, "2026-08-01"),
      tx("Jumbo", "europallet", 0, 20, "2026-08-05"),
    ], NU);
    expect(stand.standen[0].saldo).toBe(6);
  });

  it("laat een retour de oudste levering aflossen, niet de nieuwste", () => {
    // 10 op 1 juli, 10 op 1 augustus, 10 terug: de partij van juli is weg.
    const [stand] = emballageStand([
      tx("Jumbo", "europallet", 10, 0, "2026-07-01"),
      tx("Jumbo", "europallet", 10, 0, "2026-08-01"),
      tx("Jumbo", "europallet", 0, 10, "2026-08-06"),
    ], NU);
    expect(stand.standen[0].saldo).toBe(10);
    expect(stand.standen[0].oudsteOpenstaand).toBe("2026-08-01T08:00:00Z");
    expect(stand.standen[0].ouderdomDagen).toBe(6);
  });

  it("lost een levering gedeeltelijk af en houdt de rest op de oude datum", () => {
    const [stand] = emballageStand([
      tx("Jumbo", "europallet", 10, 0, "2026-07-01"),
      tx("Jumbo", "europallet", 0, 4, "2026-08-06"),
    ], NU);
    expect(stand.standen[0].saldo).toBe(6);
    expect(stand.standen[0].oudsteOpenstaand).toBe("2026-07-01T08:00:00Z");
    expect(stand.standen[0].ouderdomDagen).toBe(37);
  });

  it("geeft geen ouderdom als er niets openstaat", () => {
    const [stand] = emballageStand([
      tx("Jumbo", "europallet", 8, 8, "2026-08-01"),
    ], NU);
    expect(stand.standen[0].saldo).toBe(0);
    expect(stand.standen[0].ouderdomDagen).toBeNull();
    expect(stand.langstOpenstaandDagen).toBeNull();
  });

  it("kan een negatief saldo aan: wij staan bij de klant in het krijt", () => {
    const [stand] = emballageStand([
      tx("Jumbo", "europallet", 5, 0, "2026-08-01"),
      tx("Jumbo", "europallet", 0, 12, "2026-08-05"),
    ], NU);
    expect(stand.standen[0].saldo).toBe(-7);
    expect(stand.standen[0].ouderdomDagen).toBeNull();
    // Een negatief saldo is geen waarde die wij tegoed hebben.
    expect(stand.standen[0].waarde.bedragCenten).toBe(0);
    expect(stand.totaalOpenstaand).toBe(0);
  });

  it("rekent de waarde met het statiegeld per soort", () => {
    const [stand] = emballageStand([
      tx("Jumbo", "europallet", 10, 0, "2026-08-01"),
      tx("Jumbo", "rolcontainer", 4, 0, "2026-08-01"),
    ], NU);
    expect(stand.waarde.bedragCenten).toBe(
      10 * STANDAARD_STATIEGELD.europallet + 4 * STANDAARD_STATIEGELD.rolcontainer
    );
    expect(stand.waarde.valuta).toBe("EUR");
  });

  it("laat het statiegeld per klantafspraak overschrijven", () => {
    const [stand] = emballageStand(
      [tx("Jumbo", "europallet", 10, 0, "2026-08-01")], NU, { europallet: 1_800 }
    );
    expect(stand.waarde.bedragCenten).toBe(18_000);
  });

  it("neemt de langste ouderdom over alle soorten", () => {
    const [stand] = emballageStand([
      tx("Jumbo", "europallet", 5, 0, "2026-08-05"),
      tx("Jumbo", "fust", 40, 0, "2026-06-10"),
    ], NU);
    expect(stand.langstOpenstaandDagen).toBe(58);
  });

  it("sorteert transacties zelf, ook als ze door elkaar binnenkomen", () => {
    const doorElkaar = [
      tx("Jumbo", "europallet", 0, 10, "2026-08-06"),
      tx("Jumbo", "europallet", 10, 0, "2026-07-01"),
      tx("Jumbo", "europallet", 10, 0, "2026-08-01"),
    ];
    const [stand] = emballageStand(doorElkaar, NU);
    expect(stand.standen[0].oudsteOpenstaand).toBe("2026-08-01T08:00:00Z");
  });

  it("laat de meegegeven lijst met rust", () => {
    const lijst = [tx("Jumbo", "europallet", 10, 0, "2026-08-01")];
    const kopie = JSON.stringify(lijst);
    emballageStand(lijst, NU);
    expect(JSON.stringify(lijst)).toBe(kopie);
  });

  it("noemt alleen soorten waarin daadwerkelijk is bewogen", () => {
    const [stand] = emballageStand([tx("Jumbo", "kist", 3, 0, "2026-08-01")], NU);
    expect(stand.standen.map((s) => s.soort)).toEqual(["kist"]);
  });

  it("weigert halve pallets", () => {
    expect(() => emballageStand([tx("Jumbo", "europallet", 2.5, 0, "2026-08-01")], NU))
      .toThrow(/gehele getallen/);
  });

  it("verwerkt een correctie als een gewone tegenboeking", () => {
    const fout = tx("Jumbo", "europallet", 26, 0, "2026-08-01");
    const correctie = maakCorrectie(fout, "E-corr", "2026-08-02T09:00:00Z", "administratie");
    const [stand] = emballageStand([fout, correctie], NU);
    expect(stand.standen[0].saldo).toBe(0);
    expect(stand.standen[0].ouderdomDagen).toBeNull();
  });
});

describe("langOpenstaand", () => {
  const standen = emballageStand([
    tx("Oud", "europallet", 10, 0, "2026-05-01"),
    tx("Recent", "europallet", 10, 0, "2026-08-05"),
    tx("Middel", "europallet", 10, 0, "2026-07-01"),
    tx("Vereffend", "europallet", 10, 10, "2026-01-01"),
  ], NU);

  it("houdt alleen klanten boven de drempel over", () => {
    expect(langOpenstaand(standen, 30).map((s) => s.klant)).toEqual(["Oud", "Middel"]);
  });

  it("laat een vereffende klant buiten de lijst", () => {
    expect(langOpenstaand(standen, 0).map((s) => s.klant)).not.toContain("Vereffend");
  });
});

describe("boekTransactie", () => {
  const basis = {
    id: "E-100", tenantId: "blex", klant: "Jumbo",
    soort: "europallet" as EmballageSoort, tijdstip: NU, wie: "depot",
  };

  it("boekt een levering met rit", () => {
    const t = boekTransactie({ ...basis, geleverd: 12, retour: 0, ritId: "R-1" });
    expect(t.ritId).toBe("R-1");
    expect(t.geleverd).toBe(12);
  });

  it("laat ritId weg als er geen rit is", () => {
    expect("ritId" in boekTransactie({ ...basis, geleverd: 0, retour: 5 })).toBe(false);
  });

  it("weigert negatieve aantallen", () => {
    expect(() => boekTransactie({ ...basis, geleverd: -1, retour: 0 }))
      .toThrow(/negatieve aantallen/);
  });

  it("weigert een lege boeking", () => {
    expect(() => boekTransactie({ ...basis, geleverd: 0, retour: 0 }))
      .toThrow(/zonder beweging/);
  });

  it("weigert halve aantallen", () => {
    expect(() => boekTransactie({ ...basis, geleverd: 1.5, retour: 0 }))
      .toThrow(/gehele getallen/);
  });
});
