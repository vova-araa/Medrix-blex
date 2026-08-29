import { describe, expect, it } from "vitest";
import { rijtijdStatus, type RijtijdStatus } from "../src/rijtijden";
import { zoekVervanging, type UitgevallenRit, type VervangKandidaat } from "../src/vervanging";

const NU = "2026-08-07T10:00:00Z";
// Synthetische reistijd: 30 min tussen verschillende plaatsen, 0 op dezelfde.
const reistijd = (van: string, naar: string) => (van === naar ? 0 : 30);
const opties = { nuIso: NU, reistijdMinuten: reistijd };

const ruim: RijtijdStatus = {
  ...rijtijdStatus({ events: [], nu: NU }),
  dagResterendMinuten: 300,
  dagResterendMetVerlengingMinuten: 360,
  weekResterendMinuten: 900,
  tweeWekenResterendMinuten: 900,
  dienstResterendMinuten: 600,
  weekArbeidResterendMinuten: 900,
  blokResterendMinuten: 270,
  verlengingenOver: 2,
};

const kandidaat = (
  chauffeur: string, plaats: string, extra: Partial<VervangKandidaat> = {}
): VervangKandidaat => ({
  chauffeur,
  ritId: `R-${chauffeur}`,
  huidigePlaats: plaats,
  beschikbaarVanafIso: NU,
  resterendeLaadmeters: 10,
  rijtijd: ruim,
  heeftEigenRit: false,
  ...extra,
});

const rit: UitgevallenRit = {
  ritId: "R-260807-02",
  chauffeur: "M. Kowalski",
  startPlaats: "Lieshout",
  resterendeRijMinuten: 120,
  laadmeters: 4,
};

describe("zoekVervanging", () => {
  it("kiest de dichtstbijzijnde chauffeur met genoeg rijtijd", () => {
    const r = zoekVervanging(rit, [
      kandidaat("Ver Weg", "Aalsmeer"),
      kandidaat("Dichtbij", "Lieshout"),
    ], opties);
    expect(r.voorstellen[0].chauffeur).toBe("Dichtbij");
    expect(r.voorstellen[0].aanrijMinuten).toBe(0);
    expect(r.voorstellen[0].totaalExtraRijMinuten).toBe(120);
  });

  it("laat de uitgevallen chauffeur zelf buiten beschouwing", () => {
    const r = zoekVervanging(rit, [
      kandidaat("M. Kowalski", "Lieshout"),
      kandidaat("Ander", "Venlo"),
    ], opties);
    expect(r.voorstellen.map((v) => v.chauffeur)).toEqual(["Ander"]);
  });

  it("markeert extra werk als de chauffeur al een eigen rit heeft", () => {
    const r = zoekVervanging(rit, [kandidaat("Bezet", "Lieshout", { heeftEigenRit: true })], opties);
    expect(r.voorstellen[0].soort).toBe("extra");
    expect(r.voorstellen[0].motivatie.join(" ")).toContain("naast zijn eigen rit");
  });

  it("wijst af op laadmetercapaciteit als de rit erbij komt, met reden", () => {
    const r = zoekVervanging(
      { ...rit, laadmeters: 12 },
      [kandidaat("Klein", "Lieshout", { resterendeLaadmeters: 8, heeftEigenRit: true })],
      opties
    );
    expect(r.voorstellen).toHaveLength(0);
    expect(r.afgewezen[0].redenen).toContain("capaciteit");
  });

  it("wijst af wie geen weekrijtijd meer heeft, met reden", () => {
    const r = zoekVervanging(rit, [
      kandidaat("Weekvol", "Lieshout", {
        rijtijd: { ...ruim, weekResterendMinuten: 30 },
      }),
    ], opties);
    expect(r.afgewezen[0].redenen).toContain("weekrijtijd");
  });

  it("geeft voorrang aan wie het binnen 9 uur redt boven wie moet verlengen", () => {
    const r = zoekVervanging(rit, [
      // Dichtbij, maar past alleen met verlenging naar 10 uur.
      kandidaat("Moet Verlengen", "Lieshout", {
        rijtijd: { ...ruim, dagResterendMinuten: 60, dagResterendMetVerlengingMinuten: 120 },
      }),
      // Verder weg, maar ruim binnen de normale dagrijtijd.
      kandidaat("Ruim In Tijd", "Venlo"),
    ], opties);
    expect(r.voorstellen[0].chauffeur).toBe("Ruim In Tijd");
    const verlenger = r.voorstellen.find((v) => v.chauffeur === "Moet Verlengen");
    expect(verlenger?.vereistVerlenging).toBe(true);
    expect(verlenger?.motivatie.join(" ")).toContain("verlengde rijdag van 10 uur");
  });

  it("calculeert een verplichte pauze in de aankomsttijd in", () => {
    const r = zoekVervanging(rit, [
      kandidaat("Blokvol", "Lieshout", { rijtijd: { ...ruim, blokResterendMinuten: 30 } }),
    ], opties);
    expect(r.voorstellen[0].vereistPauze).toBe(true);
    // 10:00 + 120 min rit + 45 min pauze = 12:45Z
    expect(r.voorstellen[0].aankomstIso).toBe("2026-08-07T12:45:00.000Z");
  });

  it("wijst af als het tijdvenster niet meer haalbaar is", () => {
    const r = zoekVervanging(
      { ...rit, vensterTotIso: "2026-08-07T11:00:00Z" },
      [kandidaat("Te Laat", "Venlo")],
      opties
    );
    expect(r.afgewezen[0].redenen).toContain("venster");
  });

  it("meldt hoeveel ruimte er na afloop overblijft", () => {
    const r = zoekVervanging(rit, [kandidaat("Kandidaat", "Lieshout")], opties);
    expect(r.voorstellen[0].restRuimte.dagMinuten).toBe(180); // 300 − 120
    expect(r.voorstellen[0].restRuimte.weekMinuten).toBe(780); // 900 − 120
    expect(r.voorstellen[0].motivatie.join(" ")).toContain("3:00 dagrijtijd");
  });

  it("levert een lege lijst met redenen op als niemand kan", () => {
    const r = zoekVervanging(rit, [
      kandidaat("Op", "Lieshout", {
        rijtijd: { ...ruim, dagResterendMinuten: 10, dagResterendMetVerlengingMinuten: 10 },
      }),
    ], opties);
    expect(r.voorstellen).toHaveLength(0);
    expect(r.afgewezen[0].redenen).toContain("dagrijtijd");
  });
});

describe("zoekVervanging — overname van een vastgelopen wagen", () => {
  it("eist geen eigen laadruimte van wie het voertuig overneemt", () => {
    // De lading staat al op de vastgelopen wagen; een vervanger rijdt die mee.
    const r = zoekVervanging(
      { ...rit, laadmeters: 12 },
      [kandidaat("Vrij", "Lieshout", { resterendeLaadmeters: 0, heeftEigenRit: false })],
      opties
    );
    expect(r.voorstellen).toHaveLength(1);
    expect(r.voorstellen[0].soort).toBe("vervanging");
  });

  it("eist wél laadruimte van wie het naast zijn eigen rit erbij doet", () => {
    const r = zoekVervanging(
      { ...rit, laadmeters: 12 },
      [kandidaat("Bezet", "Lieshout", { resterendeLaadmeters: 4, heeftEigenRit: true })],
      opties
    );
    expect(r.voorstellen).toHaveLength(0);
    expect(r.afgewezen[0].redenen).toContain("capaciteit");
  });

  it("wijst niemand af op een venster dat al verstreken is", () => {
    const r = zoekVervanging(
      { ...rit, vensterTotIso: "2026-08-07T08:00:00Z" }, // nu = 10:00Z
      [kandidaat("Kandidaat", "Lieshout")],
      opties
    );
    expect(r.voorstellen).toHaveLength(1);
    expect(r.voorstellen[0].vensterAlVerstreken).toBe(true);
    expect(r.voorstellen[0].motivatie.join(" ")).toContain("al verstreken");
  });

  it("wijst nog steeds af op een venster dat wél haalbaar had moeten zijn", () => {
    const r = zoekVervanging(
      { ...rit, vensterTotIso: "2026-08-07T11:00:00Z" }, // rit duurt 2 u vanaf 10:00
      [kandidaat("Te Laat", "Venlo")],
      opties
    );
    expect(r.afgewezen[0].redenen).toContain("venster");
  });
});
