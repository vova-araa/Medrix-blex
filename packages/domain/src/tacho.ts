// Tachograafdata: uitgelezen activiteiten, uitleestermijnen en toestemming.
// Zie directives/connector_tacho.md — deze module is leverancieronafhankelijk;
// een connector mapt de data van Roadsoft, Webfleet, VDO Fleet of een andere
// leverancier op dit model.
//
// Harde regel: de tachograaf is het bewijs, onze eigen berekening is een
// hulpmiddel. Waar ze verschillen, tonen we het verschil.

export const TACHO_REGELS = {
  /** Voertuigunit uitlezen: uiterlijk elke 90 dagen. */
  uitleesVoertuigDagen: 90,
  /** Chauffeurskaart uitlezen: uiterlijk elke 28 dagen. */
  uitleesChauffeurskaartDagen: 28,
  /** Bewaarplicht van uitgelezen data. */
  bewaarplichtDagen: 365,
  /** Vanaf hoeveel dagen resterend gaan we waarschuwen. */
  waarschuwVanafDagen: 7,
} as const;

/** Waar een geregistreerde activiteit vandaan komt. */
export type ActiviteitBron = "tachograaf" | "app" | "handmatig";

export type UitlezingSoort = "voertuig" | "chauffeurskaart";

export interface TachoUitlezing {
  id: string;
  tenantId: string;
  soort: UitlezingSoort;
  /** Gevuld bij soort "voertuig". */
  kentekenGenormaliseerd?: string;
  /** Gevuld bij soort "chauffeurskaart". */
  chauffeur?: string;
  /** Wanneer de uitlezing is gedaan. */
  tijdstip: string;
  bestandsnaam: string;
}

export interface TachoToestemming {
  chauffeur: string;
  kentekenGenormaliseerd: string;
  gegevenOp: string;
}

export type UitleesErnst = "ok" | "waarschuwing" | "verstreken";

export interface UitleesStatus {
  soort: UitlezingSoort;
  /** Kenteken of chauffeursnaam, afhankelijk van de soort. */
  onderwerp: string;
  laatsteUitlezingIso: string | null;
  dagenGeleden: number | null;
  dagenResterend: number | null;
  termijnDagen: number;
  ernst: UitleesErnst;
}

const DAG_MS = 86_400_000;

function statusVan(
  soort: UitlezingSoort,
  onderwerp: string,
  laatste: TachoUitlezing | undefined,
  nuMs: number
): UitleesStatus {
  const termijnDagen = soort === "voertuig"
    ? TACHO_REGELS.uitleesVoertuigDagen
    : TACHO_REGELS.uitleesChauffeurskaartDagen;

  if (!laatste) {
    // Nooit uitgelezen is geen "nog even tijd": dat is direct een probleem.
    return {
      soort, onderwerp,
      laatsteUitlezingIso: null, dagenGeleden: null, dagenResterend: null,
      termijnDagen, ernst: "verstreken",
    };
  }
  const dagenGeleden = Math.floor((nuMs - Date.parse(laatste.tijdstip)) / DAG_MS);
  const dagenResterend = termijnDagen - dagenGeleden;
  return {
    soort, onderwerp,
    laatsteUitlezingIso: laatste.tijdstip,
    dagenGeleden,
    dagenResterend,
    termijnDagen,
    ernst: dagenResterend < 0
      ? "verstreken"
      : dagenResterend <= TACHO_REGELS.waarschuwVanafDagen
        ? "waarschuwing"
        : "ok",
  };
}

/**
 * Bewaakt de wettelijke uitleestermijnen: 90 dagen per voertuig, 28 dagen per
 * chauffeurskaart. Onderwerpen zonder enkele uitlezing komen terug als
 * "verstreken" — nooit stilzwijgend weggelaten.
 */
export function uitleesStatussen(
  uitlezingen: readonly TachoUitlezing[],
  vloot: { kentekens: readonly string[]; chauffeurs: readonly string[] },
  nu: string
): UitleesStatus[] {
  const nuMs = Date.parse(nu);
  const laatste = (test: (u: TachoUitlezing) => boolean) =>
    [...uitlezingen].filter(test).sort((a, b) => a.tijdstip.localeCompare(b.tijdstip)).at(-1);

  const lijst: UitleesStatus[] = [
    ...vloot.kentekens.map((kenteken) =>
      statusVan("voertuig", kenteken,
        laatste((u) => u.soort === "voertuig" && u.kentekenGenormaliseerd === kenteken), nuMs)),
    ...vloot.chauffeurs.map((chauffeur) =>
      statusVan("chauffeurskaart", chauffeur,
        laatste((u) => u.soort === "chauffeurskaart" && u.chauffeur === chauffeur), nuMs)),
  ];

  const gewicht: Record<UitleesErnst, number> = { verstreken: 0, waarschuwing: 1, ok: 2 };
  return lijst.sort(
    (a, b) => gewicht[a.ernst] - gewicht[b.ernst] ||
      (a.dagenResterend ?? -999) - (b.dagenResterend ?? -999)
  );
}

/** Heeft deze chauffeur toestemming gegeven voor live data uit dit voertuig? */
export function heeftToestemming(
  toestemmingen: readonly TachoToestemming[],
  chauffeur: string,
  kentekenGenormaliseerd: string
): boolean {
  return toestemmingen.some(
    (t) => t.chauffeur === chauffeur && t.kentekenGenormaliseerd === kentekenGenormaliseerd
  );
}

/**
 * Betrouwbaarheid van de rijtijdstand: leunt die op uitgelezen tachograafdata
 * of alleen op wat de chauffeur in de app aantikte? De planner moet dat zien
 * voordat hij op de cijfers vertrouwt.
 */
export function bronOordeel(bronnen: readonly ActiviteitBron[]): {
  bron: ActiviteitBron | "gemengd" | "geen";
  onderbouwd: boolean;
} {
  if (bronnen.length === 0) return { bron: "geen", onderbouwd: false };
  const uniek = [...new Set(bronnen)];
  if (uniek.length === 1) {
    return { bron: uniek[0], onderbouwd: uniek[0] === "tachograaf" };
  }
  return { bron: "gemengd", onderbouwd: false };
}
