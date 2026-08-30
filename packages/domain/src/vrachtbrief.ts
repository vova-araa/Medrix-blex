// De vrachtbrief is geen formulier maar bewijs. Twee dingen bepalen of hij dat
// ook is: staan de verplichte gegevens erop (art. 6 lid 1 CMR), en is een
// voorbehoud op tijd gemaakt (art. 30 CMR). Beide zijn hier berekenbaar
// gemaakt, zodat de app het kan tonen in plaats van dat iemand het moet weten.
//
// Bronnen:
// · CMR-Verdrag art. 6 lid 1 — verplichte vermeldingen op de vrachtbrief.
// · CMR-Verdrag art. 30 — voorbehoud bij zichtbare schade (bij aflevering),
//   niet-zichtbare schade (7 dagen, zon- en feestdagen niet meegerekend) en
//   vertraging (21 dagen). De dag van aflevering telt niet mee (art. 30 lid 4).
// · Verordening (EU) 2020/1056 (eFTI) — overheden moeten elektronische
//   vrachtgegevens accepteren; zie `EFTI_MIJLPALEN`.

import type { Adres, Zending } from "./types";

// ── Verplichte gegevens (art. 6 lid 1 CMR) ──────────────────────────────────

export type CmrVeld =
  | "plaats_datum_opmaak"
  | "afzender"
  | "vervoerder"
  | "plaats_datum_inontvangstneming"
  | "plaats_aflevering"
  | "geadresseerde"
  | "aard_goederen"
  | "verpakkingswijze"
  | "aantal_colli"
  | "brutogewicht"
  | "vervoerskosten"
  | "cmr_beding";

export const CMR_VERPLICHTE_VELDEN: readonly CmrVeld[] = [
  "plaats_datum_opmaak",
  "afzender",
  "vervoerder",
  "plaats_datum_inontvangstneming",
  "plaats_aflevering",
  "geadresseerde",
  "aard_goederen",
  "verpakkingswijze",
  "aantal_colli",
  "brutogewicht",
  "vervoerskosten",
  "cmr_beding",
];

export interface VrachtbriefGegevens {
  plaatsOpmaak: string;
  datumOpmaak: string | null;
  afzender: Adres | null;
  vervoerder: string;
  /** Waar en wanneer de vervoerder de lading feitelijk overnam. */
  plaatsInontvangstneming: string;
  datumInontvangstneming: string | null;
  geadresseerde: Adres | null;
  aardGoederen: string;
  verpakkingswijze: string;
  aantalColli: number | null;
  brutogewichtKg: number | null;
  /** Vervoerskosten in centen; 0 mag, ontbreken niet. */
  vervoerskostenCenten: number | null;
  /** Staat de verwijzing naar het CMR-Verdrag op het document? */
  cmrBeding: boolean;
}

export interface VrachtbriefControle {
  ontbrekend: CmrVeld[];
  volledig: boolean;
}

/**
 * Welke verplichte vermeldingen ontbreken. Dit blokkeert niets — een rit met
 * een onvolledige vrachtbrief rijdt gewoon — maar het moet zichtbaar zijn
 * voordat er een claim komt.
 */
export function controleerVrachtbrief(g: VrachtbriefGegevens): VrachtbriefControle {
  const ontbrekend: CmrVeld[] = [];
  const leeg = (waarde: string) => waarde.trim() === "";

  if (leeg(g.plaatsOpmaak) || !g.datumOpmaak) ontbrekend.push("plaats_datum_opmaak");
  if (!g.afzender || leeg(g.afzender.naam)) ontbrekend.push("afzender");
  if (leeg(g.vervoerder)) ontbrekend.push("vervoerder");
  if (leeg(g.plaatsInontvangstneming) || !g.datumInontvangstneming) {
    ontbrekend.push("plaats_datum_inontvangstneming");
  }
  if (!g.geadresseerde || leeg(g.geadresseerde.plaats)) ontbrekend.push("plaats_aflevering");
  if (!g.geadresseerde || leeg(g.geadresseerde.naam)) ontbrekend.push("geadresseerde");
  if (leeg(g.aardGoederen)) ontbrekend.push("aard_goederen");
  if (leeg(g.verpakkingswijze)) ontbrekend.push("verpakkingswijze");
  if (g.aantalColli === null || g.aantalColli <= 0) ontbrekend.push("aantal_colli");
  if (g.brutogewichtKg === null || g.brutogewichtKg <= 0) ontbrekend.push("brutogewicht");
  if (g.vervoerskostenCenten === null) ontbrekend.push("vervoerskosten");
  if (!g.cmrBeding) ontbrekend.push("cmr_beding");

  return { ontbrekend, volledig: ontbrekend.length === 0 };
}

// ── Voorbehoud en termijnen (art. 30 CMR) ───────────────────────────────────

export type VoorbehoudSoort =
  /** Schade of manco dat bij aflevering te zien is. */
  | "zichtbaar"
  /** Schade die pas later blijkt. */
  | "niet_zichtbaar"
  /** Te late aflevering. */
  | "vertraging";

export interface Voorbehoud {
  id: string;
  tenantId: string;
  zendingId: string;
  soort: VoorbehoudSoort;
  omschrijving: string;
  /** Wie het voorbehoud maakte: de geadresseerde of onze chauffeur. */
  wie: string;
  tijdstip: string;
  /** Verwijzingen naar foto's; die zijn zelf onveranderlijk (§5.6). */
  fotoIds?: readonly string[];
}

/**
 * Nederlandse feestdagen. Art. 30 lid 1 sluit zon- en feestdagen uit bij het
 * tellen van de zeven dagen; welke dagen dat zijn hangt af van het land van
 * aflevering. Deze lijst is de Nederlandse en moet per land gezet worden.
 */
export const NL_FEESTDAGEN: readonly string[] = [
  "2026-01-01", // Nieuwjaarsdag
  "2026-04-03", // Goede Vrijdag
  "2026-04-06", // Tweede Paasdag
  "2026-04-27", // Koningsdag
  "2026-05-14", // Hemelvaartsdag
  "2026-05-25", // Tweede Pinksterdag
  "2026-12-25", // Eerste Kerstdag
  "2026-12-26", // Tweede Kerstdag
  "2027-01-01",
  "2027-03-26",
  "2027-03-29",
  "2027-04-27",
  "2027-05-06",
  "2027-05-17",
  "2027-12-25",
  "2027-12-26",
];

export const CMR_TERMIJNEN = {
  /** Art. 30 lid 1: niet-zichtbare schade, zon- en feestdagen niet meegerekend. */
  nietZichtbaarDagen: 7,
  /** Art. 30 lid 3: vertraging, een vervaltermijn in kalenderdagen. */
  vertragingDagen: 21,
} as const;

const dagVan = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isZondag = (ms: number) => new Date(ms).getUTCDay() === 0;

/**
 * Uiterste dag voor een schriftelijk voorbehoud. De dag van aflevering telt
 * niet mee (art. 30 lid 4). Bij niet-zichtbare schade worden zondagen en
 * feestdagen overgeslagen; bij vertraging tellen alle kalenderdagen.
 */
export function voorbehoudDeadline(
  afgeleverdIso: string,
  soort: Exclude<VoorbehoudSoort, "zichtbaar">,
  feestdagen: readonly string[] = NL_FEESTDAGEN
): string {
  const start = Date.parse(`${afgeleverdIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start)) throw new Error(`Onbruikbare afleverdatum: ${afgeleverdIso}`);

  if (soort === "vertraging") {
    return dagVan(start + CMR_TERMIJNEN.vertragingDagen * 86_400_000);
  }

  const vrij = new Set(feestdagen);
  let ms = start;
  let geteld = 0;
  // Ruime bovengrens: zelfs met een feestweek zijn zeven telbare dagen binnen
  // een maand bereikt. Slaat de lus toch door, dan klopt de feestdagenlijst niet.
  for (let stap = 0; geteld < CMR_TERMIJNEN.nietZichtbaarDagen && stap < 60; stap++) {
    ms += 86_400_000;
    if (isZondag(ms) || vrij.has(dagVan(ms))) continue;
    geteld++;
  }
  if (geteld < CMR_TERMIJNEN.nietZichtbaarDagen) {
    throw new Error("Kon de termijn niet bepalen; controleer de feestdagenlijst.");
  }
  return dagVan(ms);
}

export interface TermijnStand {
  soort: Exclude<VoorbehoudSoort, "zichtbaar">;
  /** Laatste dag waarop een voorbehoud nog telt, als YYYY-MM-DD. */
  uiterlijk: string;
  /** Hele dagen tot en met de uiterste dag; negatief betekent verstreken. */
  dagenOver: number;
  verstreken: boolean;
  /** Is er al een voorbehoud van deze soort vastgelegd? */
  gemeld: boolean;
}

/**
 * Stand van de termijnen bij één afgeleverde zending. Zichtbare schade heeft
 * geen termijn — die moet bij de aflevering zelf worden aangetekend, dus daar
 * telt alleen of het gebeurd is.
 */
export function termijnenVan(
  afgeleverdIso: string,
  voorbehouden: readonly Voorbehoud[],
  nu: string,
  feestdagen: readonly string[] = NL_FEESTDAGEN
): {
  zichtbaarGemeld: boolean;
  termijnen: TermijnStand[];
} {
  const vandaag = Date.parse(`${nu.slice(0, 10)}T00:00:00Z`);
  const soorten: Array<Exclude<VoorbehoudSoort, "zichtbaar">> = ["niet_zichtbaar", "vertraging"];

  return {
    zichtbaarGemeld: voorbehouden.some((v) => v.soort === "zichtbaar"),
    termijnen: soorten.map((soort) => {
      const uiterlijk = voorbehoudDeadline(afgeleverdIso, soort, feestdagen);
      const dagenOver = Math.round(
        (Date.parse(`${uiterlijk}T00:00:00Z`) - vandaag) / 86_400_000
      );
      return {
        soort,
        uiterlijk,
        dagenOver,
        verstreken: dagenOver < 0,
        gemeld: voorbehouden.some((v) => v.soort === soort),
      };
    }),
  };
}

// ── Opbouw uit het eigen datamodel ──────────────────────────────────────────

/**
 * Zet een zending om in vrachtbriefgegevens. Wat wij niet weten blijft leeg —
 * dan komt het als ontbrekend veld naar boven in plaats van dat er iets
 * plausibels wordt ingevuld.
 */
export function vrachtbriefVan(invoer: {
  zending: Zending;
  vervoerder: string;
  plaatsOpmaak: string;
  datumOpmaak: string | null;
  /** Tijdstip waarop er daadwerkelijk geladen is, uit de event-log. */
  geladenOp: string | null;
  aantalColli: number | null;
  verpakkingswijze: string;
  vervoerskostenCenten: number | null;
}): VrachtbriefGegevens {
  const { zending } = invoer;
  return {
    plaatsOpmaak: invoer.plaatsOpmaak,
    datumOpmaak: invoer.datumOpmaak,
    afzender: zending.van,
    vervoerder: invoer.vervoerder,
    plaatsInontvangstneming: zending.van.plaats,
    datumInontvangstneming: invoer.geladenOp,
    geadresseerde: zending.naar,
    aardGoederen: zending.omschrijving,
    verpakkingswijze: invoer.verpakkingswijze,
    aantalColli: invoer.aantalColli,
    brutogewichtKg: zending.gewichtKg > 0 ? zending.gewichtKg : null,
    vervoerskostenCenten: invoer.vervoerskostenCenten,
    // Het beding staat vast op onze eigen documentvorm.
    cmrBeding: true,
  };
}

// ── eFTI ────────────────────────────────────────────────────────────────────

/**
 * Data uit Verordening (EU) 2020/1056 die bepalen wanneer een elektronische
 * vrachtbrief bij een controle geaccepteerd moet worden. Staan hier zodat de
 * planning van de koppelingen erop kan worden gezet.
 */
export const EFTI_MIJLPALEN = [
  {
    datum: "2026-08-21",
    wat: "Autoriteiten in de EU accepteren vrachtgegevens via gecertificeerde eFTI-platformen.",
  },
  {
    datum: "2027-07-09",
    wat: "Autoriteiten accepteren e-CMR-gegevens digitaal.",
  },
  {
    datum: "2027-07-08",
    wat: "Einde van de Benelux-regeling voor de e-CMR.",
  },
] as const;
