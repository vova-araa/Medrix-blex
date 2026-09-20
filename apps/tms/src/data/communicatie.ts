// Automatische klantcommunicatie: loopt een levering uit, dan krijgt de
// opdrachtgever proactief een ETA-bericht.
//
// Wat eruit gaat en bij welke verschuiving hangt af van wat de klant zelf
// heeft ingesteld (zie packages/domain/notificaties.ts). De ene klant wil elke
// stap weten, de andere alleen als het misgaat — één vaste drempel voor
// iedereen is altijd fout voor de helft van je klanten.

import {
  beoordeelNotificatie, STANDAARD_DREMPEL_MINUTEN,
  type NotificatieGebeurtenis, type OordeelReden,
} from "@sharzi/domain";
import { ritEta } from "../kaart/simulatie";
import { t } from "../i18n";
import { tijd } from "../utils";
import type { AppState, KlantBericht } from "./state";
import { voorkeurVan } from "./state";

/** Terugval voor een klant zonder eigen drempel. */
export const ETA_DRIFT_GRENS_MIN = STANDAARD_DREMPEL_MINUTEN;

export type BerichtVoorstel = Omit<KlantBericht, "id" | "tijdstip" | "wie"> & {
  gebeurtenis: NotificatieGebeurtenis;
  ontvangers: string[];
  /** Mag dit zonder tussenkomst de deur uit? */
  automatisch: boolean;
};

/** Wat er niet uitging en waarom — zodat de planner het kan zien. */
export interface BerichtOverslag {
  klant: string;
  zendingId: string;
  reden: OordeelReden;
}

export interface BerichtenUitkomst {
  voorstellen: BerichtVoorstel[];
  overgeslagen: BerichtOverslag[];
}

export function beoordeelBerichten(state: AppState, nu: string): BerichtenUitkomst {
  const voorstellen: BerichtVoorstel[] = [];
  const overgeslagen: BerichtOverslag[] = [];

  for (const rit of state.ritten) {
    const eta = ritEta(state, rit.id, nu);
    if (!eta || eta.vertragingMin <= 0) continue;

    const taak = state.taken.find((tk) => tk.id === eta.taakId);
    if (!taak || taak.soort !== "lossen" || !taak.zendingId) continue;
    const zending = state.zendingen[taak.zendingId];
    const order = zending && state.orders[zending.orderId];
    if (!zending || !order) continue;

    // Buiten het venster is het een vertraging, daarbinnen alleen een
    // verschoven aankomsttijd. Klanten stellen die twee los in.
    const gebeurtenis: NotificatieGebeurtenis = eta.naVenster ? "vertraging" : "eta_gewijzigd";
    const voorkeur = voorkeurVan(state, order.opdrachtgever);

    // Al gemeld en sindsdien nauwelijks opgeschoven? Dan niets sturen.
    const laatste = state.berichten.filter((b) => b.zendingId === zending.id).at(-1);
    const drempel = voorkeur?.regels.find((r) => r.gebeurtenis === gebeurtenis)?.drempelMinuten
      ?? ETA_DRIFT_GRENS_MIN;
    const alVerstuurd = laatste
      ? Math.abs(Date.parse(eta.aankomstIso) - Date.parse(laatste.etaIso)) / 60_000 < drempel
      : false;

    const oordeel = beoordeelNotificatie({
      voorkeur,
      gebeurtenis,
      verschuivingMinuten: eta.vertragingMin,
      ontvangerEmail: state.klanten[order.opdrachtgever]?.email,
      alVerstuurd,
    });

    if (!oordeel.automatisch && !oordeel.voorstel) {
      overgeslagen.push({
        klant: order.opdrachtgever,
        zendingId: zending.id,
        reden: oordeel.reden ?? "uit",
      });
      continue;
    }

    voorstellen.push({
      klant: order.opdrachtgever,
      ritId: rit.id,
      zendingId: zending.id,
      etaIso: eta.aankomstIso,
      vertragingMin: eta.vertragingMin,
      gebeurtenis,
      ontvangers: oordeel.ontvangers,
      automatisch: oordeel.automatisch,
      tekst: t(eta.naVenster ? "bericht.naVenster" : "bericht.vertraagd", {
        zending: zending.id,
        tijd: tijd(eta.aankomstIso),
        minuten: eta.vertragingMin,
      }),
    });
  }

  return { voorstellen, overgeslagen };
}

/** Alleen de voorstellen, voor plekken die de overgeslagen berichten niet tonen. */
export function benodigdeBerichten(state: AppState, nu: string): BerichtVoorstel[] {
  return beoordeelBerichten(state, nu).voorstellen;
}
