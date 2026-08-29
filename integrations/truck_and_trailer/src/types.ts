// Externe payload van Truck & Trailer (veldnamen zijn een aanname tot de
// echte API-documentatie er is — zie directives/connector_truck_and_trailer.md).

export type ExternCategorie = "TRACTOR" | "RIGID" | "VAN" | "TRAILER";

export interface ExternVoertuig {
  registration: string;
  countryCode: string;
  category: ExternCategorie;
  description: string;
  odometerKm?: number;
  motExpiryDate?: string;
  /** Laatste periodieke tachograafkeuring (elke 2 jaar verplicht). */
  tachographInspectionDate?: string;
  nextServiceKm?: number;
  fuelConsumptionL100?: number;
  monthlyCostCents?: number;
}

export interface ExternVlootRespons {
  generatedAt: string;
  vehicles: ExternVoertuig[];
}

// Genormaliseerde uitvoer richting Sharzi (structureel gelijk aan de
// Wagenpark- en Trailer-vormen in de app).

export interface KoppelingVoertuig {
  kenteken: string;
  landcode: string;
  omschrijving: string;
  kmStand: number;
  apkTot: string;
  tachograafGekeurd?: string;
  volgendeOnderhoudKm: number;
  verbruikL100: number;
  kostenPerMaandCenten: number;
}

export interface KoppelingTrailer {
  kenteken: string;
  landcode: string;
  omschrijving: string;
}

export interface Vloot {
  syncTijdstip: string;
  voertuigen: KoppelingVoertuig[];
  trailers: KoppelingTrailer[];
}
