// Dagelijkse voertuigcontrole en gebrekmelding.
//
// De chauffeur loopt voor vertrek om de auto heen en tekent af wat hij ziet.
// Dat is geen formaliteit: bij een wegcontrole kijkt de ILT naar de technische
// staat, en een gebrek dat wel bekend was maar niet gemeld is, is een ander
// verhaal dan een gebrek dat onderweg ontstond. De lijst is daarom een event:
// hij wordt vastgelegd met tijdstip, chauffeur en voertuig, en daarna niet meer
// gewijzigd (CLAUDE.md §5.1).
//
// Wat de chauffeur afkeurt gaat als melding naar de garage. Wij bepalen niet of
// de auto de weg op mag — dat doet de garage — maar een gebrek op een
// veiligheidskritisch punt blokkeert wel de planning tot iemand ernaar gekeken
// heeft.

export type ControlePunt =
  | "banden"
  | "verlichting"
  | "remmen"
  | "vloeistoffen"
  | "spiegels_ruiten"
  | "opbouw_laadklep"
  | "koppeling_trailer"
  | "lading_zekering"
  | "papieren"
  | "cabine_veiligheid";

export interface ControlePuntDef {
  punt: ControlePunt;
  /** Een gebrek hier raakt de verkeersveiligheid: dat blokkeert de planning. */
  kritisch: boolean;
}

/** Volgorde is de looprichting om de auto heen: eerst buiten, dan de cabine. */
export const CONTROLEPUNTEN: readonly ControlePuntDef[] = [
  { punt: "banden", kritisch: true },
  { punt: "verlichting", kritisch: true },
  { punt: "remmen", kritisch: true },
  { punt: "koppeling_trailer", kritisch: true },
  { punt: "lading_zekering", kritisch: true },
  { punt: "spiegels_ruiten", kritisch: true },
  { punt: "vloeistoffen", kritisch: false },
  { punt: "opbouw_laadklep", kritisch: false },
  { punt: "cabine_veiligheid", kritisch: false },
  { punt: "papieren", kritisch: false },
];

export type PuntStand = "in_orde" | "gebrek" | "niet_gecontroleerd";

export interface Voertuigcontrole {
  id: string;
  tenantId: string;
  /** Genormaliseerd kenteken van de trekker of bakwagen. */
  kentekenGenormaliseerd: string;
  /** Genormaliseerd kenteken van de trailer, als die eraan hangt. */
  trailerKenteken?: string;
  chauffeur: string;
  ritId?: string;
  tijdstip: string;
  kilometerstand?: number;
  standen: Readonly<Record<ControlePunt, PuntStand>>;
  /** Toelichting per punt dat is afgekeurd. */
  toelichting: Readonly<Partial<Record<ControlePunt, string>>>;
}

export interface ControleOordeel {
  /** Punten die zijn afgekeurd. */
  gebreken: ControlePunt[];
  /** Afgekeurde punten die de verkeersveiligheid raken. */
  kritiekeGebreken: ControlePunt[];
  /** Punten die de chauffeur niet heeft nagelopen. */
  nietGecontroleerd: ControlePunt[];
  /** Alles nagelopen én niets afgekeurd. */
  volledigInOrde: boolean;
  /**
   * De auto hoort niet weg te gaan zonder dat de garage ernaar kijkt. Dit is
   * een signaal aan de planning, geen technisch oordeel — dat velt de garage.
   */
  blokkeertPlanning: boolean;
}

export function beoordeelControle(controle: Voertuigcontrole): ControleOordeel {
  const gebreken: ControlePunt[] = [];
  const kritieke: ControlePunt[] = [];
  const nietGecontroleerd: ControlePunt[] = [];

  for (const { punt, kritisch } of CONTROLEPUNTEN) {
    const stand = controle.standen[punt];
    if (stand === "gebrek") {
      gebreken.push(punt);
      if (kritisch) kritieke.push(punt);
    } else if (stand !== "in_orde") {
      nietGecontroleerd.push(punt);
    }
  }

  return {
    gebreken,
    kritiekeGebreken: kritieke,
    nietGecontroleerd,
    volledigInOrde: gebreken.length === 0 && nietGecontroleerd.length === 0,
    blokkeertPlanning: kritieke.length > 0,
  };
}

/** Lege lijst om mee te beginnen: niets is gecontroleerd tot de chauffeur kijkt. */
export function legeStanden(): Record<ControlePunt, PuntStand> {
  const standen = {} as Record<ControlePunt, PuntStand>;
  for (const { punt } of CONTROLEPUNTEN) standen[punt] = "niet_gecontroleerd";
  return standen;
}

// ── Melding naar de garage ──────────────────────────────────────────────────

export type MeldingStatus = "open" | "ingepland" | "verholpen";

export interface Garagemelding {
  id: string;
  tenantId: string;
  kentekenGenormaliseerd: string;
  /** Waar het gebrek zit; vrije melding zonder controlepunt mag ook. */
  punt?: ControlePunt;
  omschrijving: string;
  /** Zet de planning stil tot de garage kijkt. */
  kritisch: boolean;
  gemeldDoor: string;
  gemeldOp: string;
  /** Verwijzing naar een foto; die is zelf onveranderlijk (§5.6). */
  fotoIds?: readonly string[];
  /** Herkomst: uit de dagelijkse controle of los gemeld onderweg. */
  bron: "dagcontrole" | "onderweg";
  /** Append-only afhandeling: elke stap is een nieuwe regel. */
  afhandeling: readonly {
    status: MeldingStatus;
    tijdstip: string;
    wie: string;
    notitie?: string;
  }[];
}

export function meldingStatus(melding: Garagemelding): MeldingStatus {
  return melding.afhandeling.length === 0
    ? "open"
    : melding.afhandeling[melding.afhandeling.length - 1].status;
}

/** Openstaande meldingen per voertuig, kritieke eerst en dan op datum. */
export function openMeldingen(meldingen: readonly Garagemelding[]): Garagemelding[] {
  return meldingen
    .filter((m) => meldingStatus(m) !== "verholpen")
    .sort((a, b) =>
      Number(b.kritisch) - Number(a.kritisch) ||
      Date.parse(a.gemeldOp) - Date.parse(b.gemeldOp)
    );
}

/**
 * Voertuigen met een openstaand kritiek gebrek. Die horen niet ingepland te
 * worden voordat de garage ernaar gekeken heeft.
 */
export function geblokkeerdeVoertuigen(meldingen: readonly Garagemelding[]): string[] {
  return [...new Set(
    meldingen
      .filter((m) => m.kritisch && meldingStatus(m) !== "verholpen")
      .map((m) => m.kentekenGenormaliseerd)
  )].sort();
}

/**
 * Maakt uit een afgekeurde dagcontrole één melding per gebrek. Zo blijft de
 * controle het bewijs en is elke melding los af te handelen — een lekke band
 * is morgen verholpen, een lekkende cilinder niet.
 */
export function meldingenUitControle(
  controle: Voertuigcontrole,
  idVoor: (punt: ControlePunt) => string
): Garagemelding[] {
  const kritischPunt = new Map(CONTROLEPUNTEN.map((d) => [d.punt, d.kritisch]));
  return beoordeelControle(controle).gebreken.map((punt) => ({
    id: idVoor(punt),
    tenantId: controle.tenantId,
    kentekenGenormaliseerd: controle.kentekenGenormaliseerd,
    punt,
    omschrijving: controle.toelichting[punt]?.trim() || "",
    kritisch: kritischPunt.get(punt) ?? false,
    gemeldDoor: controle.chauffeur,
    gemeldOp: controle.tijdstip,
    bron: "dagcontrole",
    afhandeling: [],
  }));
}

/** Zet een melding een stap verder. De historie blijft staan (§5.1). */
export function handelAf(
  melding: Garagemelding,
  status: MeldingStatus,
  wie: string,
  tijdstip: string,
  notitie?: string
): Garagemelding {
  if (meldingStatus(melding) === status) return melding;
  return {
    ...melding,
    afhandeling: [...melding.afhandeling, { status, tijdstip, wie, ...(notitie ? { notitie } : {}) }],
  };
}
