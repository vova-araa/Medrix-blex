// Het ritdossier: alles van één rit bij elkaar, van planning tot geld.
//
// Dit is het scherm waar een planner op terugvalt als iemand belt: "wat is er
// met die rit gebeurd?" Gepland naast werkelijk, waar de tijd verdween, welke
// uren erin zitten, wat de rit heeft opgebracht en wat hij heeft gekost.
//
// Alles wordt afgeleid — er is geen opgeslagen ritresultaat. Een dossier van
// vorige week geeft daarom volgend jaar hetzelfde antwoord.

import { taakStatus, type TaakEvent, type TaakStatus } from "./events";
import { geld } from "./geld";
import type { Geld, Rit, Taak, Zending } from "./types";

export interface DossierStop {
  taakId: string;
  soort: Taak["soort"];
  adresNaam: string;
  plaats: string;
  status: TaakStatus;
  geplandVan: string;
  geplandTot: string;
  /** Uit de event-log; null zolang er niets is geregistreerd. */
  aangekomen: string | null;
  afgerond: string | null;
  /** Minuten later dan gepland aangekomen; negatief is te vroeg. */
  afwijkingMinuten: number | null;
  /** Hoe lang de auto op het adres stond, van aankomst tot afronding. */
  standtijdMinuten: number | null;
  /** Standtijd boven de vrije periode — dit is wat er te factureren valt. */
  wachtMinuten: number;
  tijdvenster: { van: string; tot: string } | null;
  binnenVenster: boolean | null;
  zendingId?: string;
  barcode?: string;
  laadmeters?: number;
}

export interface DossierGeld {
  /** Wat de rit opbrengt: vracht plus wachturen. */
  opbrengst: Geld;
  vracht: Geld;
  wachturen: Geld;
  /** Wat de rit kost: kilometers plus uren. */
  kosten: Geld;
  kilometerkosten: Geld;
  uurkosten: Geld;
  /** Opbrengst min kosten. Negatief betekent verlies op deze rit. */
  saldo: Geld;
  /** Marge in procenten van de opbrengst; null bij nul opbrengst. */
  margePct: number | null;
}

export interface Ritdossier {
  ritId: string;
  datum: string;
  chauffeur: string;
  kentekenGenormaliseerd: string;
  landcode: string;
  charter: boolean;
  stops: DossierStop[];
  /** Stops die zijn afgerond, van het totaal dat niet vervallen is. */
  afgerond: number;
  totaal: number;
  /** Eerste registratie en laatste registratie van de dag. */
  eersteActie: string | null;
  laatsteActie: string | null;
  /** Duur van de rit in minuten, van eerste tot laatste registratie. */
  duurMinuten: number | null;
  /** Som van de standtijden boven de vrije periode. */
  totaalWachtMinuten: number;
  /** Stops die buiten hun venster zijn afgerond. */
  buitenVenster: number;
  kilometers: number | null;
  laadmeters: number;
  geld: DossierGeld;
}

export interface DossierTarieven {
  /** Vrije standtijd voordat er wachturen gelden. */
  vrijeWachtMinuten: number;
  wachtuurCenten: number;
  /** Kostprijs per kilometer: brandstof, banden, onderhoud, afschrijving. */
  kostenPerKmCenten: number;
  /** Kostprijs per uur chauffeur, inclusief werkgeverslasten. */
  kostenPerUurCenten: number;
}

export interface DossierInvoer {
  rit: Rit;
  taken: readonly Taak[];
  eventsVanTaak: (taakId: string) => readonly TaakEvent[];
  zendingen: Readonly<Record<string, Zending>>;
  /** Vrachtopbrengst per zending in centen. */
  vrachtCenten: (zendingId: string) => number;
  kilometers?: number | null;
  tarieven: DossierTarieven;
}

const minutenTussen = (van: string, tot: string) =>
  Math.round((Date.parse(tot) - Date.parse(van)) / 60_000);

export function bouwRitdossier(invoer: DossierInvoer): Ritdossier {
  const stops = invoer.taken.map((taak) => bouwStop(taak, invoer));
  const meetellend = stops.filter((s) => s.status !== "vervallen");

  const momenten = stops
    .flatMap((s) => [s.aangekomen, s.afgerond])
    .filter((m): m is string => m !== null)
    .sort();
  const eersteActie = momenten[0] ?? null;
  const laatsteActie = momenten[momenten.length - 1] ?? null;

  const totaalWachtMinuten = meetellend.reduce((som, s) => som + s.wachtMinuten, 0);
  const laadmeters = Math.round(
    meetellend.reduce((som, s) => som + (s.laadmeters ?? 0), 0) * 10
  ) / 10;

  return {
    ritId: invoer.rit.id,
    datum: invoer.rit.datum,
    chauffeur: invoer.rit.chauffeur,
    kentekenGenormaliseerd: invoer.rit.voertuig.kentekenGenormaliseerd,
    landcode: invoer.rit.voertuig.landcode,
    charter: invoer.rit.charter,
    stops,
    afgerond: meetellend.filter((s) => s.status === "afgerond").length,
    totaal: meetellend.length,
    eersteActie,
    laatsteActie,
    duurMinuten: eersteActie && laatsteActie ? minutenTussen(eersteActie, laatsteActie) : null,
    totaalWachtMinuten,
    buitenVenster: meetellend.filter((s) => s.binnenVenster === false).length,
    kilometers: invoer.kilometers ?? null,
    laadmeters,
    geld: rekenGeld(meetellend, invoer, totaalWachtMinuten, eersteActie, laatsteActie),
  };
}

function bouwStop(taak: Taak, invoer: DossierInvoer): DossierStop {
  const events = invoer.eventsVanTaak(taak.id);
  const status = events.length > 0 ? taakStatus(events) : "gepland";
  const aangekomen = events.find((e) => e.type === "aangekomen")?.tijdstip ?? null;
  const afgerond = events.filter((e) => e.type === "geladen" || e.type === "gelost").at(-1)?.tijdstip ?? null;

  const standtijdMinuten = aangekomen && afgerond ? minutenTussen(aangekomen, afgerond) : null;
  const wachtMinuten = standtijdMinuten === null
    ? 0
    : Math.max(0, standtijdMinuten - invoer.tarieven.vrijeWachtMinuten);

  const venster = taak.adres.tijdvenster ?? null;
  const zending = taak.zendingId ? invoer.zendingen[taak.zendingId] : undefined;

  return {
    taakId: taak.id,
    soort: taak.soort,
    adresNaam: taak.adres.naam,
    plaats: taak.adres.plaats,
    status,
    geplandVan: taak.geplandVan,
    geplandTot: taak.geplandTot,
    aangekomen,
    afgerond,
    afwijkingMinuten: aangekomen ? minutenTussen(taak.geplandVan, aangekomen) : null,
    standtijdMinuten,
    wachtMinuten,
    tijdvenster: venster,
    // Zonder venster valt er niets te halen of te missen; dat is niet
    // hetzelfde als "op tijd", dus null en niet true.
    binnenVenster: venster && afgerond ? Date.parse(afgerond) <= Date.parse(venster.tot) : null,
    zendingId: taak.zendingId,
    barcode: zending?.barcode,
    laadmeters: taak.soort === "lossen" ? zending?.laadmeters : undefined,
  };
}

/**
 * Opbrengst en kosten van de rit. Vracht telt per zending één keer, ook als
 * die zowel geladen als gelost wordt — anders staat de omzet dubbel.
 */
function rekenGeld(
  stops: readonly DossierStop[],
  invoer: DossierInvoer,
  wachtMinuten: number,
  eersteActie: string | null,
  laatsteActie: string | null
): DossierGeld {
  const gezien = new Set<string>();
  let vrachtCenten = 0;
  for (const stop of stops) {
    if (!stop.zendingId || gezien.has(stop.zendingId)) continue;
    gezien.add(stop.zendingId);
    vrachtCenten += invoer.vrachtCenten(stop.zendingId);
  }

  const wachtCenten = Math.round((wachtMinuten / 60) * invoer.tarieven.wachtuurCenten);
  const opbrengstCenten = vrachtCenten + wachtCenten;

  const kmCenten = invoer.kilometers
    ? Math.round(invoer.kilometers * invoer.tarieven.kostenPerKmCenten)
    : 0;
  const urenMinuten = eersteActie && laatsteActie ? minutenTussen(eersteActie, laatsteActie) : 0;
  const uurCenten = Math.round((urenMinuten / 60) * invoer.tarieven.kostenPerUurCenten);
  const kostenCenten = kmCenten + uurCenten;

  const saldoCenten = opbrengstCenten - kostenCenten;
  return {
    opbrengst: geld(opbrengstCenten),
    vracht: geld(vrachtCenten),
    wachturen: geld(wachtCenten),
    kosten: geld(kostenCenten),
    kilometerkosten: geld(kmCenten),
    uurkosten: geld(uurCenten),
    saldo: geld(saldoCenten),
    margePct: opbrengstCenten === 0 ? null : Math.round((saldoCenten / opbrengstCenten) * 100),
  };
}
