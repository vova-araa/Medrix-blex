import { describe, expect, it } from "vitest";
import { rijtijdStatus, type RijtijdStatus } from "../src/rijtijden";
import { vatSamen, vergelijk, type Referentie } from "../src/vergelijking";

const NU = "2026-08-07T10:00:00Z";
const basis = (over: Partial<RijtijdStatus> = {}): RijtijdStatus => ({
  ...rijtijdStatus({ events: [], nu: NU }),
  dagRijMinuten: 300,
  weekRijMinuten: 1800,
  ...over,
});

const ref = (over: Partial<Referentie> = {}): Referentie => ({
  chauffeur: "J. Peeters",
  datum: "2026-08-07",
  dagRijMinuten: 300,
  weekRijMinuten: 1800,
  overtredingen: [],
  bron: "Roadsoft",
  ...over,
});

describe("vergelijking tijdens het schaduwdraaien", () => {
  it("geeft akkoord als beide systemen hetzelfde zeggen", () => {
    const r = vergelijk(basis(), ref());
    expect(r.verschillen).toHaveLength(0);
    expect(r.akkoord).toBe(true);
  });

  it("meldt een klein tijdsverschil zonder te blokkeren", () => {
    const r = vergelijk(basis({ dagRijMinuten: 303 }), ref());
    expect(r.verschillen[0].soort).toBe("dagrijtijd");
    expect(r.verschillen[0].blokkerend).toBe(false);
    expect(r.akkoord).toBe(true);
  });

  it("blokkeert een tijdsverschil boven de drempel van 5 minuten", () => {
    const r = vergelijk(basis({ dagRijMinuten: 312 }), ref());
    expect(r.verschillen[0].blokkerend).toBe(true);
    expect(r.akkoord).toBe(false);
    expect(r.verschillen[0].sharzi).toBe("5:12");
    expect(r.verschillen[0].referentie).toBe("5:00");
  });

  it("blokkeert altijd als Roadsoft een overtreding meldt die wij missen", () => {
    const r = vergelijk(basis(), ref({ overtredingen: ["weekrijtijd"] }));
    const gemist = r.verschillen.find((v) => v.soort === "overtreding_gemist")!;
    expect(gemist.blokkerend).toBe(true);
    expect(gemist.omschrijving).toContain("Roadsoft meldt");
    expect(r.akkoord).toBe(false);
  });

  it("blokkeert ook als wij een overtreding melden die Roadsoft niet ziet", () => {
    const status = basis({
      overtredingen: [{ code: "pauze", ernst: "overtreding", omschrijving: "pauze verplicht" }],
    });
    const r = vergelijk(status, ref());
    const extra = r.verschillen.find((v) => v.soort === "overtreding_extra")!;
    expect(extra.blokkerend).toBe(true);
    expect(r.akkoord).toBe(false);
  });

  it("telt onze waarschuwingen niet mee als overtreding", () => {
    const status = basis({
      overtredingen: [{ code: "verlengingen", ernst: "waarschuwing", omschrijving: "let op" }],
    });
    expect(vergelijk(status, ref()).akkoord).toBe(true);
  });

  it("meldt afwijkingen op zowel dag als week", () => {
    const r = vergelijk(basis({ dagRijMinuten: 320, weekRijMinuten: 1850 }), ref());
    expect(r.verschillen.map((v) => v.soort)).toEqual(["dagrijtijd", "weekrijtijd"]);
    expect(r.verschillen.every((v) => v.blokkerend)).toBe(true);
  });
});

describe("samenvatting van het schaduwdraaien", () => {
  it("verklaart pas gereed als er vergeleken is én niets blokkeert", () => {
    const schoon = [vergelijk(basis(), ref()), vergelijk(basis({ dagRijMinuten: 302 }), ref())];
    const s = vatSamen(schoon);
    expect(s.totaal).toBe(2);
    expect(s.akkoord).toBe(2);
    expect(s.blokkerend).toBe(0);
    expect(s.gereedVoorOverstap).toBe(true);
  });

  it("verklaart nooit gereed zonder enige vergelijking", () => {
    expect(vatSamen([]).gereedVoorOverstap).toBe(false);
  });

  it("verklaart niet gereed zolang er één blokkerend verschil is", () => {
    const s = vatSamen([
      vergelijk(basis(), ref()),
      vergelijk(basis(), ref({ overtredingen: ["dagrijtijd"] })),
    ]);
    expect(s.blokkerend).toBe(1);
    expect(s.gereedVoorOverstap).toBe(false);
  });
});
