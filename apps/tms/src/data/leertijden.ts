// Geleerde handelingstijden: hoe lang duurt laden/lossen op een adres écht?
// Afgeleid uit de append-only event-log (aangekomen → geladen/gelost),
// nooit apart opgeslagen. De autoplanner rekent hiermee in plaats van de
// vaste 30 minuten, zodat een traag dock vanzelf ruimer wordt ingepland.

import type { Adres } from "@sharzi/domain";
import { adresSleutel } from "./bron";
import { eventsVanTaak, type AppState } from "./state";

export interface Leertijd {
  gemiddeldeMinuten: number;
  metingen: number;
}

interface Meting {
  plaats: string;
  sleutel: string;
  minuten: number;
}

function metingen(state: AppState): Meting[] {
  const result: Meting[] = [];
  for (const taak of state.taken) {
    const events = eventsVanTaak(state, taak.id);
    const aangekomen = events.find((e) => e.type === "aangekomen");
    const klaar = events.find((e) => e.type === "geladen" || e.type === "gelost");
    if (!aangekomen || !klaar) continue;
    const minuten = (Date.parse(klaar.tijdstip) - Date.parse(aangekomen.tijdstip)) / 60_000;
    if (minuten <= 0) continue;
    result.push({
      plaats: taak.adres.plaats,
      sleutel: adresSleutel(taak.adres),
      minuten,
    });
  }
  return result;
}

function gemiddelde(waarden: number[]): Leertijd {
  const som = waarden.reduce((a, b) => a + b, 0);
  return {
    gemiddeldeMinuten: Math.round(som / waarden.length),
    metingen: waarden.length,
  };
}

/** Geleerde handelingstijd per plaats, voor de autoplanner. */
export function leertijdVoorPlaats(state: AppState): (plaats: string) => number | undefined {
  const perPlaats = new Map<string, number[]>();
  for (const m of metingen(state)) {
    const lijst = perPlaats.get(m.plaats) ?? [];
    lijst.push(m.minuten);
    perPlaats.set(m.plaats, lijst);
  }
  return (plaats) => {
    const lijst = perPlaats.get(plaats);
    return lijst ? gemiddelde(lijst).gemiddeldeMinuten : undefined;
  };
}

/** Geleerde handelingstijd voor één adres (naam+plaats), voor het detailpaneel. */
export function leertijdVanAdres(state: AppState, adres: Adres): Leertijd | undefined {
  const sleutel = adresSleutel(adres);
  const waarden = metingen(state)
    .filter((m) => m.sleutel === sleutel)
    .map((m) => m.minuten);
  return waarden.length > 0 ? gemiddelde(waarden) : undefined;
}
