// Rapportage: geaggregeerde cijfers over een periode, voor de controller en de
// gesprekken met opdrachtgevers. Alles is afgeleid uit de event-log en de
// planning — er wordt niets opgeslagen (CLAUDE.md §5.1), dus een rapport over
// een afgesloten week levert morgen hetzelfde antwoord als vandaag.
//
// Elke functie krijgt platte lijsten mee en kent de UI niet. Geld blijft
// integer in centen, tijden blijven UTC; de weergave rekent om.

import { taakStatus, type TaakEvent, type TaakStatus } from "./events";
import { lokaleDatum } from "./tijd";
import type { Geld, Order, Rit, Taak, Zending } from "./types";

/** Halfopen periode [van, tot): de dag van `tot` valt er niet meer in. */
export interface Periode {
  /** YYYY-MM-DD, eerste dag inclusief. */
  van: string;
  /** YYYY-MM-DD, laatste dag inclusief. */
  tot: string;
}

export function inPeriode(datum: string, periode: Periode): boolean {
  return datum >= periode.van && datum <= periode.tot;
}

export interface RapportInvoer {
  periode: Periode;
  ritten: readonly Rit[];
  taken: readonly Taak[];
  events: readonly TaakEvent[];
  zendingen: Readonly<Record<string, Zending>>;
  orders: Readonly<Record<string, Order>>;
  /** Gereden kilometers per rit-id. Komt uit de boordcomputer of de simulatie. */
  kilometersPerRit?: Readonly<Record<string, number>>;
  /** Tarief per zending in centen, als er al een prijsafspraak is. */
  omzetPerZendingCenten?: Readonly<Record<string, number>>;
}

interface Uitvoering {
  taak: Taak;
  status: TaakStatus;
  /** Tijdstip van het afrondende event, of null als de taak nog niet af is. */
  afgerondOp: string | null;
  /** Minuten te laat t.o.v. het einde van het tijdvenster. Negatief = te vroeg. */
  afwijkingMinuten: number | null;
}

/**
 * Zet taken om in uitvoeringsfeiten. Een taak zonder events bestaat niet, dus
 * die slaan we over in plaats van te raden — een rapport dat gokt is erger dan
 * een rapport dat een regel mist.
 */
function uitvoeringen(invoer: RapportInvoer): Uitvoering[] {
  const perTaak = new Map<string, TaakEvent[]>();
  for (const e of invoer.events) {
    const lijst = perTaak.get(e.taakId);
    if (lijst) lijst.push(e);
    else perTaak.set(e.taakId, [e]);
  }
  for (const lijst of perTaak.values()) {
    lijst.sort((a, b) => Date.parse(a.tijdstip) - Date.parse(b.tijdstip));
  }

  const ritDatum = new Map(invoer.ritten.map((r) => [r.id, r.datum]));
  const resultaat: Uitvoering[] = [];
  for (const taak of invoer.taken) {
    const datum = ritDatum.get(taak.ritId);
    if (datum === undefined || !inPeriode(datum, invoer.periode)) continue;
    const eigen = perTaak.get(taak.id);
    if (!eigen || eigen.length === 0) continue;

    const status = taakStatus(eigen);
    const afrondend = eigen.filter((e) => e.type === "geladen" || e.type === "gelost").at(-1);
    const afgerondOp = status === "afgerond" && afrondend ? afrondend.tijdstip : null;
    const venster = taak.adres.tijdvenster;
    const afwijkingMinuten = afgerondOp && venster
      ? Math.round((Date.parse(afgerondOp) - Date.parse(venster.tot)) / 60_000)
      : null;
    resultaat.push({ taak, status, afgerondOp, afwijkingMinuten });
  }
  return resultaat;
}

/** Een stop telt als op tijd als hij binnen of vóór het venster is afgerond. */
function opTijd(u: Uitvoering): boolean {
  return u.afwijkingMinuten !== null && u.afwijkingMinuten <= 0;
}

function percentage(deel: number, geheel: number): number | null {
  return geheel === 0 ? null : Math.round((deel / geheel) * 100);
}

// ── Rapport 1: per opdrachtgever ────────────────────────────────────────────

export interface RegelOpdrachtgever {
  opdrachtgever: string;
  orders: number;
  zendingen: number;
  laadmeters: number;
  gewichtKg: number;
  stops: number;
  stopsOpTijd: number;
  stopsMetVenster: number;
  punctualiteitPct: number | null;
  omzet: Geld;
}

export function perOpdrachtgever(invoer: RapportInvoer): RegelOpdrachtgever[] {
  const uit = uitvoeringen(invoer);
  const per = new Map<string, RegelOpdrachtgever>();
  const ordersGezien = new Map<string, Set<string>>();
  const zendingenGezien = new Map<string, Set<string>>();

  const leeg = (naam: string): RegelOpdrachtgever => ({
    opdrachtgever: naam, orders: 0, zendingen: 0, laadmeters: 0, gewichtKg: 0,
    stops: 0, stopsOpTijd: 0, stopsMetVenster: 0, punctualiteitPct: null,
    omzet: { bedragCenten: 0, valuta: "EUR" },
  });

  for (const u of uit) {
    const zendingId = u.taak.zendingId;
    if (!zendingId) continue;
    const zending = invoer.zendingen[zendingId];
    if (!zending) continue;
    const order = invoer.orders[zending.orderId];
    const naam = order?.opdrachtgever ?? "onbekend";

    let regel = per.get(naam);
    if (!regel) { regel = leeg(naam); per.set(naam, regel); }

    regel.stops += 1;
    if (u.taak.adres.tijdvenster && u.afgerondOp) {
      regel.stopsMetVenster += 1;
      if (opTijd(u)) regel.stopsOpTijd += 1;
    }

    const orders = ordersGezien.get(naam) ?? new Set<string>();
    orders.add(zending.orderId);
    ordersGezien.set(naam, orders);

    const zendingen = zendingenGezien.get(naam) ?? new Set<string>();
    // Een zending met laden én lossen levert twee stops maar telt één keer mee
    // in lading en omzet.
    if (!zendingen.has(zendingId)) {
      regel.laadmeters += zending.laadmeters;
      regel.gewichtKg += zending.gewichtKg;
      regel.omzet.bedragCenten += invoer.omzetPerZendingCenten?.[zendingId] ?? 0;
    }
    zendingen.add(zendingId);
    zendingenGezien.set(naam, zendingen);
  }

  for (const [naam, regel] of per) {
    regel.orders = ordersGezien.get(naam)?.size ?? 0;
    regel.zendingen = zendingenGezien.get(naam)?.size ?? 0;
    regel.laadmeters = Math.round(regel.laadmeters * 10) / 10;
    regel.punctualiteitPct = percentage(regel.stopsOpTijd, regel.stopsMetVenster);
  }
  return [...per.values()].sort((a, b) => b.omzet.bedragCenten - a.omzet.bedragCenten || a.opdrachtgever.localeCompare(b.opdrachtgever));
}

// ── Rapport 2: per chauffeur ────────────────────────────────────────────────

export interface RegelChauffeur {
  chauffeur: string;
  ritten: number;
  gewerkteDagen: number;
  stops: number;
  stopsAfgerond: number;
  stopsMetProbleem: number;
  stopsOpTijd: number;
  stopsMetVenster: number;
  punctualiteitPct: number | null;
  kilometers: number;
}

export function perChauffeur(invoer: RapportInvoer): RegelChauffeur[] {
  const uit = uitvoeringen(invoer);
  const per = new Map<string, RegelChauffeur>();
  const dagenGezien = new Map<string, Set<string>>();
  const ritVanTaak = new Map(invoer.taken.map((tk) => [tk.id, tk.ritId]));
  const ritten = new Map(invoer.ritten.map((r) => [r.id, r]));

  const leeg = (naam: string): RegelChauffeur => ({
    chauffeur: naam, ritten: 0, gewerkteDagen: 0, stops: 0, stopsAfgerond: 0,
    stopsMetProbleem: 0, stopsOpTijd: 0, stopsMetVenster: 0,
    punctualiteitPct: null, kilometers: 0,
  });

  for (const rit of invoer.ritten) {
    if (!inPeriode(rit.datum, invoer.periode) || !rit.chauffeur) continue;
    let regel = per.get(rit.chauffeur);
    if (!regel) { regel = leeg(rit.chauffeur); per.set(rit.chauffeur, regel); }
    regel.ritten += 1;
    regel.kilometers += invoer.kilometersPerRit?.[rit.id] ?? 0;
    const dagen = dagenGezien.get(rit.chauffeur) ?? new Set<string>();
    dagen.add(rit.datum);
    dagenGezien.set(rit.chauffeur, dagen);
  }

  for (const u of uit) {
    const ritId = ritVanTaak.get(u.taak.id);
    const chauffeur = ritId ? ritten.get(ritId)?.chauffeur : undefined;
    if (!chauffeur) continue;
    const regel = per.get(chauffeur);
    if (!regel) continue;
    regel.stops += 1;
    if (u.status === "afgerond") regel.stopsAfgerond += 1;
    if (u.status === "probleem") regel.stopsMetProbleem += 1;
    if (u.taak.adres.tijdvenster && u.afgerondOp) {
      regel.stopsMetVenster += 1;
      if (opTijd(u)) regel.stopsOpTijd += 1;
    }
  }

  for (const [naam, regel] of per) {
    regel.gewerkteDagen = dagenGezien.get(naam)?.size ?? 0;
    regel.punctualiteitPct = percentage(regel.stopsOpTijd, regel.stopsMetVenster);
    regel.kilometers = Math.round(regel.kilometers);
  }
  return [...per.values()].sort((a, b) => b.ritten - a.ritten || a.chauffeur.localeCompare(b.chauffeur));
}

// ── Rapport 3: per voertuig ─────────────────────────────────────────────────

export interface RegelVoertuig {
  kentekenGenormaliseerd: string;
  landcode: string;
  omschrijving: string;
  ritten: number;
  kilometers: number;
  capaciteitLaadmeters: number;
  /** Som van de geladen laadmeters over alle ritten in de periode. */
  geladenLaadmeters: number;
  /** Gemiddelde benutting over de ritten, in procenten van de capaciteit. */
  benuttingPct: number | null;
}

export function perVoertuig(invoer: RapportInvoer): RegelVoertuig[] {
  const per = new Map<string, RegelVoertuig>();
  const takenVanRit = new Map<string, Taak[]>();
  for (const tk of invoer.taken) {
    const lijst = takenVanRit.get(tk.ritId);
    if (lijst) lijst.push(tk);
    else takenVanRit.set(tk.ritId, [tk]);
  }

  const benuttingen = new Map<string, number[]>();
  for (const rit of invoer.ritten) {
    if (!inPeriode(rit.datum, invoer.periode)) continue;
    const sleutel = rit.voertuig.kentekenGenormaliseerd;
    let regel = per.get(sleutel);
    if (!regel) {
      regel = {
        kentekenGenormaliseerd: sleutel,
        landcode: rit.voertuig.landcode,
        omschrijving: rit.voertuig.omschrijving,
        ritten: 0, kilometers: 0,
        capaciteitLaadmeters: rit.voertuig.capaciteitLaadmeters,
        geladenLaadmeters: 0, benuttingPct: null,
      };
      per.set(sleutel, regel);
    }
    regel.ritten += 1;
    regel.kilometers += invoer.kilometersPerRit?.[rit.id] ?? 0;

    const zendingIds = new Set(
      (takenVanRit.get(rit.id) ?? []).map((tk) => tk.zendingId).filter((id): id is string => !!id)
    );
    let lm = 0;
    for (const id of zendingIds) lm += invoer.zendingen[id]?.laadmeters ?? 0;
    regel.geladenLaadmeters += lm;

    const cap = rit.voertuig.capaciteitLaadmeters;
    if (cap > 0) {
      const lijst = benuttingen.get(sleutel) ?? [];
      lijst.push((lm / cap) * 100);
      benuttingen.set(sleutel, lijst);
    }
  }

  for (const [sleutel, regel] of per) {
    regel.kilometers = Math.round(regel.kilometers);
    regel.geladenLaadmeters = Math.round(regel.geladenLaadmeters * 10) / 10;
    const lijst = benuttingen.get(sleutel);
    regel.benuttingPct = lijst?.length
      ? Math.round(lijst.reduce((a, b) => a + b, 0) / lijst.length)
      : null;
  }
  return [...per.values()].sort((a, b) => b.ritten - a.ritten || a.kentekenGenormaliseerd.localeCompare(b.kentekenGenormaliseerd));
}

// ── Rapport 4: punctualiteit per losadres ───────────────────────────────────

export interface RegelAdres {
  naam: string;
  plaats: string;
  stops: number;
  metVenster: number;
  opTijd: number;
  teLaat: number;
  punctualiteitPct: number | null;
  /** Gemiddelde afwijking van de te late stops, in minuten. */
  gemiddeldTeLaatMinuten: number | null;
  ergsteTeLaatMinuten: number | null;
}

export function perAdres(invoer: RapportInvoer): RegelAdres[] {
  const per = new Map<string, RegelAdres & { afwijkingen: number[] }>();
  for (const u of uitvoeringen(invoer)) {
    const sleutel = `${u.taak.adres.naam}|${u.taak.adres.plaats}`;
    let regel = per.get(sleutel);
    if (!regel) {
      regel = {
        naam: u.taak.adres.naam, plaats: u.taak.adres.plaats,
        stops: 0, metVenster: 0, opTijd: 0, teLaat: 0,
        punctualiteitPct: null, gemiddeldTeLaatMinuten: null,
        ergsteTeLaatMinuten: null, afwijkingen: [],
      };
      per.set(sleutel, regel);
    }
    regel.stops += 1;
    if (u.afwijkingMinuten === null) continue;
    regel.metVenster += 1;
    if (u.afwijkingMinuten <= 0) regel.opTijd += 1;
    else { regel.teLaat += 1; regel.afwijkingen.push(u.afwijkingMinuten); }
  }

  return [...per.values()]
    .map(({ afwijkingen, ...regel }) => ({
      ...regel,
      punctualiteitPct: percentage(regel.opTijd, regel.metVenster),
      gemiddeldTeLaatMinuten: afwijkingen.length
        ? Math.round(afwijkingen.reduce((a, b) => a + b, 0) / afwijkingen.length)
        : null,
      ergsteTeLaatMinuten: afwijkingen.length ? Math.max(...afwijkingen) : null,
    }))
    .sort((a, b) => b.teLaat - a.teLaat || b.stops - a.stops || a.naam.localeCompare(b.naam));
}

// ── Rapport 5: dagtotalen, voor een verloop over de periode ─────────────────

export interface RegelDag {
  datum: string;
  ritten: number;
  stops: number;
  stopsAfgerond: number;
  kilometers: number;
}

export function perDag(invoer: RapportInvoer): RegelDag[] {
  const per = new Map<string, RegelDag>();
  const ritDatum = new Map<string, string>();

  for (const rit of invoer.ritten) {
    if (!inPeriode(rit.datum, invoer.periode)) continue;
    ritDatum.set(rit.id, rit.datum);
    let regel = per.get(rit.datum);
    if (!regel) {
      regel = { datum: rit.datum, ritten: 0, stops: 0, stopsAfgerond: 0, kilometers: 0 };
      per.set(rit.datum, regel);
    }
    regel.ritten += 1;
    regel.kilometers += invoer.kilometersPerRit?.[rit.id] ?? 0;
  }

  const ritVanTaak = new Map(invoer.taken.map((tk) => [tk.id, tk.ritId]));
  for (const u of uitvoeringen(invoer)) {
    const datum = ritDatum.get(ritVanTaak.get(u.taak.id) ?? "");
    const regel = datum ? per.get(datum) : undefined;
    if (!regel) continue;
    regel.stops += 1;
    if (u.status === "afgerond") regel.stopsAfgerond += 1;
  }

  for (const regel of per.values()) regel.kilometers = Math.round(regel.kilometers);
  return [...per.values()].sort((a, b) => a.datum.localeCompare(b.datum));
}

// ── Periodes ────────────────────────────────────────────────────────────────

export type PeriodeKeuze = "vandaag" | "deze_week" | "vorige_week" | "deze_maand" | "vorige_maand";

function verschuif(datum: string, dagen: number): string {
  const [j, m, d] = datum.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, d + dagen)).toISOString().slice(0, 10);
}

/**
 * Zet een keuze om in een periode, gerekend vanaf `nu` in lokale tijd. De week
 * loopt van maandag tot en met zondag, net als in de rij- en rusttijden (§5.3).
 */
export function periodeVan(keuze: PeriodeKeuze, nu: string): Periode {
  const vandaag = lokaleDatum(nu);
  const [j, m, d] = vandaag.split("-").map(Number);
  const weekdag = (new Date(Date.UTC(j, m - 1, d)).getUTCDay() + 6) % 7; // 0 = maandag
  const maandag = verschuif(vandaag, -weekdag);

  switch (keuze) {
    case "vandaag":
      return { van: vandaag, tot: vandaag };
    case "deze_week":
      return { van: maandag, tot: verschuif(maandag, 6) };
    case "vorige_week":
      return { van: verschuif(maandag, -7), tot: verschuif(maandag, -1) };
    case "deze_maand": {
      const eerste = `${j}-${String(m).padStart(2, "0")}-01`;
      const laatste = new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10);
      return { van: eerste, tot: laatste };
    }
    case "vorige_maand": {
      const vorigeMaand = new Date(Date.UTC(j, m - 2, 1));
      const vj = vorigeMaand.getUTCFullYear();
      const vm = vorigeMaand.getUTCMonth() + 1;
      return {
        van: `${vj}-${String(vm).padStart(2, "0")}-01`,
        tot: new Date(Date.UTC(vj, vm, 0)).toISOString().slice(0, 10),
      };
    }
  }
}

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * CSV met puntkomma als scheidingsteken en een komma als decimaalteken: dat is
 * wat Excel in een Nederlandse installatie zonder importwizard opent.
 */
export function naarCsv(
  kolommen: readonly string[],
  rijen: readonly (readonly (string | number | null)[])[]
): string {
  const cel = (waarde: string | number | null): string => {
    if (waarde === null) return "";
    const tekst = typeof waarde === "number"
      ? String(waarde).replace(".", ",")
      : waarde;
    return /[";\n]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
  };
  return [kolommen, ...rijen].map((rij) => rij.map(cel).join(";")).join("\r\n");
}
