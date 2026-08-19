// Koppelingen-hub: één plek waar alle externe systemen zichtbaar zijn —
// status, laatste sync en het volledige berichtenlogboek. De klant kan een
// koppeling inzien, testen en gefaalde berichten opnieuw afspelen (§6.3).
// Nieuwe koppelingen bouwen we pas bij concrete klantvraag (§6.7); de
// catalogus registreert die vraag.

import type { KoppelingStatus } from "./bron";
import type { AppState } from "./state";

export interface KoppelingDef {
  id: string;
  naam: string;
  soort: "wagenpark" | "email" | "boekhouding" | "vervoerder" | "planning";
  /** "beschikbaar" = in de catalogus, aan te vragen maar nog niet gebouwd. */
  status: Exclude<KoppelingStatus, "fout"> ;
}

export const KOPPELINGEN: KoppelingDef[] = [
  { id: "truck_and_trailer", naam: "Truck & Trailer", soort: "wagenpark", status: "actief" },
  { id: "email", naam: "E-mail (berichtencentrum)", soort: "email", status: "actief" },
  { id: "exact_online", naam: "Exact Online", soort: "boekhouding", status: "beschikbaar" },
  { id: "dhl_parcel", naam: "DHL Parcel", soort: "vervoerder", status: "beschikbaar" },
  { id: "ptv_verkeer", naam: "Verkeersdata (route & ETA)", soort: "planning", status: "beschikbaar" },
];

/** Actuele status: een actieve koppeling met een open gefaald bericht toont "fout". */
export function koppelingStatus(state: AppState, koppeling: KoppelingDef): KoppelingStatus {
  if (koppeling.status === "beschikbaar") return "beschikbaar";
  const openFout = state.koppelingLog.some(
    (regel) =>
      regel.koppelingId === koppeling.id &&
      regel.status === "gefaald" &&
      !regel.opnieuwAfgespeeld
  );
  return openFout ? "fout" : "actief";
}

export function laatsteSync(state: AppState, koppelingId: string): string | undefined {
  if (koppelingId === "truck_and_trailer" && state.wagenparkSync) return state.wagenparkSync;
  return state.koppelingLog
    .filter((regel) => regel.koppelingId === koppelingId && regel.status === "geslaagd")
    .at(-1)?.tijdstip;
}
