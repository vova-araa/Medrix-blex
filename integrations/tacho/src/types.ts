// Ruwe vorm zoals een tachograafleverancier die aanlevert. Bewust apart van
// het domeinmodel: leveranciers veranderen hun veldnamen, ons domein niet.
// Zie directives/connector_tacho.md.

export interface RuweTachoActiviteit {
  /** Kaartnummer van de chauffeur; leeg als er geen kaart is ingestoken. */
  driverCardNumber: string | null;
  driverName: string | null;
  vehicleRegistration: string;
  /** Registrerende lidstaat zoals de tachograaf die vastlegt; NL bij ontbreken. */
  vehicleCountry?: string;
  /** DRIVING | WORK | AVAILABILITY | REST — tachograafcategorieën. */
  activity: string;
  startUtc: string;
  endUtc: string | null;
}

export interface RuweTachoUitlezing {
  downloadId: string;
  type: string; // VEHICLE_UNIT | DRIVER_CARD
  vehicleRegistration?: string;
  vehicleCountry?: string;
  driverName?: string;
  downloadedAtUtc: string;
  fileName: string;
}

export interface RuweTachoToestemming {
  driverName: string;
  vehicleRegistration: string;
  vehicleCountry?: string;
  consentGivenAtUtc: string;
}

export interface RuweTachoAntwoord {
  activities: RuweTachoActiviteit[];
  downloads: RuweTachoUitlezing[];
  consents: RuweTachoToestemming[];
  retrievedAtUtc: string;
}
