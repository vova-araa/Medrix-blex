// Inkomende aanroepen zijn idempotent (CLAUDE.md §6.2): externe partijen
// sturen dubbel. We onthouden verwerkte message-ids en slaan een herhaling
// over — met hetzelfde resultaat, zonder de verwerking opnieuw te doen.

export interface VerwerktStore {
  isVerwerkt(koppelingId: string, berichtId: string): Promise<boolean>;
  markeerVerwerkt(koppelingId: string, berichtId: string, resultaat?: unknown): Promise<void>;
  haalResultaat(koppelingId: string, berichtId: string): Promise<unknown>;
}

/** In-memory store voor tests en de mockfase. Productie krijgt Supabase. */
export class GeheugenStore implements VerwerktStore {
  private readonly verwerkt = new Map<string, unknown>();
  private sleutel = (k: string, b: string) => `${k}::${b}`;

  async isVerwerkt(koppelingId: string, berichtId: string): Promise<boolean> {
    return this.verwerkt.has(this.sleutel(koppelingId, berichtId));
  }
  async markeerVerwerkt(koppelingId: string, berichtId: string, resultaat?: unknown): Promise<void> {
    this.verwerkt.set(this.sleutel(koppelingId, berichtId), resultaat);
  }
  async haalResultaat(koppelingId: string, berichtId: string): Promise<unknown> {
    return this.verwerkt.get(this.sleutel(koppelingId, berichtId));
  }
  get aantal(): number { return this.verwerkt.size; }
}

export interface EenmaligResultaat<T> {
  resultaat: T;
  /** true = dit bericht was al eerder verwerkt en is nu overgeslagen. */
  overgeslagen: boolean;
}

/**
 * Verwerkt een inkomend bericht precies één keer. Een dubbele levering geeft
 * hetzelfde antwoord terug zonder de verwerking opnieuw te draaien.
 */
export async function verwerkEenmalig<T>(
  store: VerwerktStore,
  koppelingId: string,
  berichtId: string,
  verwerk: () => Promise<T>
): Promise<EenmaligResultaat<T>> {
  if (await store.isVerwerkt(koppelingId, berichtId)) {
    return { resultaat: (await store.haalResultaat(koppelingId, berichtId)) as T, overgeslagen: true };
  }
  const resultaat = await verwerk();
  await store.markeerVerwerkt(koppelingId, berichtId, resultaat);
  return { resultaat, overgeslagen: false };
}

/** Idempotency-key voor uitgaande aanroepen: stabiel per logische actie. */
export function idempotencySleutel(koppelingId: string, actie: string, ...delen: string[]): string {
  return [koppelingId, actie, ...delen].join(":");
}
