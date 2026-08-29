// Uitgaande aanroepen: opnieuw proberen met exponentiële backoff, maar nooit
// blind. Een autorisatiefout of een ongeldig verzoek wordt direct doorgegeven
// (CLAUDE.md §6.3) — daar helpt wachten niet, en doorgaan verergert het.

import { KoppelingFout } from "./fouten";

export interface RetryOpties {
  pogingen?: number;
  /** Basiswachttijd; verdubbelt per poging. */
  wachtMs?: number;
  /** Bovengrens per wachtperiode, zodat een rate limit niet uren wacht. */
  maxWachtMs?: number;
  slaap?: (ms: number) => Promise<void>;
  /** Wordt aangeroepen bij elke mislukte poging — voor het logboek. */
  opPoging?: (poging: number, fout: unknown, wachtMs: number) => void;
}

export async function metRetry<T>(
  actie: () => Promise<T>,
  opties: RetryOpties = {}
): Promise<T> {
  const {
    pogingen = 3,
    wachtMs = 1000,
    maxWachtMs = 30_000,
    slaap = (ms: number) => new Promise((r) => setTimeout(r, ms)),
    opPoging,
  } = opties;

  let laatsteFout: unknown;
  for (let poging = 0; poging < pogingen; poging++) {
    try {
      return await actie();
    } catch (fout) {
      laatsteFout = fout;
      if (fout instanceof KoppelingFout && !fout.herhaalbaar) throw fout;
      if (poging === pogingen - 1) break;

      // Zegt de leverancier zelf hoe lang te wachten, dan volgen we dat.
      const eigenWens = fout instanceof KoppelingFout ? fout.opnieuwNaMs : undefined;
      const wacht = Math.min(maxWachtMs, eigenWens ?? wachtMs * 2 ** poging);
      opPoging?.(poging + 1, fout, wacht);
      await slaap(wacht);
    }
  }
  throw laatsteFout;
}
