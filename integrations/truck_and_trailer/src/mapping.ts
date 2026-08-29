import { normaliseerKenteken } from "@sharzi/domain";
import type {
  ExternVlootRespons,
  ExternVoertuig,
  KoppelingTrailer,
  KoppelingVoertuig,
  Vloot,
} from "./types";

const TREKKENDE_CATEGORIEEN = new Set(["TRACTOR", "RIGID", "VAN"]);

function naarVoertuig(extern: ExternVoertuig): KoppelingVoertuig {
  if (
    extern.monthlyCostCents !== undefined &&
    !Number.isInteger(extern.monthlyCostCents)
  ) {
    throw new Error(
      `Truck & Trailer: monthlyCostCents moet een integer in centen zijn, kreeg ${extern.monthlyCostCents} (${extern.registration})`
    );
  }
  const kenteken = normaliseerKenteken(extern.countryCode, extern.registration);
  return {
    kenteken: kenteken.kenteken,
    landcode: kenteken.landcode,
    omschrijving: extern.description,
    kmStand: extern.odometerKm ?? 0,
    apkTot: extern.motExpiryDate ?? "",
    tachograafGekeurd: extern.tachographInspectionDate,
    volgendeOnderhoudKm: extern.nextServiceKm ?? 0,
    verbruikL100: extern.fuelConsumptionL100 ?? 0,
    kostenPerMaandCenten: extern.monthlyCostCents ?? 0,
  };
}

function naarTrailer(extern: ExternVoertuig): KoppelingTrailer {
  const kenteken = normaliseerKenteken(extern.countryCode, extern.registration);
  return {
    kenteken: kenteken.kenteken,
    landcode: kenteken.landcode,
    omschrijving: extern.description,
  };
}

/**
 * Volledige vloot-upsert: kenteken is de natuurlijke sleutel, dubbelen winnen
 * op volgorde (laatste wint, zoals de directive voorschrijft). Onbekende
 * categorieën falen hard — nooit stilzwijgend overslaan (§6.3).
 */
export function mapVloot(respons: ExternVlootRespons): Vloot {
  const voertuigen = new Map<string, KoppelingVoertuig>();
  const trailers = new Map<string, KoppelingTrailer>();

  for (const extern of respons.vehicles) {
    if (extern.category === "TRAILER") {
      const trailer = naarTrailer(extern);
      trailers.set(`${trailer.landcode}|${trailer.kenteken}`, trailer);
    } else if (TREKKENDE_CATEGORIEEN.has(extern.category)) {
      const voertuig = naarVoertuig(extern);
      voertuigen.set(`${voertuig.landcode}|${voertuig.kenteken}`, voertuig);
    } else {
      throw new Error(
        `Truck & Trailer: onbekende category "${extern.category}" voor ${extern.registration} — mapping bijwerken vereist`
      );
    }
  }

  return {
    syncTijdstip: respons.generatedAt,
    voertuigen: [...voertuigen.values()],
    trailers: [...trailers.values()],
  };
}
