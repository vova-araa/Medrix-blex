// Slepen op het planbord: een stop naar een andere tijd of een andere auto.
//
// Dit is de handeling waarmee een planner zijn dag stuurt, en precies daarom
// mag hij er niet stil iets mee slopen. Wat fysiek niet kan wordt geweigerd
// met een reden die uit te leggen is aan de chauffeur; wat mag maar opvalt —
// buiten het afgesproken venster — gaat door als waarschuwing.
//
// De lastigste regel zit in het paar laden/lossen. Sleep je alleen de losstop
// naar een andere auto, dan zou de zending op de ene wagen geladen en van de
// andere gelost worden. Zolang beide stops nog openstaan verhuizen ze samen;
// staat de vracht al op de andere auto, dan kan het niet meer en weigeren we.

import type { TaakStatus } from "./events";
import { controleerVolgorde, type VolgordeFout } from "./route";
import type { Rit, Taak } from "./types";

export type HerplanFoutCode =
  /** Wat gebeurd is verzet je niet; de event-log is het bewijs (§5.1). */
  | "afgeronde_stop"
  /** De chauffeur staat er al of is onderweg. */
  | "stop_bezig"
  /** Plannen in het verleden. */
  | "in_verleden"
  /** Laden op de ene auto, lossen van de andere. */
  | "paar_gescheiden"
  /** De laadmeters passen niet op het voertuig. */
  | "capaciteit"
  /** Tussen twee stops zit minder tijd dan de rit ertussen duurt. */
  | "rijtijd"
  /** De rit loopt door tot na het einde van de dienst. */
  | "buiten_dienst"
  /** Een volgorde die niet uitvoerbaar is; zie route.ts. */
  | "volgorde";

export interface HerplanFout {
  code: HerplanFoutCode;
  taakId?: string;
  /** Minuten die tekortkomen, of minuten te laat. */
  minuten?: number;
  /** Laadmeters die te veel op de auto staan. */
  laadmeters?: number;
  volgorde?: VolgordeFout;
}

export interface HerplanWaarschuwing {
  code: "buiten_venster";
  taakId: string;
  /** Minuten buiten het venster; negatief is te vroeg. */
  minuten: number;
}

export interface HerplanInvoer {
  taakId: string;
  /** Waar de planner de stop laat vallen. */
  nieuweStartIso: string;
  /** Taken van de rit waar de stop vandaan komt, in rijvolgorde. */
  bron: readonly Taak[];
  /** Taken van de doelrit; gelijk aan bron bij verschuiven binnen één rit. */
  doel: readonly Taak[];
  doelRit: Rit;
  statusVan: (taakId: string) => TaakStatus;
  reistijdMinuten: (van: string, naar: string) => number;
  /** Laadmeters per zending, voor de capaciteitscontrole. */
  laadmetersVan: (zendingId: string) => number;
  nu: string;
  /** Einde van de dienst van de chauffeur op de doelrit, als hij is ingeklokt. */
  dienstEindeIso?: string;
}

export interface HerplanUitkomst {
  toegestaan: boolean;
  fouten: HerplanFout[];
  waarschuwingen: HerplanWaarschuwing[];
  /** De nieuwe takenlijst van de doelrit, op tijd gesorteerd. */
  doelTaken: Taak[];
  /** Wat er op de bronrit overblijft; leeg bij verschuiven binnen één rit. */
  bronTaken: Taak[];
  /** Zendingen waarvan de tweede stop is meeverhuisd. */
  meeverhuisd: string[];
}

const minuten = (vanIso: string, totIso: string) =>
  Math.round((Date.parse(totIso) - Date.parse(vanIso)) / 60_000);

const verschuif = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

/** De andere helft van het paar laden/lossen van dezelfde zending. */
function partnerVan(taak: Taak, lijst: readonly Taak[]): Taak | undefined {
  if (!taak.zendingId) return undefined;
  const tegenhanger = taak.soort === "laden" ? "lossen" : taak.soort === "lossen" ? "laden" : null;
  if (!tegenhanger) return undefined;
  return lijst.find((t) => t.zendingId === taak.zendingId && t.soort === tegenhanger);
}

/**
 * Beoordeelt een sleep en geeft meteen de nieuwe takenlijsten terug. De
 * aanroeper schrijft ze pas weg als `toegestaan` waar is — beoordelen en
 * uitvoeren zitten hier bewust in één functie, zodat de UI nooit zijn eigen
 * variant van de regels hoeft na te bouwen.
 */
export function beoordeelHerplan(invoer: HerplanInvoer): HerplanUitkomst {
  const fouten: HerplanFout[] = [];
  const waarschuwingen: HerplanWaarschuwing[] = [];
  const taak = invoer.bron.find((t) => t.id === invoer.taakId);

  if (!taak) {
    return {
      toegestaan: false, fouten: [{ code: "afgeronde_stop", taakId: invoer.taakId }],
      waarschuwingen: [], doelTaken: [...invoer.doel], bronTaken: [...invoer.bron],
      meeverhuisd: [],
    };
  }

  const zelfdeRit = taak.ritId === invoer.doelRit.id;
  const status = invoer.statusVan(taak.id);
  if (status === "afgerond" || status === "vervallen") {
    fouten.push({ code: "afgeronde_stop", taakId: taak.id });
  } else if (status === "bezig" || status === "onderweg") {
    fouten.push({ code: "stop_bezig", taakId: taak.id });
  }
  const teVroeg = minuten(invoer.nieuweStartIso, invoer.nu);
  if (teVroeg > 0) fouten.push({ code: "in_verleden", taakId: taak.id, minuten: teVroeg });

  // Het paar laden/lossen verhuist samen naar een andere auto, of niet.
  const meeverhuisd: string[] = [];
  const verhuizers: Taak[] = [taak];
  if (!zelfdeRit) {
    const partner = partnerVan(taak, invoer.bron);
    if (partner) {
      const partnerStatus = invoer.statusVan(partner.id);
      if (partnerStatus === "afgerond" || partnerStatus === "bezig" || partnerStatus === "onderweg") {
        fouten.push({ code: "paar_gescheiden", taakId: partner.id });
      } else {
        verhuizers.push(partner);
        if (partner.zendingId) meeverhuisd.push(partner.zendingId);
      }
    }
  }

  // Het paar houdt zijn onderlinge afstand: sleep je de lossing een uur later,
  // dan schuift het laden mee. Anders zou de tweede stop blijven staan op een
  // tijd die bij de oude auto hoorde.
  const duur = Date.parse(taak.geplandTot) - Date.parse(taak.geplandVan);
  const delta = Date.parse(invoer.nieuweStartIso) - Date.parse(taak.geplandVan);
  const verplaatst: Taak[] = verhuizers.map((t) =>
    t.id === taak.id
      ? {
          ...t, ritId: invoer.doelRit.id,
          geplandVan: invoer.nieuweStartIso,
          geplandTot: verschuif(invoer.nieuweStartIso, duur),
        }
      : {
          ...t, ritId: invoer.doelRit.id,
          geplandVan: verschuif(t.geplandVan, delta),
          geplandTot: verschuif(t.geplandTot, delta),
        }
  );

  const verhuisdeIds = new Set(verhuizers.map((t) => t.id));
  const doelTaken = [...invoer.doel.filter((t) => !verhuisdeIds.has(t.id)), ...verplaatst]
    .sort((a, b) => Date.parse(a.geplandVan) - Date.parse(b.geplandVan));
  const bronTaken = zelfdeRit ? [] : invoer.bron.filter((t) => !verhuisdeIds.has(t.id));

  for (const fout of controleerVolgorde(doelTaken, invoer.statusVan, invoer.doel)) {
    fouten.push({ code: "volgorde", taakId: fout.taakId, volgorde: fout });
  }

  controleerRijtijd(doelTaken, invoer.reistijdMinuten, fouten);
  controleerCapaciteit(doelTaken, invoer.doelRit, invoer.laadmetersVan, fouten);

  if (invoer.dienstEindeIso && doelTaken.length > 0) {
    const eind = doelTaken[doelTaken.length - 1].geplandTot;
    const over = minuten(invoer.dienstEindeIso, eind);
    if (over > 0) fouten.push({ code: "buiten_dienst", minuten: over });
  }

  for (const t of verplaatst) {
    const venster = t.adres.tijdvenster;
    if (!venster) continue;
    const teLaat = minuten(venster.tot, t.geplandTot);
    const vroeg = minuten(t.geplandVan, venster.van);
    if (teLaat > 0) waarschuwingen.push({ code: "buiten_venster", taakId: t.id, minuten: teLaat });
    else if (vroeg > 0) waarschuwingen.push({ code: "buiten_venster", taakId: t.id, minuten: -vroeg });
  }

  return {
    toegestaan: fouten.length === 0,
    fouten, waarschuwingen, doelTaken, bronTaken, meeverhuisd,
  };
}

function controleerRijtijd(
  taken: readonly Taak[],
  reistijdMinuten: (van: string, naar: string) => number,
  fouten: HerplanFout[]
): void {
  for (let i = 1; i < taken.length; i++) {
    const vorige = taken[i - 1];
    const deze = taken[i];
    const gat = minuten(vorige.geplandTot, deze.geplandVan);
    const nodig = reistijdMinuten(vorige.adres.plaats, deze.adres.plaats);
    if (gat < nodig) {
      fouten.push({ code: "rijtijd", taakId: deze.id, minuten: nodig - gat });
    }
  }
}

/**
 * Hoeveel er op de auto staat, op het drukste moment van de rit. Een zending
 * die wel wordt gelost maar niet geladen stond er al op bij vertrek; die telt
 * vanaf het begin mee.
 */
function controleerCapaciteit(
  taken: readonly Taak[],
  rit: Rit,
  laadmetersVan: (zendingId: string) => number,
  fouten: HerplanFout[]
): void {
  const capaciteit = rit.voertuig.capaciteitLaadmeters;
  if (!capaciteit) return;

  const geladenOpRit = new Set(
    taken.filter((t) => t.soort === "laden" && t.zendingId).map((t) => t.zendingId!)
  );
  let aanBoord = taken
    .filter((t) => t.soort === "lossen" && t.zendingId && !geladenOpRit.has(t.zendingId))
    .reduce((som, t) => som + laadmetersVan(t.zendingId!), 0);

  let piek = aanBoord;
  for (const taak of taken) {
    if (!taak.zendingId) continue;
    const lm = laadmetersVan(taak.zendingId);
    if (taak.soort === "laden") aanBoord += lm;
    else if (taak.soort === "lossen") aanBoord -= lm;
    piek = Math.max(piek, aanBoord);
  }

  if (piek > capaciteit + 0.001) {
    fouten.push({ code: "capaciteit", laadmeters: Math.round((piek - capaciteit) * 10) / 10 });
  }
}
