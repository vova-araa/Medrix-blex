import type { ExternVlootRespons } from "../types";

// Vastgelegde voorbeeldrespons (fixture) — de vorm die we van de Truck &
// Trailer-API verwachten. Wordt vervangen door een echte opgenomen respons
// zodra de API-documentatie er is. Geen live calls in tests (§6.4).

export const vlootFixture: ExternVlootRespons = {
  generatedAt: "2026-08-07T03:30:00Z",
  vehicles: [
    {
      registration: "43-BKL-7", countryCode: "nl", category: "TRACTOR",
      description: "Trekker + city-trailer", odometerKm: 412_680,
      motExpiryDate: "2026-09-02", nextServiceKm: 420_000,
      fuelConsumptionL100: 27.4, monthlyCostCents: 312_500,
    },
    {
      registration: "87-TDF-3", countryCode: "NL", category: "RIGID",
      description: "Bakwagen", odometerKm: 188_240,
      motExpiryDate: "2027-03-15", nextServiceKm: 195_000,
      fuelConsumptionL100: 21.1, monthlyCostCents: 218_000,
    },
    {
      registration: "12-PGH-9", countryCode: "NL", category: "RIGID",
      description: "Bakwagen met laadklep", odometerKm: 96_410,
      motExpiryDate: "2026-08-21", nextServiceKm: 100_000,
      fuelConsumptionL100: 22.8, monthlyCostCents: 224_500,
    },
    {
      registration: "66-KLM-2", countryCode: "NL", category: "RIGID",
      description: "Bakwagen", odometerKm: 240_155,
      motExpiryDate: "2026-11-30", nextServiceKm: 245_000,
      fuelConsumptionL100: 21.9, monthlyCostCents: 209_000,
    },
    {
      registration: "OL-84-XF", countryCode: "NL", category: "TRAILER",
      description: "City-trailer, 13,6 m",
    },
    {
      registration: "OK-29-TD", countryCode: "NL", category: "TRAILER",
      description: "Koeltrailer, 13,6 m",
    },
    {
      registration: "OS-61-PB", countryCode: "NL", category: "TRAILER",
      description: "Schuifzeiltrailer, 13,6 m",
    },
  ],
};
