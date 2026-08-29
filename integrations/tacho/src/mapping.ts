import {
  normaliseerKenteken,
  type ActiviteitBron, type ActiviteitSoort,
  type TachoToestemming, type TachoUitlezing, type UitlezingSoort,
} from "@sharzi/domain";
import type {
  RuweTachoActiviteit, RuweTachoToestemming, RuweTachoUitlezing,
} from "./types";

const TENANT = "blex";
/** De tachograaf levert het kenteken; de landcode staat er niet altijd bij. */
const STANDAARD_LAND = "NL";
const kenteken = (registratie: string, land?: string) =>
  normaliseerKenteken(land ?? STANDAARD_LAND, registratie).kenteken;

/** Tachograafcategorieën → onze activiteitsoorten. */
const SOORT: Record<string, ActiviteitSoort> = {
  DRIVING: "rijden",
  WORK: "werk",
  OTHER_WORK: "werk",
  AVAILABILITY: "beschikbaar",
  POA: "beschikbaar",
  REST: "rust",
  BREAK: "rust",
};

export interface TachoActiviteit {
  chauffeur: string | null;
  kentekenGenormaliseerd: string;
  soort: ActiviteitSoort;
  vanIso: string;
  /** null = nog lopend op het moment van uitlezen. */
  totIso: string | null;
  bron: ActiviteitBron;
}

/**
 * Een onbekende activiteitscode mag nooit stil als "rust" wegvallen — dat zou
 * rijtijd laten verdwijnen. We gooien liever een fout die de connector logt.
 */
export function mapActiviteit(ruw: RuweTachoActiviteit): TachoActiviteit {
  const soort = SOORT[ruw.activity?.toUpperCase()];
  if (!soort) {
    throw new Error(
      `Onbekende tachograaf-activiteit "${ruw.activity}" — mapping bijwerken voordat dit stil wegvalt.`
    );
  }
  return {
    chauffeur: ruw.driverName,
    kentekenGenormaliseerd: kenteken(ruw.vehicleRegistration, ruw.vehicleCountry),
    soort,
    vanIso: ruw.startUtc,
    totIso: ruw.endUtc,
    bron: "tachograaf",
  };
}

const UITLEZING_SOORT: Record<string, UitlezingSoort> = {
  VEHICLE_UNIT: "voertuig",
  DRIVER_CARD: "chauffeurskaart",
};

export function mapUitlezing(ruw: RuweTachoUitlezing): TachoUitlezing {
  const soort = UITLEZING_SOORT[ruw.type?.toUpperCase()];
  if (!soort) {
    throw new Error(`Onbekend uitlezingstype "${ruw.type}" — mapping bijwerken.`);
  }
  return {
    id: ruw.downloadId,
    tenantId: TENANT,
    soort,
    kentekenGenormaliseerd: ruw.vehicleRegistration
      ? kenteken(ruw.vehicleRegistration, ruw.vehicleCountry)
      : undefined,
    chauffeur: ruw.driverName,
    tijdstip: ruw.downloadedAtUtc,
    bestandsnaam: ruw.fileName,
  };
}

export function mapToestemming(ruw: RuweTachoToestemming): TachoToestemming {
  return {
    chauffeur: ruw.driverName,
    kentekenGenormaliseerd: kenteken(ruw.vehicleRegistration, ruw.vehicleCountry),
    gegevenOp: ruw.consentGivenAtUtc,
  };
}
