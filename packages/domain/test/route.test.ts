import { describe, expect, it } from "vitest";
import type { TaakStatus } from "../src/events";
import { controleerVolgorde, hertijden, verplaatsStop } from "../src/route";
import type { Taak } from "../src/types";

const taak = (
  id: string, soort: Taak["soort"], plaats: string, van: string, zendingId?: string
): Taak => ({
  id, tenantId: "blex", ritId: "R-1", soort,
  adres: { naam: plaats, plaats, land: "NL" },
  geplandVan: `2026-08-07T${van}:00Z`,
  geplandTot: `2026-08-07T${van}:30Z`,
  zendingId,
});

// Twee zendingen: A wordt in Venlo geladen en in Veghel gelost, B in Venlo
// geladen en in Helmond gelost.
const route: Taak[] = [
  taak("T1", "laden", "Venlo", "04:00", "Z-A"),
  taak("T2", "laden", "Venlo", "04:30", "Z-B"),
  taak("T3", "lossen", "Veghel", "06:00", "Z-A"),
  taak("T4", "lossen", "Helmond", "08:00", "Z-B"),
];
const allesGepland = (): TaakStatus => "gepland";

describe("volgordecontrole", () => {
  it("keurt een geldige volgorde goed", () => {
    expect(controleerVolgorde(route, allesGepland, route)).toEqual([]);
  });

  it("weigert lossen vóór laden van dezelfde zending", () => {
    const fout = [route[2], route[0], route[1], route[3]]; // T3 vooraan
    const fouten = controleerVolgorde(fout, allesGepland, route);
    expect(fouten).toHaveLength(1);
    expect(fouten[0]).toEqual({ soort: "lossen_voor_laden", taakId: "T3", zendingId: "Z-A" });
  });

  it("staat lossen zonder laadstop op deze rit gewoon toe", () => {
    // De zending stond al op de wagen; er is geen laadstop op deze rit.
    const alGeladen: Taak[] = [
      taak("T9", "lossen", "Veghel", "06:00", "Z-C"),
      taak("T1", "laden", "Venlo", "04:00", "Z-A"),
      taak("T3", "lossen", "Veghel", "07:00", "Z-A"),
    ];
    expect(controleerVolgorde(alGeladen, allesGepland, alGeladen)).toEqual([]);
  });

  it("weigert het verplaatsen van een afgeronde stop", () => {
    const status = (id: string): TaakStatus => (id === "T1" ? "afgerond" : "gepland");
    const fout = [route[1], route[0], route[2], route[3]]; // T1 naar plek 2
    const fouten = controleerVolgorde(fout, status, route);
    expect(fouten.some((f) => f.soort === "afgeronde_stop_verplaatst")).toBe(true);
  });

  it("weigert een afgeronde stop achter een openstaande stop", () => {
    const status = (id: string): TaakStatus => (id === "T3" ? "afgerond" : "gepland");
    const fouten = controleerVolgorde(route, status, route);
    expect(fouten.some((f) => f.soort === "afgeronde_na_open")).toBe(true);
  });

  it("meldt alle fouten tegelijk, niet alleen de eerste", () => {
    const status = (id: string): TaakStatus => (id === "T1" ? "afgerond" : "gepland");
    const fout = [route[2], route[3], route[0], route[1]];
    const fouten = controleerVolgorde(fout, status, route);
    expect(fouten.length).toBeGreaterThan(1);
  });
});

describe("stop verplaatsen", () => {
  it("wisselt twee stops en keurt het resultaat goed", () => {
    const uit = verplaatsStop(route, "T4", "omhoog", allesGepland);
    expect(uit.geldig).toBe(true);
    expect(uit.taken.map((t) => t.id)).toEqual(["T1", "T2", "T4", "T3"]);
  });

  it("laat de oorspronkelijke lijst ongemoeid", () => {
    verplaatsStop(route, "T4", "omhoog", allesGepland);
    expect(route.map((t) => t.id)).toEqual(["T1", "T2", "T3", "T4"]);
  });

  it("weigert een verplaatsing die lossen vóór laden zou zetten", () => {
    // T3 (lossen Z-A) omhoog schuiven langs T2 mag; nog een keer langs T1 niet.
    const stap1 = verplaatsStop(route, "T3", "omhoog", allesGepland);
    expect(stap1.geldig).toBe(true);
    const stap2 = verplaatsStop(stap1.taken, "T3", "omhoog", allesGepland);
    expect(stap2.geldig).toBe(false);
    expect(stap2.fouten[0].soort).toBe("lossen_voor_laden");
  });

  it("doet niets aan de rand van de lijst", () => {
    expect(verplaatsStop(route, "T1", "omhoog", allesGepland).geldig).toBe(false);
    expect(verplaatsStop(route, "T4", "omlaag", allesGepland).geldig).toBe(false);
  });
});

describe("hertijden", () => {
  const reistijd = (van: string, naar: string) => (van === naar ? 0 : 60);

  it("berekent nieuwe tijden vanaf de starttijd", () => {
    const uit = hertijden(route, allesGepland, {
      startIso: "2026-08-07T05:00:00Z", reistijdMinuten: reistijd,
    });
    // T1 Venlo: geen reis, 30 min handelen → 05:00–05:30
    expect(uit[0].geplandVan).toBe("2026-08-07T05:00:00.000Z");
    expect(uit[0].geplandTot).toBe("2026-08-07T05:30:00.000Z");
    // T2 ook Venlo: geen reistijd → 05:30–06:00
    expect(uit[1].geplandVan).toBe("2026-08-07T05:30:00.000Z");
    // T3 Veghel: 60 min reizen → 07:00–07:30
    expect(uit[2].geplandVan).toBe("2026-08-07T07:00:00.000Z");
  });

  it("laat afgeronde stops hun eigen tijden houden", () => {
    const status = (id: string): TaakStatus => (id === "T1" ? "afgerond" : "gepland");
    const uit = hertijden(route, status, {
      startIso: "2026-08-07T05:00:00Z", reistijdMinuten: reistijd,
    });
    expect(uit[0].geplandVan).toBe(route[0].geplandVan);
    expect(uit[0].geplandTot).toBe(route[0].geplandTot);
  });

  it("gebruikt geleerde handelingstijden per plaats", () => {
    const uit = hertijden(route, allesGepland, {
      startIso: "2026-08-07T05:00:00Z",
      reistijdMinuten: reistijd,
      handelingstijdMinuten: (plaats) => (plaats === "Venlo" ? 45 : 30),
    });
    expect(uit[0].geplandTot).toBe("2026-08-07T05:45:00.000Z");
  });
});
