// Automatische klantcommunicatie (stap 2): loopt een levering uit, dan
// krijgt de opdrachtgever proactief een ETA-bericht. Een nieuwe melding
// volgt pas als de ETA meer dan tien minuten verschuift ten opzichte van
// wat al gemeld is — geen spam bij elke kleine drift.

import { ritEta } from "../kaart/simulatie";
import { t } from "../i18n";
import { tijd } from "../utils";
import type { AppState, KlantBericht } from "./state";

export const ETA_DRIFT_GRENS_MIN = 10;

export type BerichtVoorstel = Omit<KlantBericht, "id" | "tijdstip" | "wie">;

export function benodigdeBerichten(state: AppState, nu: string): BerichtVoorstel[] {
  const voorstellen: BerichtVoorstel[] = [];

  for (const rit of state.ritten) {
    const eta = ritEta(state, rit.id, nu);
    if (!eta || eta.vertragingMin <= 0) continue;

    const taak = state.taken.find((tk) => tk.id === eta.taakId);
    if (!taak || taak.soort !== "lossen" || !taak.zendingId) continue;
    const zending = state.zendingen[taak.zendingId];
    const order = zending && state.orders[zending.orderId];
    if (!zending || !order) continue;

    // Al gemeld en de ETA is niet wezenlijk verschoven? Dan niets sturen.
    const laatste = state.berichten
      .filter((b) => b.zendingId === zending.id)
      .at(-1);
    if (laatste) {
      const driftMin = Math.abs(Date.parse(eta.aankomstIso) - Date.parse(laatste.etaIso)) / 60_000;
      if (driftMin < ETA_DRIFT_GRENS_MIN) continue;
    }

    voorstellen.push({
      klant: order.opdrachtgever,
      ritId: rit.id,
      zendingId: zending.id,
      etaIso: eta.aankomstIso,
      vertragingMin: eta.vertragingMin,
      tekst: t(eta.naVenster ? "bericht.naVenster" : "bericht.vertraagd", {
        zending: zending.id,
        tijd: tijd(eta.aankomstIso),
        minuten: eta.vertragingMin,
      }),
    });
  }

  return voorstellen;
}
