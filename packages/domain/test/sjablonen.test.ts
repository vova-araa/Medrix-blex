import { describe, expect, it } from "vitest";
import { SJABLONEN, sjabloonVan, vulSjabloon } from "../src/sjablonen";

describe("mailsjablonen", () => {
  it("vult alle variabelen in", () => {
    const uit = vulSjabloon(sjabloonVan("factuur_versturen"), {
      contactpersoon: "R. van den Berg",
      factuurnummer: "2026-0001",
      datum: "7 augustus 2026",
      totaal: "€ 160,93",
      vervaldatum: "6 september 2026",
      ons: "Blex Logistics BV",
    });
    expect(uit.ontbrekend).toEqual([]);
    expect(uit.onderwerp).toBe("Factuur 2026-0001 van Blex Logistics BV");
    expect(uit.tekst).toContain("Beste R. van den Berg,");
    expect(uit.tekst).toContain("€ 160,93");
    expect(uit.tekst).not.toContain("{");
  });

  it("laat een ontbrekende variabele zichtbaar staan in plaats van leeg", () => {
    const uit = vulSjabloon(sjabloonVan("factuur_versturen"), {
      factuurnummer: "2026-0001", ons: "Blex Logistics BV",
    });
    expect(uit.tekst).toContain("{contactpersoon}");
    expect(uit.tekst).not.toContain("Beste ,");
    expect(uit.ontbrekend).toContain("contactpersoon");
    expect(uit.ontbrekend).toContain("totaal");
  });

  it("behandelt een lege string als ontbrekend", () => {
    const uit = vulSjabloon(sjabloonVan("vertraging_melden"), {
      contactpersoon: "   ", zending: "SHZ-1", eta: "14:20", ons: "Blex",
    });
    expect(uit.ontbrekend).toEqual(["contactpersoon"]);
  });

  it("accepteert getallen", () => {
    const uit = vulSjabloon(sjabloonVan("betalingsherinnering"), {
      contactpersoon: "K. van Dijk", factuurnummer: "2026-0002", datum: "1 juli",
      totaal: "€ 500,00", vervaldatum: "31 juli", dagenTeLaat: 25, ons: "Blex",
    });
    expect(uit.tekst).toContain("25 dagen open");
    expect(uit.ontbrekend).toEqual([]);
  });

  it("kent elk sjabloon zijn eigen variabelenlijst toe die klopt met de tekst", () => {
    for (const sjabloon of SJABLONEN) {
      const gebruikt = new Set(
        [...`${sjabloon.onderwerp} ${sjabloon.tekst}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
      );
      expect([...gebruikt].sort()).toEqual([...sjabloon.variabelen].sort());
    }
  });

  it("weigert een onbekend sjabloon in plaats van undefined terug te geven", () => {
    // @ts-expect-error — bewust een onbekende id
    expect(() => sjabloonVan("bestaat_niet")).toThrow(/Onbekend mailsjabloon/);
  });
});
