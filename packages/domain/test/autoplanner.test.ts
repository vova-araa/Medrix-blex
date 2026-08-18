import { describe, expect, it } from "vitest";
import { automatischPlan, type PlanKandidaat, type PlanOpdracht } from "../src/autoplanner";
import type { RijtijdStatus } from "../src/rijtijden";

// Synthetische reistijd: 60 min tussen verschillende plaatsen, 0 op dezelfde.
const reistijd = (van: string, naar: string) => (van === naar ? 0 : 60);

const ruim: RijtijdStatus = {
  dagRijMinuten: 60, dagResterendMinuten: 480,
  blokRijMinuten: 60, blokResterendMinuten: 210,
  weekRijMinuten: 600, weekResterendMinuten: 2000,
  pauzeNodig: false,
};

const kandidaat = (
  ritId: string, chauffeur: string, plaats: string,
  extra: Partial<PlanKandidaat> = {}
): PlanKandidaat => ({
  ritId, chauffeur,
  huidigePlaats: plaats,
  beschikbaarVanafIso: "2026-08-07T09:00:00Z",
  resterendeLaadmeters: 10,
  rijtijd: ruim,
  ...extra,
});

const opdracht = (id: string, extra: Partial<PlanOpdracht> = {}): PlanOpdracht => ({
  id, laadmeters: 2, vanPlaats: "Venlo", naarPlaats: "Helmond", ...extra,
});

const NU = { nuIso: "2026-08-07T09:00:00Z", reistijdMinuten: reistijd };

describe("automatischPlan", () => {
  it("kiest de dichtstbijzijnde chauffeur met voldoende rijtijd", () => {
    const resultaat = automatischPlan(
      [opdracht("Z-1")],
      [kandidaat("R-1", "Ver Weg", "Aalsmeer"), kandidaat("R-2", "Dichtbij", "Venlo")],
      NU
    );
    expect(resultaat.voorstellen).toHaveLength(1);
    expect(resultaat.voorstellen[0].chauffeur).toBe("Dichtbij");
    expect(resultaat.voorstellen[0].extraRijMinuten).toBe(60); // alleen beladen rijden
  });

  it("respecteert de laadmetercapaciteit", () => {
    const resultaat = automatischPlan(
      [opdracht("Z-1", { laadmeters: 12 })],
      [kandidaat("R-1", "Klein", "Venlo", { resterendeLaadmeters: 4 })],
      NU
    );
    expect(resultaat.voorstellen).toHaveLength(0);
    expect(resultaat.onplanbaar[0].redenen).toContain("capaciteit");
  });

  it("slaat chauffeurs zonder resterende week-rijtijd over, met reden", () => {
    const bijnaOp: RijtijdStatus = { ...ruim, weekResterendMinuten: 30 };
    const resultaat = automatischPlan(
      [opdracht("Z-1")],
      [kandidaat("R-1", "Weekvol", "Venlo", { rijtijd: bijnaOp })],
      NU
    );
    expect(resultaat.onplanbaar[0].redenen).toContain("weekrijtijd");
  });

  it("calculeert de verplichte pauze in als het rijblok vol raakt", () => {
    const bijnaBlok: RijtijdStatus = { ...ruim, blokResterendMinuten: 30 };
    const resultaat = automatischPlan(
      [opdracht("Z-1")],
      [kandidaat("R-1", "Blokvol", "Venlo", { rijtijd: bijnaBlok })],
      NU
    );
    expect(resultaat.voorstellen[0].pauzeIngepland).toBe(true);
    // 60 min rijden + 30 min laden/lossen + 45 min pauze = aankomst 11:15Z
    expect(resultaat.voorstellen[0].aankomstIso).toBe("2026-08-07T11:15:00.000Z");
  });

  it("weigert een opdracht waarvan het venster niet meer haalbaar is", () => {
    const resultaat = automatischPlan(
      [opdracht("Z-1", { vensterTot: "2026-08-07T09:30:00Z" })],
      [kandidaat("R-1", "Chauffeur", "Venlo")],
      NU
    );
    expect(resultaat.onplanbaar[0].redenen).toContain("venster");
  });

  it("urgente vensters krijgen eerste keus en de kandidaatstand telt door", () => {
    const resultaat = automatischPlan(
      [
        opdracht("Z-ruim", { vensterTot: "2026-08-07T18:00:00Z" }),
        opdracht("Z-krap", { vensterTot: "2026-08-07T11:00:00Z" }),
      ],
      [kandidaat("R-1", "Solo", "Venlo")],
      NU
    );
    // Z-krap wordt als eerste gepland (venster), Z-ruim daarna vanaf de nieuwe stand.
    expect(resultaat.voorstellen[0].opdrachtId).toBe("Z-krap");
    expect(resultaat.voorstellen[1].opdrachtId).toBe("Z-ruim");
    expect(Date.parse(resultaat.voorstellen[1].vertrekIso)).toBeGreaterThan(
      Date.parse(resultaat.voorstellen[0].aankomstIso)
    );
  });

  it("gebruikt geleerde handelingstijden per plaats en benoemt ze in de motivatie", () => {
    const geleerd = (plaats: string) => (plaats === "Venlo" ? 50 : undefined);
    const resultaat = automatischPlan(
      [opdracht("Z-1")],
      [kandidaat("R-1", "Chauffeur", "Venlo")],
      { ...NU, laadLosMinutenVoorPlaats: geleerd }
    );
    // 50 min geleerd laden in Venlo + 60 min rijden = aankomst 10:50Z
    // (standaard 30 min zou 10:30Z geven).
    expect(resultaat.voorstellen[0].aankomstIso).toBe("2026-08-07T10:50:00.000Z");
    expect(resultaat.voorstellen[0].motivatie).toContain("geleerde laadtijd Venlo: 50 min");
  });

  it("balanceert werkdruk: wie bijna aan zijn daggrens zit, krijgt een straf", () => {
    const bijnaOp: RijtijdStatus = { ...ruim, dagResterendMinuten: 100 };
    const resultaat = automatischPlan(
      [opdracht("Z-1", { vanPlaats: "Venlo", naarPlaats: "Helmond" })],
      [
        kandidaat("R-1", "Bijna Op", "Venlo", { rijtijd: bijnaOp }), // 60 min extra, maar straf
        kandidaat("R-2", "Fris", "Helmond", { rijtijd: ruim }),      // 120 min extra, geen straf
      ],
      NU
    );
    expect(resultaat.voorstellen[0].chauffeur).toBe("Fris");
  });
});
