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
 * Retry met exponential backoff voor de echte HTTP-client (directive:
 * 3 pogingen — 1 s, 2 s, 4 s). Autorisatiefouten (401/403) worden nooit
 * opnieuw geprobeerd: die vragen om nieuwe credentials, niet om geduld.
 */
export async function metRetry<T>(
  actie: () => Promise<T>,
  pogingen = 3,
  wachtMs = 1000,
  slaap: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<T> {
  let laatsteFout: unknown;
  for (let poging = 0; poging < pogingen; poging++) {
    try {
      return await actie();
    } catch (fout) {
      laatsteFout = fout;
      if (fout instanceof AutorisatieFout) throw fout;
      if (poging < pogingen - 1) await slaap(wachtMs * 2 ** poging);
    }
  }
  throw laatsteFout;
}

export class AutorisatieFout extends Error {
  constructor() {
    super("Truck & Trailer: credentials geweigerd (401/403) — vernieuw ze in de tenant-vault");
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
      if (respons.status === 401 || respons.status === 403) {
        throw new AutorisatieFout();
      }
      if (!respons.ok) {
        throw new Error(`Truck & Trailer: HTTP ${respons.status}`);
      }
      return mapVloot((await respons.json()) as ExternVlootRespons);
    });
  }
}
