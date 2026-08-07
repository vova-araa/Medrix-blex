import { describe, expect, it } from "vitest";
import {
  emballageSaldi,
  maakCorrectie,
  type EmballageSoort,
  type EmballageTransactie,
} from "../src/emballage";

let teller = 0;
const tx = (
  klant: string,
  soort: EmballageSoort,
  geleverd: number,
  retour: number
): EmballageTransactie => ({
  id: `ET-${String(++teller).padStart(4, "0")}`,
  tenantId: "blex",
  klant,
  soort,
  geleverd,
  retour,
  tijdstip: `2026-08-07T${String(4 + (teller % 12)).padStart(2, "0")}:00:00Z`,
  wie: "test",
});

describe("emballageSaldi", () => {
  it("berekent saldo als geleverd minus retour", () => {
    const saldi = emballageSaldi([
      tx("Jumbo", "europallet", 26, 0),
      tx("Jumbo", "europallet", 0, 20),
      tx("Jumbo", "rolcontainer", 12, 0),
    ]);
    expect(saldi["Jumbo"].europallet).toBe(6);
    expect(saldi["Jumbo"].rolcontainer).toBe(12);
  });

  it("houdt klanten strikt gescheiden", () => {
    const saldi = emballageSaldi([
      tx("Jumbo", "europallet", 10, 0),
      tx("Plus", "europallet", 4, 0),
    ]);
    expect(saldi["Jumbo"].europallet).toBe(10);
    expect(saldi["Plus"].europallet).toBe(4);
  });

  it("een correctie is een tegenboeking, geen mutatie", () => {
    const fout = tx("Jumbo", "fust", 40, 0);
    const correctie = maakCorrectie(fout, "ET-corr", "2026-08-07T09:00:00Z", "admin");
    const saldi = emballageSaldi([fout, correctie, tx("Jumbo", "fust", 35, 0)]);
    expect(saldi["Jumbo"].fust).toBe(35);
    expect(correctie.id).not.toBe(fout.id);
  });

  it("saldo klopt na 200 gemengde transacties inclusief correcties en retouren (§14)", () => {
    const klanten = ["Jumbo", "Plus", "De Kroon", "Van Dijk"];
    const soorten: EmballageSoort[] = ["europallet", "rolcontainer", "fust", "kist"];
    const transacties: EmballageTransactie[] = [];
    const verwacht: Record<string, Record<string, number>> = {};

    // Deterministische pseudo-random reeks zodat de test reproduceerbaar is.
    let zaad = 42;
    const volgende = () => (zaad = (zaad * 1103515245 + 12345) % 2 ** 31);

    for (let i = 0; i < 180; i++) {
      const klant = klanten[volgende() % klanten.length];
      const soort = soorten[volgende() % soorten.length];
      const geleverd = volgende() % 30;
      const retour = volgende() % 30;
      transacties.push(tx(klant, soort, geleverd, retour));
      const perKlant = (verwacht[klant] ??= {});
      perKlant[soort] = (perKlant[soort] ?? 0) + geleverd - retour;
    }
    // 20 correcties op willekeurige eerdere transacties.
    for (let i = 0; i < 20; i++) {
      const origineel = transacties[volgende() % 180];
      const correctie = maakCorrectie(origineel, `ET-c${i}`, "2026-08-07T20:00:00Z", "admin");
      transacties.push(correctie);
      const perKlant = verwacht[origineel.klant];
      perKlant[origineel.soort] =
        (perKlant[origineel.soort] ?? 0) - origineel.geleverd + origineel.retour;
    }

    expect(transacties).toHaveLength(200);
    const saldi = emballageSaldi(transacties);
    for (const klant of klanten) {
      for (const soort of soorten) {
        expect(saldi[klant]?.[soort] ?? 0).toBe(verwacht[klant]?.[soort] ?? 0);
      }
    }
  });

  it("weigert niet-gehele aantallen", () => {
    expect(() => emballageSaldi([{ ...tx("Jumbo", "kist", 1, 0), geleverd: 1.5 }])).toThrow();
  });
});
