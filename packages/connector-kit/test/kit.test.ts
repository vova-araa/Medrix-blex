import { describe, expect, it, vi } from "vitest";
import {
  DeadLetterWachtrij, foutVanStatus, GeheugenStore, idempotencySleutel,
  KoppelingFout, legeVerplichteVelden, metRetry, onbekendeVelden,
  ontbrekendeCodes, verwerkEenmalig,
} from "../src";

const geenSlaap = async () => {};

describe("foutsoorten", () => {
  it("merkt 401 en 403 als autorisatie: opnieuw proberen heeft geen zin", () => {
    for (const status of [401, 403]) {
      const fout = foutVanStatus("test", status);
      expect(fout.soort).toBe("autorisatie");
      expect(fout.herhaalbaar).toBe(false);
    }
  });

  it("merkt 429 als rate limit en 5xx als tijdelijk: wel opnieuw proberen", () => {
    expect(foutVanStatus("test", 429).herhaalbaar).toBe(true);
    expect(foutVanStatus("test", 503).herhaalbaar).toBe(true);
  });

  it("merkt 400 als verzoekfout: onze eigen schuld, niet herhalen", () => {
    const fout = foutVanStatus("test", 400);
    expect(fout.soort).toBe("verzoek");
    expect(fout.herhaalbaar).toBe(false);
  });

  it("noemt de koppeling in de melding, zodat een logregel te herleiden is", () => {
    expect(foutVanStatus("roadsoft", 500, "server stuk").message).toBe("[roadsoft] server stuk");
  });
});

describe("metRetry", () => {
  it("geeft het resultaat terug zodra een poging slaagt", async () => {
    let n = 0;
    const uit = await metRetry(async () => {
      n++;
      if (n < 3) throw new KoppelingFout("test", "tijdelijk", "even niet");
      return "klaar";
    }, { slaap: geenSlaap });
    expect(uit).toBe("klaar");
    expect(n).toBe(3);
  });

  it("stopt direct bij een autorisatiefout — geen tweede poging", async () => {
    const actie = vi.fn(async () => { throw foutVanStatus("test", 401); });
    await expect(metRetry(actie, { slaap: geenSlaap })).rejects.toThrow(/401|geweigerd|HTTP 401/);
    expect(actie).toHaveBeenCalledTimes(1);
  });

  it("verdubbelt de wachttijd per poging", async () => {
    const wachttijden: number[] = [];
    await expect(metRetry(
      async () => { throw new KoppelingFout("test", "tijdelijk", "stuk"); },
      { pogingen: 4, wachtMs: 100, slaap: async (ms) => { wachttijden.push(ms); } }
    )).rejects.toThrow();
    expect(wachttijden).toEqual([100, 200, 400]);
  });

  it("volgt de wachttijd die de leverancier zelf opgeeft bij een rate limit", async () => {
    const wachttijden: number[] = [];
    await expect(metRetry(
      async () => { throw new KoppelingFout("test", "rate_limit", "te snel", 5000); },
      { pogingen: 2, wachtMs: 100, slaap: async (ms) => { wachttijden.push(ms); } }
    )).rejects.toThrow();
    expect(wachttijden).toEqual([5000]);
  });

  it("wacht nooit langer dan de bovengrens", async () => {
    const wachttijden: number[] = [];
    await expect(metRetry(
      async () => { throw new KoppelingFout("test", "rate_limit", "te snel", 3_600_000); },
      { pogingen: 2, maxWachtMs: 30_000, slaap: async (ms) => { wachttijden.push(ms); } }
    )).rejects.toThrow();
    expect(wachttijden).toEqual([30_000]);
  });

  it("meldt elke mislukte poging voor het logboek", async () => {
    const gemeld: number[] = [];
    await expect(metRetry(
      async () => { throw new KoppelingFout("test", "tijdelijk", "stuk"); },
      { pogingen: 3, slaap: geenSlaap, opPoging: (p) => gemeld.push(p) }
    )).rejects.toThrow();
    expect(gemeld).toEqual([1, 2]);
  });
});

describe("idempotentie", () => {
  it("verwerkt een bericht één keer, ook als het dubbel binnenkomt", async () => {
    const store = new GeheugenStore();
    const verwerk = vi.fn(async () => ({ zending: "SHZ-1" }));

    const eerste = await verwerkEenmalig(store, "edi", "msg-1", verwerk);
    const tweede = await verwerkEenmalig(store, "edi", "msg-1", verwerk);

    expect(verwerk).toHaveBeenCalledTimes(1);
    expect(eerste.overgeslagen).toBe(false);
    expect(tweede.overgeslagen).toBe(true);
    expect(tweede.resultaat).toEqual({ zending: "SHZ-1" });
  });

  it("houdt berichten van verschillende koppelingen uit elkaar", async () => {
    const store = new GeheugenStore();
    await verwerkEenmalig(store, "edi", "msg-1", async () => 1);
    const ander = await verwerkEenmalig(store, "dhl", "msg-1", async () => 2);
    expect(ander.overgeslagen).toBe(false);
    expect(store.aantal).toBe(2);
  });

  it("bouwt een stabiele idempotency-sleutel", () => {
    expect(idempotencySleutel("dhl", "label", "SHZ-114-002")).toBe("dhl:label:SHZ-114-002");
  });
});

describe("dead-letter wachtrij", () => {
  it("houdt een gefaalde actie vast in plaats van hem te laten verdwijnen", () => {
    const q = new DeadLetterWachtrij(() => "2026-08-07T10:00:00Z");
    q.voegToe({
      koppelingId: "dhl", actie: "label:SHZ-1", inhoud: { id: "SHZ-1" },
      foutSoort: "tijdelijk", foutmelding: "time-out",
    });
    expect(q.open).toHaveLength(1);
    expect(q.open[0].pogingen).toBe(1);
    expect(q.open[0].eersteFoutIso).toBe("2026-08-07T10:00:00Z");
  });

  it("telt herhalingen op één regel in plaats van de hub vol te schrijven", () => {
    const q = new DeadLetterWachtrij();
    for (let i = 0; i < 5; i++) {
      q.voegToe({
        koppelingId: "dhl", actie: "label:SHZ-1", inhoud: {},
        foutSoort: "tijdelijk", foutmelding: "time-out",
      });
    }
    expect(q.open).toHaveLength(1);
    expect(q.open[0].pogingen).toBe(5);
  });

  it("houdt verschillende acties wel apart", () => {
    const q = new DeadLetterWachtrij();
    q.voegToe({ koppelingId: "dhl", actie: "label:A", inhoud: {}, foutSoort: "tijdelijk", foutmelding: "x" });
    q.voegToe({ koppelingId: "dhl", actie: "label:B", inhoud: {}, foutSoort: "tijdelijk", foutmelding: "x" });
    expect(q.open).toHaveLength(2);
  });

  it("laat een opgeloste regel als spoor staan, maar niet meer als open", () => {
    const q = new DeadLetterWachtrij();
    const item = q.voegToe({
      koppelingId: "dhl", actie: "label:A", inhoud: {}, foutSoort: "tijdelijk", foutmelding: "x",
    });
    q.markeerOpgelost(item.id);
    expect(q.open).toHaveLength(0);
    expect(q.alles).toHaveLength(1);
    expect(q.alles[0].opgelostIso).toBeTruthy();
  });
});

describe("contracthulp", () => {
  it("wijst velden aan die de leverancier stuurt en wij niet kennen", () => {
    expect(onbekendeVelden({ id: 1, nieuwVeld: "x" }, ["id"])).toEqual(["nieuwVeld"]);
  });

  it("wijst codes aan die de mapping niet kent", () => {
    expect(ontbrekendeCodes(["DRIVING", "FERRY"], { DRIVING: "rijden" })).toEqual(["FERRY"]);
  });

  it("wijst lege verplichte velden aan", () => {
    expect(legeVerplichteVelden({ naam: "", plaats: "Venlo" }, ["naam", "plaats"])).toEqual(["naam"]);
  });
});
