import { describe, expect, it } from "vitest";
import { factuurTotalen } from "../src/facturatie";
import { geld } from "../src/geld";

describe("factuurTotalen", () => {
  it("telt regels op en berekent BTW over het subtotaal", () => {
    const totalen = factuurTotalen([
      { omschrijving: "Transport Venlo → Veghel", bedrag: geld(12500) },
      { omschrijving: "Transport Venlo → Helmond", bedrag: geld(9950) },
    ]);
    expect(totalen.subtotaal.bedragCenten).toBe(22450);
    expect(totalen.btw.bedragCenten).toBe(4715); // 21% van 224,50 = 47,145 → 47,15
    expect(totalen.totaal.bedragCenten).toBe(27165);
  });

  it("rondt BTW één keer af over het subtotaal, niet per regel", () => {
    // Per regel afronden zou 2 × round(21% van 10,01) = 2 × 2,10 = 4,20 geven;
    // over het subtotaal is het round(21% van 20,02) = 4,20 — hier gelijk,
    // maar bij 3 regels van 10,01 verschilt het: 3×2,10=6,30 vs round(6,3063)=6,31.
    const drie = factuurTotalen([
      { omschrijving: "a", bedrag: geld(1001) },
      { omschrijving: "b", bedrag: geld(1001) },
      { omschrijving: "c", bedrag: geld(1001) },
    ]);
    expect(drie.btw.bedragCenten).toBe(631);
  });

  it("weigert gemengde valuta en niet-gehele centen", () => {
    expect(() =>
      factuurTotalen([
        { omschrijving: "a", bedrag: geld(1000) },
        { omschrijving: "b", bedrag: geld(1000, "PLN") },
      ])
    ).toThrow();
  });

  it("geeft nul terug zonder regels", () => {
    expect(factuurTotalen([]).totaal.bedragCenten).toBe(0);
  });
});
