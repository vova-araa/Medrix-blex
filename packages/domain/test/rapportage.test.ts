import { describe, expect, it } from "vitest";
import {
  naarCsv, perAdres, perChauffeur, perDag, perOpdrachtgever, perVoertuig,
  periodeVan, type RapportInvoer,
} from "../src/rapportage";
import type { TaakEvent } from "../src/events";
import type { Order, Rit, Taak, Zending } from "../src/types";

const TENANT = "blex";
const voertuig = (kenteken: string, cap = 13.6) => ({
  kentekenGenormaliseerd: kenteken, landcode: "NL",
  omschrijving: "Trekker + trailer", capaciteitLaadmeters: cap,
});

const rit = (id: string, datum: string, chauffeur: string, kenteken = "43BKL7"): Rit =>
  ({ id, tenantId: TENANT, datum, chauffeur, charter: false, voertuig: voertuig(kenteken) });

const taak = (
  id: string, ritId: string, soort: Taak["soort"], naam: string, plaats: string,
  zendingId: string | undefined, venster?: { van: string; tot: string }
): Taak => ({
  id, tenantId: TENANT, ritId, soort,
  adres: { naam, plaats, land: "NL", tijdvenster: venster },
  zendingId, geplandVan: "2026-08-07T08:00:00Z", geplandTot: "2026-08-07T09:00:00Z",
});

const ev = (taakId: string, type: TaakEvent["type"], tijdstip: string): TaakEvent =>
  ({ id: `${taakId}-${type}`, tenantId: TENANT, taakId, type, tijdstip, wie: "chauffeur", apparaat: "app" });

const zending = (id: string, orderId: string, lm: number, kg: number): Zending => ({
  id, tenantId: TENANT, orderId, barcode: id, laadmeters: lm, gewichtKg: kg,
  omschrijving: "pallets",
  van: { naam: "Depot Venlo", plaats: "Venlo", land: "NL" },
  naar: { naam: "DC Plus", plaats: "Tilburg", land: "NL" },
});

const order = (id: string, opdrachtgever: string): Order =>
  ({ id, tenantId: TENANT, opdrachtgever, referentie: `REF-${id}` });

// Twee dagen, twee chauffeurs, twee opdrachtgevers. Eén stop op tijd, één te laat.
const basis = (): RapportInvoer => ({
  periode: { van: "2026-08-03", tot: "2026-08-09" },
  ritten: [
    rit("R1", "2026-08-07", "J. Peeters", "43BKL7"),
    rit("R2", "2026-08-07", "S. de Boer", "12PGH9"),
    rit("R3", "2026-08-08", "J. Peeters", "43BKL7"),
    rit("R9", "2026-07-30", "J. Peeters", "43BKL7"), // buiten de periode
  ],
  taken: [
    taak("T1", "R1", "laden", "Depot Venlo", "Venlo", "Z1"),
    taak("T2", "R1", "lossen", "DC Plus", "Tilburg", "Z1", { van: "2026-08-07T10:00:00Z", tot: "2026-08-07T12:00:00Z" }),
    taak("T3", "R2", "lossen", "DC Plus", "Tilburg", "Z2", { van: "2026-08-07T10:00:00Z", tot: "2026-08-07T12:00:00Z" }),
    taak("T4", "R3", "lossen", "Jumbo Veghel", "Veghel", "Z3", { van: "2026-08-08T06:00:00Z", tot: "2026-08-08T08:00:00Z" }),
    taak("T9", "R9", "lossen", "DC Plus", "Tilburg", "Z1", { van: "2026-07-30T10:00:00Z", tot: "2026-07-30T12:00:00Z" }),
  ],
  events: [
    ev("T1", "taak_aangemaakt", "2026-08-07T06:00:00Z"), ev("T1", "geladen", "2026-08-07T07:30:00Z"),
    ev("T2", "taak_aangemaakt", "2026-08-07T06:00:00Z"), ev("T2", "gelost", "2026-08-07T11:30:00Z"),
    ev("T3", "taak_aangemaakt", "2026-08-07T06:00:00Z"), ev("T3", "gelost", "2026-08-07T12:45:00Z"),
    ev("T4", "taak_aangemaakt", "2026-08-08T05:00:00Z"),
    ev("T9", "taak_aangemaakt", "2026-07-30T06:00:00Z"), ev("T9", "gelost", "2026-07-30T11:00:00Z"),
  ],
  zendingen: {
    Z1: zending("Z1", "O1", 2.4, 1860),
    Z2: zending("Z2", "O2", 6.0, 9200),
    Z3: zending("Z3", "O1", 5.4, 4100),
  },
  orders: { O1: order("O1", "Bouwmaat"), O2: order("O2", "Steenfabriek") },
  kilometersPerRit: { R1: 180, R2: 95, R3: 210, R9: 500 },
  omzetPerZendingCenten: { Z1: 24500, Z2: 61000, Z3: 39000 },
});

describe("perOpdrachtgever", () => {
  it("telt een zending met laden én lossen maar één keer in lading en omzet", () => {
    const [bouwmaat] = perOpdrachtgever(basis()).filter((r) => r.opdrachtgever === "Bouwmaat");
    expect(bouwmaat.stops).toBe(3);          // T1 laden, T2 lossen, T4 lossen
    expect(bouwmaat.zendingen).toBe(2);      // Z1 en Z3
    expect(bouwmaat.laadmeters).toBeCloseTo(7.8);
    expect(bouwmaat.omzet.bedragCenten).toBe(24500 + 39000);
  });

  it("laat ritten buiten de periode weg", () => {
    const eng = perOpdrachtgever({ ...basis(), periode: { van: "2026-08-07", tot: "2026-08-07" } });
    const bouwmaat = eng.find((r) => r.opdrachtgever === "Bouwmaat")!;
    expect(bouwmaat.zendingen).toBe(1);
    expect(bouwmaat.omzet.bedragCenten).toBe(24500);
  });

  it("rekent punctualiteit alleen over afgeronde stops met een venster", () => {
    const rapport = perOpdrachtgever(basis());
    const bouwmaat = rapport.find((r) => r.opdrachtgever === "Bouwmaat")!;
    // T1 heeft geen venster, T4 is niet afgerond: alleen T2 telt, en die was op tijd.
    expect(bouwmaat.stopsMetVenster).toBe(1);
    expect(bouwmaat.punctualiteitPct).toBe(100);
    const steen = rapport.find((r) => r.opdrachtgever === "Steenfabriek")!;
    expect(steen.punctualiteitPct).toBe(0); // 45 minuten te laat
  });

  it("geeft null als punctualiteit zonder meetbare stops", () => {
    const invoer = basis();
    const zonder = perOpdrachtgever({ ...invoer, events: invoer.events.filter((e) => e.type === "taak_aangemaakt") });
    expect(zonder.every((r) => r.punctualiteitPct === null)).toBe(true);
  });

  it("sorteert op omzet, hoogste eerst", () => {
    expect(perOpdrachtgever(basis()).map((r) => r.opdrachtgever)).toEqual(["Bouwmaat", "Steenfabriek"]);
  });
});

describe("perChauffeur", () => {
  it("telt ritten en gewerkte dagen binnen de periode", () => {
    const peeters = perChauffeur(basis()).find((r) => r.chauffeur === "J. Peeters")!;
    expect(peeters.ritten).toBe(2);        // R9 valt buiten de periode
    expect(peeters.gewerkteDagen).toBe(2);
    expect(peeters.kilometers).toBe(390);
  });

  it("scheidt afgeronde stops van openstaande", () => {
    const peeters = perChauffeur(basis()).find((r) => r.chauffeur === "J. Peeters")!;
    expect(peeters.stops).toBe(3);
    expect(peeters.stopsAfgerond).toBe(2); // T4 staat nog op gepland
  });

  it("laat een rit zonder chauffeur buiten het rapport", () => {
    const invoer = basis();
    const metVrij = { ...invoer, ritten: [...invoer.ritten, rit("R4", "2026-08-07", "")] };
    expect(perChauffeur(metVrij).some((r) => r.chauffeur === "")).toBe(false);
  });
});

describe("perVoertuig", () => {
  it("middelt de benutting over de ritten in plaats van over de laadmeters", () => {
    const bkl = perVoertuig(basis()).find((r) => r.kentekenGenormaliseerd === "43BKL7")!;
    expect(bkl.ritten).toBe(2);
    expect(bkl.geladenLaadmeters).toBeCloseTo(7.8);
    // R1: 2,4/13,6 = 17,6% · R3: 5,4/13,6 = 39,7% → gemiddeld 29%
    expect(bkl.benuttingPct).toBe(29);
  });

  it("telt een zending met twee stops één keer in de belading", () => {
    const bkl = perVoertuig({ ...basis(), periode: { van: "2026-08-07", tot: "2026-08-07" } })
      .find((r) => r.kentekenGenormaliseerd === "43BKL7")!;
    expect(bkl.geladenLaadmeters).toBeCloseTo(2.4); // niet 4,8
  });
});

describe("perAdres", () => {
  it("zet het adres met de meeste te late stops bovenaan", () => {
    const rapport = perAdres(basis());
    expect(rapport[0].naam).toBe("DC Plus");
    expect(rapport[0].teLaat).toBe(1);
    expect(rapport[0].gemiddeldTeLaatMinuten).toBe(45);
    expect(rapport[0].ergsteTeLaatMinuten).toBe(45);
  });

  it("geeft null in plaats van nul als er niets te laat was", () => {
    const veghel = perAdres(basis()).find((r) => r.naam === "Depot Venlo")!;
    expect(veghel.teLaat).toBe(0);
    expect(veghel.gemiddeldTeLaatMinuten).toBeNull();
  });
});

describe("perDag", () => {
  it("geeft één regel per dag, oplopend", () => {
    const dagen = perDag(basis());
    expect(dagen.map((d) => d.datum)).toEqual(["2026-08-07", "2026-08-08"]);
    expect(dagen[0].ritten).toBe(2);
    expect(dagen[0].stops).toBe(3);
    expect(dagen[0].stopsAfgerond).toBe(3);
    expect(dagen[0].kilometers).toBe(275);
    expect(dagen[1].stopsAfgerond).toBe(0);
  });
});

describe("periodeVan", () => {
  const nu = "2026-08-07T10:42:00Z"; // vrijdag

  it("geeft de week van maandag tot en met zondag", () => {
    expect(periodeVan("deze_week", nu)).toEqual({ van: "2026-08-03", tot: "2026-08-09" });
  });

  it("geeft de vorige week", () => {
    expect(periodeVan("vorige_week", nu)).toEqual({ van: "2026-07-27", tot: "2026-08-02" });
  });

  it("geeft de hele maand, ook als die 31 dagen heeft", () => {
    expect(periodeVan("deze_maand", nu)).toEqual({ van: "2026-08-01", tot: "2026-08-31" });
  });

  it("geeft de vorige maand over een jaargrens heen", () => {
    expect(periodeVan("vorige_maand", "2026-01-15T10:00:00Z"))
      .toEqual({ van: "2025-12-01", tot: "2025-12-31" });
  });

  it("rekent met de lokale dag, niet met de UTC-dag", () => {
    // 22:30 UTC op zondag is maandag 00:30 in Amsterdam: dat is een nieuwe week.
    expect(periodeVan("deze_week", "2026-08-09T22:30:00Z").van).toBe("2026-08-10");
  });
});

describe("naarCsv", () => {
  it("scheidt met puntkomma's en gebruikt een decimale komma", () => {
    expect(naarCsv(["naam", "lm"], [["DC Plus", 2.4]])).toBe("naam;lm\r\nDC Plus;2,4");
  });

  it("zet velden met een puntkomma of aanhalingsteken tussen quotes", () => {
    expect(naarCsv(["a"], [['Jansen; Zn "BV"']])).toBe('a\r\n"Jansen; Zn ""BV"""');
  });

  it("laat een lege cel leeg in plaats van null", () => {
    expect(naarCsv(["a", "b"], [["x", null]])).toBe("a;b\r\nx;");
  });
});
