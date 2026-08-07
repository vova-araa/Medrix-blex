// Emballage (CLAUDE.md §5.2): saldi zijn ALTIJD afgeleid uit transacties.
// Er bestaat nergens een opgeslagen saldo-kolom; een correctie is een nieuwe
// transactie, nooit een aanpassing van een bestaande.

export type EmballageSoort = "europallet" | "rolcontainer" | "fust" | "kist";

export interface EmballageTransactie {
  id: string;
  tenantId: string;
  /** Opdrachtgever/relatie met wie het saldo loopt. */
  klant: string;
  soort: EmballageSoort;
  /** Door ons geleverd aan de klant (verhoogt hun schuld aan ons). */
  geleverd: number;
  /** Door de klant aan ons geretourneerd. */
  retour: number;
  tijdstip: string;
  ritId?: string;
  wie: string;
}

/** Saldo per klant per soort: positief = klant heeft emballage van ons tegoed staan. */
export function emballageSaldi(
  transacties: readonly EmballageTransactie[]
): Record<string, Partial<Record<EmballageSoort, number>>> {
  const saldi: Record<string, Partial<Record<EmballageSoort, number>>> = {};
  for (const transactie of transacties) {
    if (!Number.isInteger(transactie.geleverd) || !Number.isInteger(transactie.retour)) {
      throw new Error(`Emballage-aantallen moeten gehele getallen zijn: ${transactie.id}`);
    }
    const perKlant = (saldi[transactie.klant] ??= {});
    perKlant[transactie.soort] =
      (perKlant[transactie.soort] ?? 0) + transactie.geleverd - transactie.retour;
  }
  return saldi;
}

/** Correctie: een NIEUWE transactie die een eerdere tegenboekt, met verwijzing. */
export function maakCorrectie(
  origineel: EmballageTransactie,
  id: string,
  tijdstip: string,
  wie: string
): EmballageTransactie {
  return {
    ...origineel,
    id,
    tijdstip,
    wie,
    geleverd: origineel.retour,
    retour: origineel.geleverd,
  };
}
