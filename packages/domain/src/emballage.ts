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

// ── Ouderdom en waarde ──────────────────────────────────────────────────────
//
// Een saldo alleen zegt niets: 40 pallets die gisteren zijn geleverd is normaal,
// 40 pallets die er drie maanden staan is geld dat vaststaat. De ouderdom komt
// uit FIFO over de transacties — een retour lost altijd de oudste levering af.
// Ook dit wordt afgeleid en nooit opgeslagen (§5.2).

import { geld } from "./geld";
import type { Geld } from "./types";

/**
 * Statiegeld per stuk in centen. Dit zijn richtprijzen; per klant kan een
 * andere afspraak gelden, dus ze zijn te overschrijven.
 */
export const STANDAARD_STATIEGELD: Record<EmballageSoort, number> = {
  europallet: 1_400,
  rolcontainer: 8_500,
  fust: 350,
  kist: 900,
};

export interface SoortStand {
  soort: EmballageSoort;
  /** Positief = de klant heeft nog emballage van ons. */
  saldo: number;
  /** Tijdstip van de oudste levering die nog niet terug is. */
  oudsteOpenstaand: string | null;
  /** Hoe lang die openstaat, in hele dagen. */
  ouderdomDagen: number | null;
  laatsteBeweging: string | null;
  waarde: Geld;
}

export interface KlantStand {
  klant: string;
  standen: SoortStand[];
  /** Som van de positieve saldi — wat de klant in totaal van ons heeft. */
  totaalOpenstaand: number;
  waarde: Geld;
  /** Ouderdom van het langst openstaande stuk over alle soorten. */
  langstOpenstaandDagen: number | null;
  laatsteBeweging: string | null;
}

function dagenTussen(vanIso: string, totIso: string): number {
  return Math.floor((Date.parse(totIso) - Date.parse(vanIso)) / 86_400_000);
}

/**
 * Stand per klant, met ouderdom en waarde. `nu` bepaalt de ouderdom; prijzen
 * zijn per soort te overschrijven voor klanten met een eigen statiegeldafspraak.
 */
export function emballageStand(
  transacties: readonly EmballageTransactie[],
  nu: string,
  statiegeld: Partial<Record<EmballageSoort, number>> = {}
): KlantStand[] {
  const prijs = (soort: EmballageSoort) => statiegeld[soort] ?? STANDAARD_STATIEGELD[soort];

  // FIFO-wachtrij per klant en soort: elke levering wacht op zijn retour.
  const wachtrijen = new Map<string, Array<{ tijdstip: string; aantal: number }>>();
  const saldi = new Map<string, number>();
  const laatste = new Map<string, string>();
  const klanten = new Set<string>();

  const gesorteerd = [...transacties].sort(
    (a, b) => Date.parse(a.tijdstip) - Date.parse(b.tijdstip)
  );

  for (const transactie of gesorteerd) {
    if (!Number.isInteger(transactie.geleverd) || !Number.isInteger(transactie.retour)) {
      throw new Error(`Emballage-aantallen moeten gehele getallen zijn: ${transactie.id}`);
    }
    klanten.add(transactie.klant);
    const sleutel = `${transactie.klant} ${transactie.soort}`;
    laatste.set(sleutel, transactie.tijdstip);
    saldi.set(sleutel, (saldi.get(sleutel) ?? 0) + transactie.geleverd - transactie.retour);

    const rij = wachtrijen.get(sleutel) ?? [];
    if (transactie.geleverd > 0) rij.push({ tijdstip: transactie.tijdstip, aantal: transactie.geleverd });

    // Een retour lost de oudste levering af. Meer terug dan geleverd kan: dan
    // staat de klant voor en is er niets meer dat bij ons openstaat.
    let terug = transactie.retour;
    while (terug > 0 && rij.length > 0) {
      const oudste = rij[0];
      const af = Math.min(terug, oudste.aantal);
      oudste.aantal -= af;
      terug -= af;
      if (oudste.aantal === 0) rij.shift();
    }
    wachtrijen.set(sleutel, rij);
  }

  const soorten: EmballageSoort[] = ["europallet", "rolcontainer", "fust", "kist"];
  return [...klanten].sort().map((klant) => {
    const standen: SoortStand[] = [];
    for (const soort of soorten) {
      const sleutel = `${klant} ${soort}`;
      if (!laatste.has(sleutel)) continue;
      const saldo = saldi.get(sleutel) ?? 0;
      const rij = wachtrijen.get(sleutel) ?? [];
      const oudsteOpenstaand = saldo > 0 && rij.length > 0 ? rij[0].tijdstip : null;
      standen.push({
        soort,
        saldo,
        oudsteOpenstaand,
        ouderdomDagen: oudsteOpenstaand ? dagenTussen(oudsteOpenstaand, nu) : null,
        laatsteBeweging: laatste.get(sleutel) ?? null,
        waarde: geld(Math.max(0, saldo) * prijs(soort)),
      });
    }

    const ouderdommen = standen
      .map((s) => s.ouderdomDagen)
      .filter((d): d is number => d !== null);
    const bewegingen = standen
      .map((s) => s.laatsteBeweging)
      .filter((b): b is string => b !== null);

    return {
      klant,
      standen,
      totaalOpenstaand: standen.reduce((som, s) => som + Math.max(0, s.saldo), 0),
      waarde: geld(standen.reduce((som, s) => som + s.waarde.bedragCenten, 0)),
      langstOpenstaandDagen: ouderdommen.length ? Math.max(...ouderdommen) : null,
      laatsteBeweging: bewegingen.length
        ? bewegingen.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b))
        : null,
    };
  });
}

/**
 * Klanten met emballage die langer dan `dagen` openstaat — de lijst waar je
 * achteraan belt voordat je hem factureert.
 */
export function langOpenstaand(standen: readonly KlantStand[], dagen: number): KlantStand[] {
  return standen
    .filter((s) => s.langstOpenstaandDagen !== null && s.langstOpenstaandDagen >= dagen)
    .sort((a, b) => (b.langstOpenstaandDagen ?? 0) - (a.langstOpenstaandDagen ?? 0));
}

/** Nieuwe transactie boeken. Een correctie loopt via `maakCorrectie`. */
export function boekTransactie(invoer: {
  id: string;
  tenantId: string;
  klant: string;
  soort: EmballageSoort;
  geleverd: number;
  retour: number;
  tijdstip: string;
  wie: string;
  ritId?: string;
}): EmballageTransactie {
  if (!Number.isInteger(invoer.geleverd) || !Number.isInteger(invoer.retour)) {
    throw new Error("Emballage-aantallen moeten gehele getallen zijn.");
  }
  if (invoer.geleverd < 0 || invoer.retour < 0) {
    throw new Error("Gebruik geen negatieve aantallen; een tegenboeking is een correctie.");
  }
  if (invoer.geleverd === 0 && invoer.retour === 0) {
    throw new Error("Een transactie zonder beweging heeft geen betekenis.");
  }
  return {
    id: invoer.id,
    tenantId: invoer.tenantId,
    klant: invoer.klant,
    soort: invoer.soort,
    geleverd: invoer.geleverd,
    retour: invoer.retour,
    tijdstip: invoer.tijdstip,
    wie: invoer.wie,
    ...(invoer.ritId ? { ritId: invoer.ritId } : {}),
  };
}
