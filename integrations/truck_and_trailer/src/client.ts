// Retry, foutsoorten en idempotentie komen uit de gedeelde connector-kit —
// elke koppeling gebruikt dezelfde regels (CLAUDE.md §6.3).
export { metRetry, KoppelingFout, foutVanStatus } from "@sharzi/connector-kit";
import { foutVanStatus, metRetry } from "@sharzi/connector-kit";
import { mapVloot } from "./mapping";
import type { ExternVlootRespons, Vloot } from "./types";
import { vlootFixture } from "./fixtures/vloot";

// De poort waar Sharzi doorheen kijkt. De app kent alleen deze interface;
// welke implementatie erachter zit (fixture of echte API) is een detail.

export interface TruckAndTrailerClient {
  haalVloot(): Promise<Vloot>;
}

/** Fixture-implementatie: de vastgelegde voorbeeldrespons uit de directive. */
export class FixtureTruckAndTrailerClient implements TruckAndTrailerClient {
  haalVloot(): Promise<Vloot> {
    return Promise.resolve(mapVloot(vlootFixture));
  }
}

/**
 * Skelet voor de echte client. Bewust nog niet af: URL, autorisatie en
 * rate limit zijn open vragen aan Blex (zie de directive). De vorm ligt
 * vast zodat alleen dit bestand hoeft te veranderen bij livegang.
 */
export class HttpTruckAndTrailerClient implements TruckAndTrailerClient {
  constructor(
    private readonly basisUrl: string,
    private readonly haalCredential: () => Promise<string>
  ) {}

  async haalVloot(): Promise<Vloot> {
    return metRetry(async () => {
      const credential = await this.haalCredential();
      const respons = await fetch(`${this.basisUrl}/fleet`, {
        headers: { Authorization: `Bearer ${credential}` },
      });
      if (!respons.ok) {
        // De kit bepaalt op basis van de status of opnieuw proberen zin heeft.
        throw foutVanStatus(
          "truck_and_trailer",
          respons.status,
          `Truck & Trailer gaf HTTP ${respons.status}`,
          respons.headers.get("retry-after")
            ? Number(respons.headers.get("retry-after")) * 1000
            : undefined
        );
      }
      return mapVloot((await respons.json()) as ExternVlootRespons);
    });
  }
}
