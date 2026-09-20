import { describe, expect, it } from "vitest";
import {
  alGemeld, beoordeelNotificatie, logVanKlant, NOTIFICATIE_GEBEURTENISSEN,
  regelVan, standaardVoorkeur, tellingPerKlant,
  type NotificatieGebeurtenis, type Notificatievoorkeur, type VerstuurdeNotificatie,
} from "../src/notificaties";

const voorkeur = (over: Partial<Notificatievoorkeur> = {}): Notificatievoorkeur => ({
  ...standaardVoorkeur("Jumbo Supermarkten BV", "transport@jumbo.example"),
  ...over,
});

const metStand = (
  gebeurtenis: NotificatieGebeurtenis,
  stand: "automatisch" | "voorstel" | "uit",
  drempelMinuten?: number
): Notificatievoorkeur => {
  const basis = voorkeur();
  return {
    ...basis,
    regels: basis.regels.map((r) =>
      r.gebeurtenis === gebeurtenis
        ? { ...r, stand, ...(drempelMinuten !== undefined ? { drempelMinuten } : {}) }
        : r
    ),
  };
};

describe("standaardVoorkeur", () => {
  it("dekt elke gebeurtenis", () => {
    const v = standaardVoorkeur("Klant");
    expect(v.regels.map((r) => r.gebeurtenis)).toEqual([...NOTIFICATIE_GEBEURTENISSEN]);
  });

  it("zet alleen aan wat de klant echt moet weten", () => {
    const v = standaardVoorkeur("Klant");
    expect(regelVan(v, "vertraging")!.stand).toBe("automatisch");
    expect(regelVan(v, "afgeleverd")!.stand).toBe("automatisch");
    expect(regelVan(v, "ingepland")!.stand).toBe("uit");
    expect(regelVan(v, "onderweg")!.stand).toBe("uit");
  });

  it("geeft ETA en vertraging een drempel en de rest niet", () => {
    const v = standaardVoorkeur("Klant");
    expect(regelVan(v, "eta_gewijzigd")!.drempelMinuten).toBe(15);
    expect(regelVan(v, "vertraging")!.drempelMinuten).toBe(15);
    expect(regelVan(v, "afgeleverd")!.drempelMinuten).toBeUndefined();
  });
});

describe("beoordeelNotificatie", () => {
  it("verstuurt automatisch wat op automatisch staat", () => {
    const oordeel = beoordeelNotificatie({ voorkeur: voorkeur(), gebeurtenis: "afgeleverd" });
    expect(oordeel).toEqual({
      automatisch: true, voorstel: false, ontvangers: ["transport@jumbo.example"],
    });
  });

  it("stelt alleen voor wat op voorstel staat", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: metStand("probleem", "voorstel"), gebeurtenis: "probleem",
    });
    expect(oordeel.automatisch).toBe(false);
    expect(oordeel.voorstel).toBe(true);
  });

  it("doet niets bij uit, met reden", () => {
    const oordeel = beoordeelNotificatie({ voorkeur: voorkeur(), gebeurtenis: "ingepland" });
    expect(oordeel).toMatchObject({ automatisch: false, voorstel: false, reden: "uit" });
  });

  it("doet niets zonder voorkeur voor deze klant", () => {
    expect(beoordeelNotificatie({ voorkeur: undefined, gebeurtenis: "afgeleverd" }).reden)
      .toBe("geen_voorkeur");
  });

  it("doet niets zonder e-mailadres", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: voorkeur({ email: "  " }), gebeurtenis: "afgeleverd",
    });
    expect(oordeel.reden).toBe("geen_email");
  });

  it("houdt een verschuiving onder de drempel binnen", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: metStand("eta_gewijzigd", "automatisch", 15),
      gebeurtenis: "eta_gewijzigd",
      verschuivingMinuten: 9,
    });
    expect(oordeel.reden).toBe("onder_drempel");
  });

  it("verstuurt zodra de verschuiving de drempel haalt", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: metStand("eta_gewijzigd", "automatisch", 15),
      gebeurtenis: "eta_gewijzigd",
      verschuivingMinuten: 15,
    });
    expect(oordeel.automatisch).toBe(true);
  });

  it("telt ook een verschuiving naar voren als verschuiving", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: metStand("eta_gewijzigd", "automatisch", 15),
      gebeurtenis: "eta_gewijzigd",
      verschuivingMinuten: -40,
    });
    expect(oordeel.automatisch).toBe(true);
  });

  it("neemt de ontvanger op het losadres mee als dat is ingesteld", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: { ...voorkeur(), ookOntvanger: true },
      gebeurtenis: "afgeleverd",
      ontvangerEmail: "dc@veghel.example",
    });
    expect(oordeel.ontvangers).toEqual(["transport@jumbo.example", "dc@veghel.example"]);
  });

  it("laat de ontvanger weg als dat niet is ingesteld", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: voorkeur(), gebeurtenis: "afgeleverd", ontvangerEmail: "dc@veghel.example",
    });
    expect(oordeel.ontvangers).toEqual(["transport@jumbo.example"]);
  });

  it("stuurt niet twee keer naar hetzelfde adres", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: { ...voorkeur(), ookOntvanger: true },
      gebeurtenis: "afgeleverd",
      ontvangerEmail: "transport@jumbo.example",
    });
    expect(oordeel.ontvangers).toEqual(["transport@jumbo.example"]);
  });

  it("zwijgt als er al een bericht uit is", () => {
    const oordeel = beoordeelNotificatie({
      voorkeur: voorkeur(), gebeurtenis: "afgeleverd", alVerstuurd: true,
    });
    expect(oordeel.reden).toBe("al_verstuurd");
  });
});

describe("alGemeld", () => {
  const bericht = (over: Partial<VerstuurdeNotificatie> = {}): VerstuurdeNotificatie => ({
    id: "N1", tenantId: "blex", opdrachtgever: "Jumbo", gebeurtenis: "eta_gewijzigd",
    zendingId: "Z1", ontvangers: ["a@b.example"], onderwerp: "ETA", tekst: "…",
    tijdstip: "2026-08-07T09:00:00Z", herkomst: "automatisch", ...over,
  });

  it("is onwaar als er nog niets uit is", () => {
    expect(alGemeld([], "Z1", "afgeleverd")).toBe(false);
  });

  it("is waar bij een tweede bericht van dezelfde soort", () => {
    expect(alGemeld([bericht({ gebeurtenis: "afgeleverd" })], "Z1", "afgeleverd")).toBe(true);
  });

  it("houdt zendingen uit elkaar", () => {
    expect(alGemeld([bericht({ zendingId: "Z1" })], "Z2", "eta_gewijzigd")).toBe(false);
  });

  it("laat een ETA opnieuw uitgaan als de tijd verder is verschoven", () => {
    const log = [bericht({ verschuivingMinuten: 20 })];
    expect(alGemeld(log, "Z1", "eta_gewijzigd", 50, 15)).toBe(false);
  });

  it("blokkeert een ETA die nauwelijks is opgeschoven", () => {
    const log = [bericht({ verschuivingMinuten: 20 })];
    expect(alGemeld(log, "Z1", "eta_gewijzigd", 28, 15)).toBe(true);
  });

  it("kijkt naar het laatste bericht, niet het eerste", () => {
    const log = [
      bericht({ id: "N1", verschuivingMinuten: 20, tijdstip: "2026-08-07T09:00:00Z" }),
      bericht({ id: "N2", verschuivingMinuten: 60, tijdstip: "2026-08-07T10:00:00Z" }),
    ];
    expect(alGemeld(log, "Z1", "eta_gewijzigd", 65, 15)).toBe(true);
    expect(alGemeld(log, "Z1", "eta_gewijzigd", 95, 15)).toBe(false);
  });
});

describe("logboek", () => {
  const log: VerstuurdeNotificatie[] = [
    {
      id: "N1", tenantId: "blex", opdrachtgever: "Jumbo", gebeurtenis: "vertraging",
      zendingId: "Z1", ontvangers: ["a@b.example"], onderwerp: "Vertraging", tekst: "…",
      tijdstip: "2026-08-07T09:00:00Z", herkomst: "automatisch",
    },
    {
      id: "N2", tenantId: "blex", opdrachtgever: "Jumbo", gebeurtenis: "afgeleverd",
      zendingId: "Z1", ontvangers: ["a@b.example"], onderwerp: "Bezorgd", tekst: "…",
      tijdstip: "2026-08-07T11:00:00Z", herkomst: "planner",
    },
    {
      id: "N3", tenantId: "blex", opdrachtgever: "De Kroon", gebeurtenis: "afgeleverd",
      zendingId: "Z2", ontvangers: ["c@d.example"], onderwerp: "Bezorgd", tekst: "…",
      tijdstip: "2026-08-07T10:00:00Z", herkomst: "automatisch",
    },
  ];

  it("geeft per klant het eigen logboek, nieuwste eerst", () => {
    expect(logVanKlant(log, "Jumbo").map((n) => n.id)).toEqual(["N2", "N1"]);
  });

  it("telt automatisch en handmatig apart", () => {
    const telling = tellingPerKlant(log);
    expect(telling[0]).toEqual({
      opdrachtgever: "Jumbo", totaal: 2, automatisch: 1, handmatig: 1,
      laatste: "2026-08-07T11:00:00Z",
    });
  });

  it("zet de klant met de meeste berichten bovenaan", () => {
    expect(tellingPerKlant(log).map((t) => t.opdrachtgever)).toEqual(["Jumbo", "De Kroon"]);
  });

  it("geeft een lege lijst voor een klant zonder berichten", () => {
    expect(logVanKlant(log, "Onbekend")).toEqual([]);
    expect(tellingPerKlant([])).toEqual([]);
  });
});
