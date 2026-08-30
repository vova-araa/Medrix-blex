// Een transportopdracht kan uit twee kanten binnenkomen: de planner typt hem in
// of de opdrachtgever meldt hem zelf aan in het portaal. Beide wegen lopen door
// dezelfde controle, zodat een order uit het portaal niet slechter gecontroleerd
// is dan een order van de balie.
//
// Alles wat hier faalt is een reden om de order níet aan te maken. Alles wat
// waarschuwt komt er wel in, maar met een vlag voor de planner — een order
// weigeren omdat hij krap is, is erger dan hem aannemen en erover bellen.

import { lokaalTijdstipMs, lokaleDatum } from "./tijd";
import type { Order, Zending } from "./types";

export interface Orderaanvraag {
  opdrachtgever: string;
  /** Referentie van de opdrachtgever zelf; leeg mag, wij vullen dan een nummer. */
  klantreferentie: string;
  vanNaam: string;
  vanPlaats: string;
  naarNaam: string;
  naarPlaats: string;
  omschrijving: string;
  laadmeters: number;
  gewichtKg: number;
  /** Laaddatum als YYYY-MM-DD, lokale kalenderdag. */
  datum: string;
  /** Losvenster als HH:MM in lokale tijd. */
  vensterVan: string;
  vensterTot: string;
}

export type AanvraagCode =
  | "opdrachtgever_leeg"
  | "laadadres_leeg"
  | "losadres_leeg"
  | "laadmeters_ongeldig"
  | "laadmeters_te_groot"
  | "gewicht_ongeldig"
  | "gewicht_te_zwaar"
  | "venster_ongeldig"
  | "venster_omgekeerd"
  | "venster_te_kort"
  | "datum_ongeldig"
  | "datum_verleden"
  | "krappe_aanmeldtijd";

export interface AanvraagGrenzen {
  /** Groter dan één trailer moet gesplitst worden in twee zendingen. */
  maxLaadmeters: number;
  /** Laadvermogen van de zwaarste combinatie in de vloot, in kilo's. */
  maxGewichtKg: number;
  /** Korter dan dit is geen venster maar een afspraak op de minuut. */
  minVensterMinuten: number;
  /** Onder deze aanmeldtijd waarschuwen we de planner. */
  minAanmeldUren: number;
}

export const STANDAARD_GRENZEN: AanvraagGrenzen = {
  maxLaadmeters: 13.6,
  maxGewichtKg: 27_000,
  minVensterMinuten: 30,
  minAanmeldUren: 16,
};

export interface AanvraagOordeel {
  fouten: AanvraagCode[];
  waarschuwingen: AanvraagCode[];
  /** Mag de order aangemaakt worden? Waarschuwingen blokkeren niet. */
  mag: boolean;
}

const TIJD_PATROON = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

function minutenVan(hhmm: string): number {
  const [u, m] = hhmm.split(":").map(Number);
  return u * 60 + m;
}

export function controleerAanvraag(
  aanvraag: Orderaanvraag,
  nu: string,
  grenzen: AanvraagGrenzen = STANDAARD_GRENZEN
): AanvraagOordeel {
  const fouten: AanvraagCode[] = [];
  const waarschuwingen: AanvraagCode[] = [];

  if (!aanvraag.opdrachtgever.trim()) fouten.push("opdrachtgever_leeg");
  if (!aanvraag.vanNaam.trim() || !aanvraag.vanPlaats.trim()) fouten.push("laadadres_leeg");
  if (!aanvraag.naarNaam.trim() || !aanvraag.naarPlaats.trim()) fouten.push("losadres_leeg");

  if (!Number.isFinite(aanvraag.laadmeters) || aanvraag.laadmeters <= 0) {
    fouten.push("laadmeters_ongeldig");
  } else if (aanvraag.laadmeters > grenzen.maxLaadmeters) {
    fouten.push("laadmeters_te_groot");
  }

  if (!Number.isFinite(aanvraag.gewichtKg) || aanvraag.gewichtKg < 0) {
    fouten.push("gewicht_ongeldig");
  } else if (aanvraag.gewichtKg > grenzen.maxGewichtKg) {
    fouten.push("gewicht_te_zwaar");
  }

  const datumGeldig = DATUM_PATROON.test(aanvraag.datum)
    && !Number.isNaN(Date.parse(`${aanvraag.datum}T00:00:00Z`));
  if (!datumGeldig) fouten.push("datum_ongeldig");
  else if (aanvraag.datum < lokaleDatum(nu)) fouten.push("datum_verleden");

  const tijdenGeldig = TIJD_PATROON.test(aanvraag.vensterVan) && TIJD_PATROON.test(aanvraag.vensterTot);
  if (!tijdenGeldig) {
    fouten.push("venster_ongeldig");
  } else {
    const duur = minutenVan(aanvraag.vensterTot) - minutenVan(aanvraag.vensterVan);
    if (duur <= 0) fouten.push("venster_omgekeerd");
    else if (duur < grenzen.minVensterMinuten) waarschuwingen.push("venster_te_kort");
  }

  // Aanmeldtijd: hoeveel uur zit er tussen nu en het begin van het losvenster?
  // Te krap betekent dat de rit van morgen al staat — de planner moet het zien,
  // maar de order mag er wel in.
  if (datumGeldig && tijdenGeldig && !fouten.includes("datum_verleden")) {
    const start = lokaalTijdstipMs(aanvraag.datum, ...(aanvraag.vensterVan.split(":").map(Number) as [number, number]));
    const uren = (start - Date.parse(nu)) / 3_600_000;
    if (uren < grenzen.minAanmeldUren) waarschuwingen.push("krappe_aanmeldtijd");
  }

  return { fouten, waarschuwingen, mag: fouten.length === 0 };
}

export interface AanvraagIds {
  tenantId: string;
  orderId: string;
  zendingId: string;
  /** Ons eigen ordernummer, zichtbaar op de factuur. */
  referentie: string;
  barcode: string;
}

/**
 * Zet een goedgekeurde aanvraag om in de canonieke order en zending. Roep dit
 * alleen aan als `controleerAanvraag` groen was: de omzetting controleert niet
 * nog eens, maar weigert wel te raden bij een onbruikbare datum of tijd.
 */
export function naarOrderEnZending(
  aanvraag: Orderaanvraag,
  ids: AanvraagIds
): { order: Order; zending: Zending } {
  if (!DATUM_PATROON.test(aanvraag.datum) || !TIJD_PATROON.test(aanvraag.vensterVan) || !TIJD_PATROON.test(aanvraag.vensterTot)) {
    throw new Error("Aanvraag met een ongeldige datum of tijd kan niet worden omgezet — controleer hem eerst.");
  }
  const naarIso = (hhmm: string) => {
    const [u, m] = hhmm.split(":").map(Number);
    return new Date(lokaalTijdstipMs(aanvraag.datum, u, m)).toISOString();
  };

  const order: Order = {
    id: ids.orderId,
    tenantId: ids.tenantId,
    opdrachtgever: aanvraag.opdrachtgever.trim(),
    referentie: aanvraag.klantreferentie.trim() || ids.referentie,
  };
  const zending: Zending = {
    id: ids.zendingId,
    tenantId: ids.tenantId,
    orderId: order.id,
    barcode: ids.barcode,
    laadmeters: aanvraag.laadmeters,
    gewichtKg: aanvraag.gewichtKg,
    omschrijving: aanvraag.omschrijving.trim() || "Transportopdracht",
    van: { naam: aanvraag.vanNaam.trim(), plaats: aanvraag.vanPlaats.trim(), land: "NL" },
    naar: {
      naam: aanvraag.naarNaam.trim(),
      plaats: aanvraag.naarPlaats.trim(),
      land: "NL",
      tijdvenster: { van: naarIso(aanvraag.vensterVan), tot: naarIso(aanvraag.vensterTot) },
    },
  };
  return { order, zending };
}
