import {
  factuurTotalen,
  geld,
  type FactuurRegel,
  type FactuurTotalen,
  type Geld,
} from "@sharzi/domain";
import { statusVanTaak, type AppState } from "./state";

// Mock-tarief tot er een echte tarieventabel per opdrachtgever bestaat:
// starttarief + bedrag per laadmeter, in centen.
export function tariefVoorZending(laadmeters: number): Geld {
  return geld(4500 + Math.round(laadmeters * 1850));
}

export interface ConceptFactuur {
  opdrachtgever: string;
  regels: FactuurRegel[];
  totalen: FactuurTotalen;
}

/** Conceptfacturen: één per opdrachtgever, over afgeleverde zendingen. */
export function conceptFacturen(state: AppState): ConceptFactuur[] {
  const perOpdrachtgever = new Map<string, FactuurRegel[]>();

  for (const zending of Object.values(state.zendingen)) {
    const afgeleverd = state.taken.some(
      (taak) =>
        taak.soort === "lossen" &&
        taak.zendingId === zending.id &&
        statusVanTaak(state, taak.id) === "afgerond"
    );
    if (!afgeleverd) continue;

    const order = state.orders[zending.orderId];
    const opdrachtgever = order?.opdrachtgever ?? zending.orderId;
    const regel: FactuurRegel = {
      omschrijving: `${order?.referentie ?? zending.orderId} · ${zending.van.plaats} → ${zending.naar.plaats} (${zending.barcode})`,
      bedrag: tariefVoorZending(zending.laadmeters),
    };
    const regels = perOpdrachtgever.get(opdrachtgever) ?? [];
    regels.push(regel);
    perOpdrachtgever.set(opdrachtgever, regels);
  }

  return [...perOpdrachtgever.entries()]
    .map(([opdrachtgever, regels]) => ({
      opdrachtgever,
      regels,
      totalen: factuurTotalen(regels),
    }))
    .sort((a, b) => b.totalen.totaal.bedragCenten - a.totalen.totaal.bedragCenten);
}
