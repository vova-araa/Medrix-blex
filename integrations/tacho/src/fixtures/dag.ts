import type { RuweTachoAntwoord } from "../types";

// Vastgelegd voorbeeldantwoord, in de vorm zoals een tachograafleverancier
// die aanlevert. Geen live aanroepen in tests (§6): dit is de contractbron.
// De demodag is 7 augustus 2026; Amsterdam staat dan op UTC+2.
export const FIXTURE_DAG: RuweTachoAntwoord = {
  retrievedAtUtc: "2026-08-07T10:42:00Z",
  activities: [
    {
      driverCardNumber: "NLD0000012345678",
      driverName: "J. Peeters",
      vehicleRegistration: "43-BKL-7",
      activity: "REST",
      startUtc: "2026-08-06T18:00:00Z",
      endUtc: "2026-08-07T03:40:00Z",
    },
    {
      driverCardNumber: "NLD0000012345678",
      driverName: "J. Peeters",
      vehicleRegistration: "43-BKL-7",
      activity: "DRIVING",
      startUtc: "2026-08-07T03:50:00Z",
      endUtc: "2026-08-07T04:28:00Z",
    },
    {
      driverCardNumber: "NLD0000012345678",
      driverName: "J. Peeters",
      vehicleRegistration: "43-BKL-7",
      activity: "OTHER_WORK",
      startUtc: "2026-08-07T04:28:00Z",
      endUtc: "2026-08-07T04:57:00Z",
    },
    {
      driverCardNumber: "NLD0000012345678",
      driverName: "J. Peeters",
      vehicleRegistration: "43-BKL-7",
      activity: "DRIVING",
      startUtc: "2026-08-07T05:01:00Z",
      endUtc: null,
    },
    {
      // Kaart niet ingestoken: komt binnen zonder chauffeur.
      driverCardNumber: null,
      driverName: null,
      vehicleRegistration: "66-KLM-2",
      activity: "AVAILABILITY",
      startUtc: "2026-08-07T06:00:00Z",
      endUtc: "2026-08-07T06:30:00Z",
    },
  ],
  downloads: [
    {
      downloadId: "DL-9001",
      type: "VEHICLE_UNIT",
      vehicleRegistration: "43-BKL-7",
      downloadedAtUtc: "2026-07-08T22:15:00Z",
      fileName: "M_20260709_0015_43BKL7.ddd",
    },
    {
      downloadId: "DL-9002",
      type: "DRIVER_CARD",
      driverName: "J. Peeters",
      downloadedAtUtc: "2026-08-01T18:20:00Z",
      fileName: "C_20260801_2020_Peeters.ddd",
    },
    {
      // Kowalski: 30 dagen geleden — de 28-dagentermijn is verstreken.
      downloadId: "DL-9003",
      type: "DRIVER_CARD",
      driverName: "M. Kowalski",
      downloadedAtUtc: "2026-07-08T18:20:00Z",
      fileName: "C_20260708_2020_Kowalski.ddd",
    },
  ],
  consents: [
    {
      driverName: "J. Peeters",
      vehicleRegistration: "43-BKL-7",
      consentGivenAtUtc: "2026-03-02T08:00:00Z",
    },
  ],
};
