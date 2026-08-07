// Coördinaten van plaatsen uit de demodata. De ingebouwde kaart is nu een
// schematische weergave op echte lat/lon; zodra we live gaan schuift hier een
// tegel-laag (OSM of betaalde provider) achter met dezelfde projectie-API.

export const PLAATS_COORDS: Record<string, [number, number]> = {
  Venlo: [51.37, 6.172],
  Veghel: [51.616, 5.548],
  Helmond: [51.481, 5.661],
  Lieshout: [51.52, 5.591],
  Maasbree: [51.356, 6.048],
  Aalsmeer: [52.264, 4.75],
  Roermond: [51.191, 5.988],
  Nijmegen: [51.842, 5.852],
  Haaksbergen: [52.157, 6.74],
  Panningen: [51.327, 5.973],
};

const LAT_MIN = 50.95, LAT_MAX = 52.55, LON_MIN = 4.35, LON_MAX = 7.05;

export function project(
  lat: number,
  lon: number,
  breedte: number,
  hoogte: number
): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * breedte;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * hoogte;
  return [x, y];
}

const WEGFACTOR = 1.25;

export function kmTussen(a: [number, number], b: [number, number]): number {
  const r = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la = (a[0] * Math.PI) / 180;
  const lb = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)) * WEGFACTOR);
}
