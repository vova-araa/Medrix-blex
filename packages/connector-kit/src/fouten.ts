// Foutsoorten die elke connector deelt. De soort bepaalt of opnieuw proberen
// zin heeft — dat oordeel hoort hier, niet verspreid over de connectors.

export type FoutSoort =
  /** Credentials geweigerd: nieuwe sleutels nodig, geduld helpt niet. */
  | "autorisatie"
  /** Wij sturen iets ongeldigs: opnieuw proberen levert dezelfde fout. */
  | "verzoek"
  /** Rate limit: opnieuw proberen mag, maar pas na de opgegeven wachttijd. */
  | "rate_limit"
  /** Tijdelijk: netwerk, time-out, 5xx. Opnieuw proberen is zinvol. */
  | "tijdelijk"
  /** Antwoord klopt niet met het contract: nooit stil doorlaten. */
  | "contract";

export class KoppelingFout extends Error {
  constructor(
    readonly koppelingId: string,
    readonly soort: FoutSoort,
    bericht: string,
    /** Bij rate_limit: hoe lang de leverancier zegt te wachten. */
    readonly opnieuwNaMs?: number
  ) {
    super(`[${koppelingId}] ${bericht}`);
    this.name = "KoppelingFout";
  }

  /** Heeft opnieuw proberen zin? */
  get herhaalbaar(): boolean {
    return this.soort === "tijdelijk" || this.soort === "rate_limit";
  }
}

/** Vertaalt een HTTP-status naar een foutsoort. */
export function foutVanStatus(
  koppelingId: string,
  status: number,
  bericht = `HTTP ${status}`,
  opnieuwNaMs?: number
): KoppelingFout {
  const soort: FoutSoort =
    status === 401 || status === 403 ? "autorisatie"
    : status === 429 ? "rate_limit"
    : status >= 500 ? "tijdelijk"
    : "verzoek";
  return new KoppelingFout(koppelingId, soort, bericht, opnieuwNaMs);
}
