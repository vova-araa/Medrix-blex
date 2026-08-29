// Facturen: nummering, status en de wettelijk verplichte gegevens.
// Bedragen blijven integer in centen (§5.4). Een factuur wordt nooit
// verwijderd of aangepast na verzending — een fout corrigeer je met een
// creditnota die naar het origineel verwijst.
//
// Bewaarplicht: 7 jaar vanaf 1 januari volgend op het jaar van opmaken
// (10 jaar bij onroerende zaken). Verwijderen mag dus niet.

import { factuurTotalen, type FactuurRegel, type FactuurTotalen } from "./facturatie";
import type { Geld } from "./types";

export const FACTUUR_REGELS = {
  standaardBetaaltermijnDagen: 30,
  bewaarplichtJaren: 7,
  standaardBtwPercentage: 21,
} as const;

/** Gegevens van de uitgevende partij — wettelijk verplicht op elke factuur. */
export interface Uitgever {
  naam: string;
  adres: string;
  postcodePlaats: string;
  kvkNummer: string;
  btwNummer: string;
  iban?: string;
}

export interface FactuurOntvanger {
  naam: string;
  adres?: string;
  postcodePlaats?: string;
  /** Verplicht bij btw-verlegging binnen de EU. */
  btwNummer?: string;
}

export type FactuurStatus = "concept" | "verstuurd" | "betaald" | "gecrediteerd";

/** 21% standaard; "verlegd" bij intracommunautaire diensten (0% met vermelding). */
export type BtwBehandeling = "standaard" | "verlegd";

export interface Factuur {
  /** Doorlopend en uniek; pas toegekend bij verzending, niet in concept. */
  nummer: string | null;
  tenantId: string;
  ontvanger: FactuurOntvanger;
  /** Referentie of ordernummer van de klant. */
  referentie?: string;
  datumIso: string | null;
  vervaldatumIso: string | null;
  regels: FactuurRegel[];
  btwBehandeling: BtwBehandeling;
  status: FactuurStatus;
  /** Bij een creditnota: het nummer van de factuur die gecorrigeerd wordt. */
  crediteertNummer?: string;
}

/**
 * Volgend doorlopend factuurnummer binnen een jaar: `2026-0001`. Doorlopend
 * en zonder gaten — de Belastingdienst eist een uniek doorlopend nummer, dus
 * we tellen door op het hoogste bestaande nummer van dat jaar.
 */
export function volgendFactuurnummer(
  bestaande: readonly string[],
  jaar: number
): string {
  const voorvoegsel = `${jaar}-`;
  const hoogste = bestaande
    .filter((n) => n.startsWith(voorvoegsel))
    .map((n) => Number(n.slice(voorvoegsel.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${voorvoegsel}${String(hoogste + 1).padStart(4, "0")}`;
}

export function totalenVan(factuur: Factuur): FactuurTotalen {
  // Bij verlegde btw staat er 0% op de factuur, met vermelding "btw verlegd".
  const percentage = factuur.btwBehandeling === "verlegd"
    ? 0
    : FACTUUR_REGELS.standaardBtwPercentage;
  return factuurTotalen(factuur.regels, percentage);
}

export function vervaldatum(
  datumIso: string,
  termijnDagen = FACTUUR_REGELS.standaardBetaaltermijnDagen
): string {
  return new Date(Date.parse(datumIso) + termijnDagen * 86_400_000).toISOString();
}

export type OntbrekendVeld =
  | "uitgever_naam" | "uitgever_adres" | "uitgever_kvk" | "uitgever_btw"
  | "ontvanger_naam" | "ontvanger_adres"
  | "factuurnummer" | "factuurdatum" | "regels"
  | "omschrijving" | "ontvanger_btw_bij_verlegd";

/**
 * Controleert de wettelijk verplichte gegevens vóór verzending. Een factuur
 * die hier iets teruggeeft, mag niet de deur uit — beter tegengehouden dan
 * achteraf gecorrigeerd met een creditnota.
 */
export function ontbrekendeGegevens(
  factuur: Factuur,
  uitgever: Uitgever
): OntbrekendVeld[] {
  const ontbreekt: OntbrekendVeld[] = [];
  const leeg = (v?: string | null) => !v || v.trim() === "";

  if (leeg(uitgever.naam)) ontbreekt.push("uitgever_naam");
  if (leeg(uitgever.adres) || leeg(uitgever.postcodePlaats)) ontbreekt.push("uitgever_adres");
  if (leeg(uitgever.kvkNummer)) ontbreekt.push("uitgever_kvk");
  if (leeg(uitgever.btwNummer)) ontbreekt.push("uitgever_btw");

  if (leeg(factuur.ontvanger.naam)) ontbreekt.push("ontvanger_naam");
  if (leeg(factuur.ontvanger.adres) || leeg(factuur.ontvanger.postcodePlaats)) {
    ontbreekt.push("ontvanger_adres");
  }
  if (factuur.btwBehandeling === "verlegd" && leeg(factuur.ontvanger.btwNummer)) {
    ontbreekt.push("ontvanger_btw_bij_verlegd");
  }

  if (leeg(factuur.nummer)) ontbreekt.push("factuurnummer");
  if (leeg(factuur.datumIso)) ontbreekt.push("factuurdatum");
  if (factuur.regels.length === 0) ontbreekt.push("regels");
  else if (factuur.regels.some((r) => leeg(r.omschrijving))) ontbreekt.push("omschrijving");

  return ontbreekt;
}

export function magVerstuurdWorden(factuur: Factuur, uitgever: Uitgever): boolean {
  return ontbrekendeGegevens(factuur, uitgever).length === 0;
}

/**
 * Maakt een creditnota op een verstuurde factuur. De bedragen zijn de
 * tegenboeking; het origineel blijft ongewijzigd bestaan.
 */
export function maakCreditnota(
  origineel: Factuur,
  nummer: string,
  datumIso: string,
  /** Leeg = volledige creditering; anders alleen de opgegeven regels. */
  alleenRegels?: readonly FactuurRegel[]
): Factuur {
  if (!origineel.nummer) {
    throw new Error("Een concept zonder factuurnummer kan niet gecrediteerd worden — pas hem gewoon aan.");
  }
  const bron = alleenRegels ?? origineel.regels;
  const negatief: FactuurRegel[] = bron.map((regel) => ({
    omschrijving: regel.omschrijving,
    bedrag: { ...regel.bedrag, bedragCenten: -regel.bedrag.bedragCenten } as Geld,
  }));
  return {
    nummer,
    tenantId: origineel.tenantId,
    ontvanger: origineel.ontvanger,
    referentie: origineel.referentie,
    datumIso,
    vervaldatumIso: vervaldatum(datumIso),
    regels: negatief,
    btwBehandeling: origineel.btwBehandeling,
    status: "verstuurd",
    crediteertNummer: origineel.nummer,
  };
}

export interface OpenPost {
  nummer: string;
  ontvanger: string;
  totaal: Geld;
  vervaldatumIso: string;
  dagenTeLaat: number;
}

/** Openstaande facturen die over de vervaldatum zijn, oudste eerst. */
export function achterstallig(
  facturen: readonly Factuur[],
  nu: string
): OpenPost[] {
  const nuMs = Date.parse(nu);
  return facturen
    .filter((f) => f.status === "verstuurd" && f.nummer && f.vervaldatumIso)
    .map((f) => ({
      nummer: f.nummer!,
      ontvanger: f.ontvanger.naam,
      totaal: totalenVan(f).totaal,
      vervaldatumIso: f.vervaldatumIso!,
      dagenTeLaat: Math.floor((nuMs - Date.parse(f.vervaldatumIso!)) / 86_400_000),
    }))
    .filter((p) => p.dagenTeLaat > 0)
    .sort((a, b) => b.dagenTeLaat - a.dagenTeLaat);
}
