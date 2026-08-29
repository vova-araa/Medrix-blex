import { describe, expect, it } from "vitest";
import {
  bronOordeel, heeftToestemming, TACHO_REGELS, uitleesStatussen,
  type TachoUitlezing,
} from "../src/tacho";

const NU = "2026-08-07T10:00:00Z";
let teller = 0;
const uitlezing = (
  soort: TachoUitlezing["soort"], onderwerp: string, tijdstip: string
): TachoUitlezing => ({
  id: `U-${++teller}`, tenantId: "blex", soort, tijdstip,
  bestandsnaam: `${onderwerp}.ddd`,
  ...(soort === "voertuig" ? { kentekenGenormaliseerd: onderwerp } : { chauffeur: onderwerp }),
});

const vloot = { kentekens: ["43BKL7"], chauffeurs: ["J. Peeters"] };

describe("uitleestermijnen", () => {
  it("houdt 90 dagen aan voor de voertuigunit en 28 voor de chauffeurskaart", () => {
    const lijst = uitleesStatussen([
      uitlezing("voertuig", "43BKL7", "2026-07-08T10:00:00Z"),      // 30 dagen
      uitlezing("chauffeurskaart", "J. Peeters", "2026-08-01T10:00:00Z"), // 6 dagen
    ], vloot, NU);
    const voertuig = lijst.find((s) => s.soort === "voertuig")!;
    const kaart = lijst.find((s) => s.soort === "chauffeurskaart")!;
    expect(voertuig.termijnDagen).toBe(TACHO_REGELS.uitleesVoertuigDagen);
    expect(voertuig.dagenResterend).toBe(60);
    expect(voertuig.ernst).toBe("ok");
    expect(kaart.termijnDagen).toBe(TACHO_REGELS.uitleesChauffeurskaartDagen);
    expect(kaart.dagenResterend).toBe(22);
    expect(kaart.ernst).toBe("ok");
  });

  it("waarschuwt zodra er een week of minder over is", () => {
    // 22 dagen geleden uitgelezen: nog 6 dagen tot de 28-dagentermijn.
    const lijst = uitleesStatussen(
      [uitlezing("chauffeurskaart", "J. Peeters", "2026-07-16T10:00:00Z")],
      { kentekens: [], chauffeurs: ["J. Peeters"] }, NU
    );
    expect(lijst[0].dagenResterend).toBe(6);
    expect(lijst[0].ernst).toBe("waarschuwing");
  });

  it("meldt een verstreken termijn als overtreding", () => {
    const lijst = uitleesStatussen(
      [uitlezing("chauffeurskaart", "J. Peeters", "2026-07-01T10:00:00Z")], // 37 dagen
      { kentekens: [], chauffeurs: ["J. Peeters"] }, NU
    );
    expect(lijst[0].dagenResterend).toBe(-9);
    expect(lijst[0].ernst).toBe("verstreken");
  });

  it("behandelt nooit-uitgelezen als verstreken, niet als 'nog tijd'", () => {
    const lijst = uitleesStatussen([], vloot, NU);
    expect(lijst).toHaveLength(2);
    expect(lijst.every((s) => s.ernst === "verstreken")).toBe(true);
    expect(lijst[0].laatsteUitlezingIso).toBeNull();
  });

  it("zet het meest urgente bovenaan", () => {
    const lijst = uitleesStatussen([
      uitlezing("voertuig", "43BKL7", "2026-08-06T10:00:00Z"),            // ruim ok
      uitlezing("chauffeurskaart", "J. Peeters", "2026-07-01T10:00:00Z"), // verstreken
    ], vloot, NU);
    expect(lijst[0].ernst).toBe("verstreken");
    expect(lijst[0].onderwerp).toBe("J. Peeters");
  });

  it("gebruikt de meest recente uitlezing als er meerdere zijn", () => {
    const lijst = uitleesStatussen([
      uitlezing("chauffeurskaart", "J. Peeters", "2026-06-01T10:00:00Z"),
      uitlezing("chauffeurskaart", "J. Peeters", "2026-08-05T10:00:00Z"),
    ], { kentekens: [], chauffeurs: ["J. Peeters"] }, NU);
    expect(lijst[0].dagenGeleden).toBe(2);
    expect(lijst[0].ernst).toBe("ok");
  });
});

describe("toestemming en bronoordeel", () => {
  it("herkent gegeven toestemming per chauffeur en voertuig", () => {
    const t = [{ chauffeur: "J. Peeters", kentekenGenormaliseerd: "43BKL7", gegevenOp: NU }];
    expect(heeftToestemming(t, "J. Peeters", "43BKL7")).toBe(true);
    expect(heeftToestemming(t, "J. Peeters", "87TDF3")).toBe(false);
    expect(heeftToestemming(t, "M. Kowalski", "43BKL7")).toBe(false);
  });

  it("noemt een stand alleen onderbouwd als alles uit de tachograaf komt", () => {
    expect(bronOordeel(["tachograaf", "tachograaf"])).toEqual({ bron: "tachograaf", onderbouwd: true });
    expect(bronOordeel(["app", "app"])).toEqual({ bron: "app", onderbouwd: false });
    expect(bronOordeel(["tachograaf", "app"])).toEqual({ bron: "gemengd", onderbouwd: false });
    expect(bronOordeel([])).toEqual({ bron: "geen", onderbouwd: false });
  });

  it("beschouwt een handmatige correctie niet als onderbouwd", () => {
    expect(bronOordeel(["handmatig"]).onderbouwd).toBe(false);
  });
});
