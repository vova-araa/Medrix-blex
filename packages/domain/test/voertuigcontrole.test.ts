import { describe, expect, it } from "vitest";
import {
  beoordeelControle, CONTROLEPUNTEN, geblokkeerdeVoertuigen, handelAf, legeStanden,
  meldingenUitControle, meldingStatus, openMeldingen,
  type ControlePunt, type Garagemelding, type Voertuigcontrole,
} from "../src/voertuigcontrole";

const controle = (
  standen: Partial<Record<ControlePunt, "in_orde" | "gebrek" | "niet_gecontroleerd">> = {},
  toelichting: Partial<Record<ControlePunt, string>> = {}
): Voertuigcontrole => {
  const alles = legeStanden();
  for (const { punt } of CONTROLEPUNTEN) alles[punt] = "in_orde";
  return {
    id: "VC-1", tenantId: "blex", kentekenGenormaliseerd: "43BKL7",
    chauffeur: "J. Peeters", tijdstip: "2026-08-07T04:20:00Z",
    standen: { ...alles, ...standen },
    toelichting,
  };
};

describe("beoordeelControle", () => {
  it("keurt een volledig nagelopen auto goed", () => {
    const oordeel = beoordeelControle(controle());
    expect(oordeel).toEqual({
      gebreken: [], kritiekeGebreken: [], nietGecontroleerd: [],
      volledigInOrde: true, blokkeertPlanning: false,
    });
  });

  it("blokkeert de planning bij een gebrek op een veiligheidspunt", () => {
    const oordeel = beoordeelControle(controle({ remmen: "gebrek" }));
    expect(oordeel.kritiekeGebreken).toEqual(["remmen"]);
    expect(oordeel.blokkeertPlanning).toBe(true);
  });

  it("blokkeert niet bij een gebrek dat de veiligheid niet raakt", () => {
    const oordeel = beoordeelControle(controle({ vloeistoffen: "gebrek" }));
    expect(oordeel.gebreken).toEqual(["vloeistoffen"]);
    expect(oordeel.kritiekeGebreken).toEqual([]);
    expect(oordeel.blokkeertPlanning).toBe(false);
    expect(oordeel.volledigInOrde).toBe(false);
  });

  it("houdt niet-gecontroleerde punten apart van gebreken", () => {
    const oordeel = beoordeelControle(controle({ papieren: "niet_gecontroleerd" }));
    expect(oordeel.gebreken).toEqual([]);
    expect(oordeel.nietGecontroleerd).toEqual(["papieren"]);
    expect(oordeel.volledigInOrde).toBe(false);
  });

  it("een lege lijst is niet in orde maar ook niet afgekeurd", () => {
    const leeg = { ...controle(), standen: legeStanden() };
    const oordeel = beoordeelControle(leeg);
    expect(oordeel.gebreken).toEqual([]);
    expect(oordeel.nietGecontroleerd).toHaveLength(CONTROLEPUNTEN.length);
    expect(oordeel.volledigInOrde).toBe(false);
    expect(oordeel.blokkeertPlanning).toBe(false);
  });

  it("houdt de volgorde van de looproute aan", () => {
    const oordeel = beoordeelControle(controle({ papieren: "gebrek", banden: "gebrek" }));
    expect(oordeel.gebreken).toEqual(["banden", "papieren"]);
  });
});

describe("meldingenUitControle", () => {
  it("maakt één melding per gebrek, met de toelichting van de chauffeur", () => {
    const meldingen = meldingenUitControle(
      controle(
        { banden: "gebrek", vloeistoffen: "gebrek" },
        { banden: "Sneden in linkerband tweede as", vloeistoffen: "Ruitenwisservloeistof leeg" }
      ),
      (punt) => `M-${punt}`
    );
    expect(meldingen).toHaveLength(2);
    expect(meldingen[0].punt).toBe("banden");
    expect(meldingen[0].omschrijving).toBe("Sneden in linkerband tweede as");
    expect(meldingen[0].kritisch).toBe(true);
    expect(meldingen[1].kritisch).toBe(false);
  });

  it("neemt kenteken, chauffeur en tijdstip over uit de controle", () => {
    const [melding] = meldingenUitControle(controle({ remmen: "gebrek" }), () => "M-1");
    expect(melding.kentekenGenormaliseerd).toBe("43BKL7");
    expect(melding.gemeldDoor).toBe("J. Peeters");
    expect(melding.gemeldOp).toBe("2026-08-07T04:20:00Z");
    expect(melding.bron).toBe("dagcontrole");
  });

  it("laat de omschrijving leeg als de chauffeur niets invulde", () => {
    const [melding] = meldingenUitControle(controle({ remmen: "gebrek" }), () => "M-1");
    expect(melding.omschrijving).toBe("");
  });

  it("levert niets op bij een goedgekeurde controle", () => {
    expect(meldingenUitControle(controle(), () => "M-1")).toEqual([]);
  });
});

describe("meldingen afhandelen", () => {
  const melding = (over: Partial<Garagemelding> = {}): Garagemelding => ({
    id: "M-1", tenantId: "blex", kentekenGenormaliseerd: "43BKL7",
    omschrijving: "Sneden in linkerband", kritisch: true,
    gemeldDoor: "J. Peeters", gemeldOp: "2026-08-07T04:20:00Z",
    bron: "dagcontrole", afhandeling: [], ...over,
  });

  it("een verse melding staat open", () => {
    expect(meldingStatus(melding())).toBe("open");
  });

  it("volgt de laatste stap in de afhandeling", () => {
    const ingepland = handelAf(melding(), "ingepland", "werkplaats", "2026-08-07T08:00:00Z");
    const verholpen = handelAf(ingepland, "verholpen", "werkplaats", "2026-08-08T10:00:00Z", "Band vervangen");
    expect(meldingStatus(verholpen)).toBe("verholpen");
    expect(verholpen.afhandeling).toHaveLength(2);
    expect(verholpen.afhandeling[1].notitie).toBe("Band vervangen");
  });

  it("laat de historie staan in plaats van hem te overschrijven", () => {
    const origineel = melding();
    handelAf(origineel, "ingepland", "werkplaats", "2026-08-07T08:00:00Z");
    expect(origineel.afhandeling).toEqual([]);
  });

  it("doet niets bij dezelfde status", () => {
    const ingepland = handelAf(melding(), "ingepland", "werkplaats", "2026-08-07T08:00:00Z");
    expect(handelAf(ingepland, "ingepland", "werkplaats", "2026-08-07T09:00:00Z")).toBe(ingepland);
  });

  it("zet kritieke meldingen bovenaan, daarna op meldmoment", () => {
    const lijst = [
      melding({ id: "M-oud", kritisch: false, gemeldOp: "2026-08-01T08:00:00Z" }),
      melding({ id: "M-kritiek", kritisch: true, gemeldOp: "2026-08-07T08:00:00Z" }),
      melding({ id: "M-nieuw", kritisch: false, gemeldOp: "2026-08-06T08:00:00Z" }),
    ];
    expect(openMeldingen(lijst).map((m) => m.id)).toEqual(["M-kritiek", "M-oud", "M-nieuw"]);
  });

  it("laat verholpen meldingen weg uit de openstaande lijst", () => {
    const verholpen = handelAf(melding(), "verholpen", "werkplaats", "2026-08-08T10:00:00Z");
    expect(openMeldingen([verholpen])).toEqual([]);
  });

  it("noemt een voertuig geblokkeerd zolang een kritiek gebrek openstaat", () => {
    const lijst = [
      melding({ id: "M-1", kritisch: true }),
      melding({ id: "M-2", kentekenGenormaliseerd: "12PGH9", kritisch: false }),
    ];
    expect(geblokkeerdeVoertuigen(lijst)).toEqual(["43BKL7"]);
  });

  it("geeft een voertuig vrij zodra het kritieke gebrek verholpen is", () => {
    const verholpen = handelAf(melding({ kritisch: true }), "verholpen", "werkplaats", "2026-08-08T10:00:00Z");
    expect(geblokkeerdeVoertuigen([verholpen])).toEqual([]);
  });

  it("noemt een kenteken één keer, ook bij twee gebreken", () => {
    const lijst = [melding({ id: "M-1", kritisch: true }), melding({ id: "M-2", kritisch: true })];
    expect(geblokkeerdeVoertuigen(lijst)).toEqual(["43BKL7"]);
  });
});
