import { describe, expect, it } from "vitest";
import { uitleesStatussen } from "@sharzi/domain";
import { FIXTURE_DAG, mapActiviteit, verwerkAntwoord } from "../src";

// Contract tests tegen de vastgelegde fixture — nooit tegen een live API (§6).
const stand = verwerkAntwoord(FIXTURE_DAG);

describe("tacho-connector: contract", () => {
  it("vertaalt tachograafcategorieën naar onze activiteitsoorten", () => {
    const soorten = stand.activiteiten.map((a) => a.soort);
    expect(soorten).toEqual(["rust", "rijden", "werk", "rijden", "beschikbaar"]);
  });

  it("normaliseert kentekens zoals het domein dat verwacht", () => {
    expect(stand.activiteiten[0].kentekenGenormaliseerd).toBe("43BKL7");
  });

  it("merkt elke uitgelezen activiteit als bron tachograaf", () => {
    expect(stand.activiteiten.every((a) => a.bron === "tachograaf")).toBe(true);
  });

  it("laat een lopende activiteit open in plaats van hem af te ronden", () => {
    const lopend = stand.activiteiten.find((a) => a.totIso === null);
    expect(lopend?.soort).toBe("rijden");
  });

  it("telt activiteiten zonder chauffeurskaart apart in plaats van ze toe te wijzen", () => {
    expect(stand.zonderKaart).toBe(1);
    const zonder = stand.activiteiten.find((a) => a.chauffeur === null);
    expect(zonder?.kentekenGenormaliseerd).toBe("66KLM2");
  });

  it("weigert een onbekende activiteitscode in plaats van hem stil te laten vallen", () => {
    expect(() => mapActiviteit({
      driverCardNumber: null, driverName: null,
      vehicleRegistration: "43-BKL-7",
      activity: "IETS_NIEUWS",
      startUtc: "2026-08-07T05:00:00Z", endUtc: null,
    })).toThrow(/Onbekende tachograaf-activiteit/);
  });

  it("levert het ophaalmoment mee zodat een oude stand herkenbaar is", () => {
    expect(stand.opgehaaldOp).toBe("2026-08-07T10:42:00Z");
  });

  it("mapt uitlezingen met soort, onderwerp en bestandsnaam", () => {
    const voertuig = stand.uitlezingen.find((u) => u.soort === "voertuig");
    expect(voertuig?.kentekenGenormaliseerd).toBe("43BKL7");
    expect(voertuig?.bestandsnaam).toBe("M_20260709_0015_43BKL7.ddd");
  });

  it("laat de termijnbewaking een verstreken chauffeurskaart zien", () => {
    const statussen = uitleesStatussen(
      stand.uitlezingen,
      { kentekens: ["43BKL7"], chauffeurs: ["J. Peeters", "M. Kowalski"] },
      "2026-08-07T10:42:00Z"
    );
    const kowalski = statussen.find((s) => s.onderwerp === "M. Kowalski")!;
    expect(kowalski.ernst).toBe("verstreken");
    // Uitgelezen op 8 juli 18:20Z, nu 7 aug 10:42Z = 29 dagen; termijn is 28.
    expect(kowalski.dagenGeleden).toBe(29);
    expect(kowalski.dagenResterend).toBe(-1);
    const peeters = statussen.find((s) => s.onderwerp === "J. Peeters")!;
    expect(peeters.ernst).toBe("ok");
  });

  it("geeft toestemming alleen terug voor het voertuig waarvoor die geldt", () => {
    expect(stand.toestemmingen).toHaveLength(1);
    expect(stand.toestemmingen[0]).toEqual({
      chauffeur: "J. Peeters",
      kentekenGenormaliseerd: "43BKL7",
      gegevenOp: "2026-03-02T08:00:00Z",
    });
  });
});
