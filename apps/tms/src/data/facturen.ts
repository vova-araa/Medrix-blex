import {
  factuurTotalen,
  geld,
  type FactuurRegel,
  type FactuurTotalen,
  type Geld,
  type Zending,
} from "@sharzi/domain";
import type { Tarief } from "./bron";
import { eventsVanTaak, statusVanTaak, type AppState } from "./state";
import { t } from "../i18n";

const STANDAARD_TARIEF: Tarief = { basisCenten: 4500, perLaadmeterCenten: 1850 };

// Wachturen (stap 4): standtijd op het losadres boven de vrije 30 minuten
// wordt automatisch als factuurregel voorgesteld — mits het beleid
// "wachturen" op automatisch staat. De tijden komen uit de event-log
// (aangekomen → gelost), dus de regel is altijd te onderbouwen.
export const WACHTUUR_TARIEF_CENTEN = 4250;
export const WACHTTIJD_GRATIS_MIN = 30;

export function tariefVoorZending(zending: Zending, tarief: Tarief | undefined): Geld {
  const { basisCenten, perLaadmeterCenten } = tarief ?? STANDAARD_TARIEF;
  return geld(basisCenten + Math.round(zending.laadmeters * perLaadmeterCenten));
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
    const losTaak = state.taken.find(
      (taak) =>
        taak.soort === "lossen" &&
        taak.zendingId === zending.id &&
        statusVanTaak(state, taak.id) === "afgerond"
    );
    if (!losTaak) continue;

    const order = state.orders[zending.orderId];
    const opdrachtgever = order?.opdrachtgever ?? zending.orderId;
    const regels = perOpdrachtgever.get(opdrachtgever) ?? [];
    regels.push({
      omschrijving: `${order?.referentie ?? zending.orderId} · ${zending.van.plaats} → ${zending.naar.plaats} (${zending.barcode})`,
      bedrag: tariefVoorZending(zending, state.tarieven[opdrachtgever]),
    });
    if (state.beleid.wachturen === "automatisch") {
      const wachtregel = wachturenRegel(state, losTaak.id, losTaak.adres.naam);
      if (wachtregel) regels.push(wachtregel);
    }
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

function wachturenRegel(
  state: AppState,
  taakId: string,
  adresNaam: string
): FactuurRegel | null {
  const events = eventsVanTaak(state, taakId);
  const aangekomen = events.find((e) => e.type === "aangekomen");
  const gelost = events.find((e) => e.type === "gelost");
  if (!aangekomen || !gelost) return null;

  const standMinuten = Math.floor(
    (Date.parse(gelost.tijdstip) - Date.parse(aangekomen.tijdstip)) / 60_000
  );
  const wachtMinuten = standMinuten - WACHTTIJD_GRATIS_MIN;
  if (wachtMinuten <= 0) return null;

  return {
    omschrijving: t("factuur.wachturen", { adres: adresNaam, minuten: wachtMinuten }),
    bedrag: geld(Math.round((wachtMinuten * WACHTUUR_TARIEF_CENTEN) / 60)),
  };
}
