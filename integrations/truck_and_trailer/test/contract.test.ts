import { describe, expect, it } from "vitest";
import { FixtureTruckAndTrailerClient } from "../src/client";
import { foutVanStatus, KoppelingFout, metRetry } from "@sharzi/connector-kit";
import { mapVloot } from "../src/mapping";
import { vlootFixture } from "../src/fixtures/vloot";
import type { ExternVlootRespons } from "../src/types";

describe("contract: mapVloot", () => {
  it("splitst de vloot in voertuigen en trailers en normaliseert kentekens", () => {
    const vloot = mapVloot(vlootFixture);
    expect(vloot.voertuigen).toHaveLength(4);
    expect(vloot.trailers).toHaveLength(3);
    // "43-BKL-7" met landcode "nl" → genormaliseerd
    expect(vloot.voertuigen[0]).toMatchObject({
      kenteken: "43BKL7",
      landcode: "NL",
      kmStand: 412_680,
      apkTot: "2026-09-02",
      kostenPerMaandCenten: 312_500,
    });
    expect(vloot.trailers.map((tr) => tr.kenteken)).toEqual(["OL84XF", "OK29TD", "OS61PB"]);
    expect(vloot.syncTijdstip).toBe("2026-08-07T03:30:00Z");
  });

  it("faalt hard op een onbekende categorie", () => {
    const respons = {
      generatedAt: "2026-08-07T03:30:00Z",
      vehicles: [{ registration: "XX-01-YY", countryCode: "NL", category: "BOAT", description: "?" }],
    } as unknown as ExternVlootRespons;
    expect(() => mapVloot(respons)).toThrow(/onbekende category "BOAT"/);
  });

  it("weigert niet-gehele centen (geld is integer, §5.4)", () => {
    const respons: ExternVlootRespons = {
      generatedAt: "2026-08-07T03:30:00Z",
      vehicles: [{
        registration: "XX-01-YY", countryCode: "NL", category: "RIGID",
        description: "Bakwagen", monthlyCostCents: 1234.5,
      }],
    };
    expect(() => mapVloot(respons)).toThrow(/integer in centen/);
  });

  it("dubbel kenteken: de laatste wint (upsert)", () => {
    const respons: ExternVlootRespons = {
      generatedAt: "2026-08-07T03:30:00Z",
      vehicles: [
        { registration: "43-BKL-7", countryCode: "NL", category: "TRACTOR", description: "Oud", odometerKm: 1 },
        { registration: "43BKL7", countryCode: "NL", category: "TRACTOR", description: "Nieuw", odometerKm: 2 },
      ],
    };
    const vloot = mapVloot(respons);
    expect(vloot.voertuigen).toHaveLength(1);
    expect(vloot.voertuigen[0].omschrijving).toBe("Nieuw");
  });
});

describe("contract: client", () => {
  it("de fixture-client levert de gemapte vloot", async () => {
    const vloot = await new FixtureTruckAndTrailerClient().haalVloot();
    expect(vloot.voertuigen.length + vloot.trailers.length).toBe(7);
  });

  it("gebruikt de gedeelde retry: drie pogingen met verdubbelende wachttijd", async () => {
    let pogingen = 0;
    const wachttijden: number[] = [];
    await expect(
      metRetry(
        async () => { pogingen++; throw new KoppelingFout("truck_and_trailer", "tijdelijk", "kapot"); },
        { pogingen: 3, wachtMs: 1000, slaap: async (ms) => { wachttijden.push(ms); } }
      )
    ).rejects.toThrow("kapot");
    expect(pogingen).toBe(3);
    expect(wachttijden).toEqual([1000, 2000]);
  });

  it("vertaalt een 401 naar een autorisatiefout die nooit herhaald wordt", async () => {
    let pogingen = 0;
    const fout = foutVanStatus("truck_and_trailer", 401, "credentials geweigerd");
    expect(fout.soort).toBe("autorisatie");
    await expect(
      metRetry(async () => { pogingen++; throw fout; }, { pogingen: 3, slaap: async () => {} })
    ).rejects.toThrow("credentials geweigerd");
    expect(pogingen).toBe(1);
  });

  it("vertaalt een 429 naar een rate limit die wél opnieuw geprobeerd wordt", () => {
    const fout = foutVanStatus("truck_and_trailer", 429, "te snel", 2000);
    expect(fout.soort).toBe("rate_limit");
    expect(fout.herhaalbaar).toBe(true);
    expect(fout.opnieuwNaMs).toBe(2000);
  });
});
