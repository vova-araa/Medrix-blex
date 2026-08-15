import type { Rit, Taak } from "@sharzi/domain";
import {
  actieveTakenVanRit,
  eventsVanTaak,
  statusVanTaak,
  type AppState,
} from "../data/state";
import { kmTussen, PLAATS_COORDS } from "./coords";

// Verkeersdata is in deze fase GESIMULEERD: de vorm (meldingen per weg,
// vertraging per leg, ETA per taak) is echt, alleen de bron nog niet.
// Zodra er een provider is (TomTom/HERE/NDW) vervangt die alleen VERKEER.

export interface VerkeersMelding {
  id: string;
  weg: string;
  omschrijving: string;
  vertragingMin: number;
}

export const VERKEER: VerkeersMelding[] = [
  { id: "V-1", weg: "A67", omschrijving: "Ongeval bij Eindhoven — rijstrook dicht", vertragingMin: 18 },
  { id: "V-2", weg: "A2", omschrijving: "Wegwerkzaamheden knooppunt Deil", vertragingMin: 12 },
];

const sleutel = (a: string, b: string) => [a, b].sort().join("|");

const CORRIDORS: Record<string, string[]> = {
  [sleutel("Venlo", "Veghel")]: ["A67", "A50"],
  [sleutel("Veghel", "Helmond")]: ["N279"],
  [sleutel("Helmond", "Venlo")]: ["A67"],
  [sleutel("Venlo", "Lieshout")]: ["A67", "N615"],
  [sleutel("Lieshout", "Lieshout")]: [],
  [sleutel("Maasbree", "Aalsmeer")]: ["A67", "A2"],
  [sleutel("Venlo", "Roermond")]: ["A73"],
  [sleutel("Venlo", "Haaksbergen")]: ["A73", "A35"],
  [sleutel("Panningen", "Nijmegen")]: ["A73"],
  [sleutel("Veghel", "Venlo")]: ["A50", "A67"],
  [sleutel("Venlo", "Helmond")]: ["A67"],
};

export function wegenOpLeg(a: string, b: string): string[] {
  return CORRIDORS[sleutel(a, b)] ?? [];
}

/** Kaartsegmenten waar een verkeersmelding op ligt (voor de rode markering). */
export function verkeersSegmenten(): Array<{ melding: VerkeersMelding; van: string; naar: string }> {
  const segmenten: Array<{ melding: VerkeersMelding; van: string; naar: string }> = [];
  for (const melding of VERKEER) {
    for (const [paar, wegen] of Object.entries(CORRIDORS)) {
      if (wegen.includes(melding.weg)) {
        const [van, naar] = paar.split("|");
        segmenten.push({ melding, van, naar });
        break;
      }
    }
  }
  return segmenten;
}

export function vertragingOpLeg(a: string, b: string): number {
  const wegen = wegenOpLeg(a, b);
  return VERKEER.filter((v) => wegen.includes(v.weg)).reduce(
    (som, v) => som + v.vertragingMin,
    0
  );
}

function vorigePlaats(taken: Taak[], index: number): string {
  return index > 0 ? taken[index - 1].adres.plaats : "Venlo";
}

export interface RitEta {
  taakId: string;
  aankomstIso: string;
  vertragingMin: number;
  naVenster: boolean;
}

/** ETA voor de eerstvolgende taak van een rit, met gesimuleerde vertraging. */
export function ritEta(state: AppState, ritId: string, nuIso: string): RitEta | null {
  const taken = actieveTakenVanRit(state, ritId);
  const index = taken.findIndex((t) => statusVanTaak(state, t.id) !== "afgerond");
  if (index < 0) return null;
  const huidige = taken[index];
  const s = statusVanTaak(state, huidige.id);
  if (s === "bezig" || s === "probleem") return null; // al ter plaatse

  const vertraging = vertragingOpLeg(vorigePlaats(taken, index), huidige.adres.plaats);
  const basis = Math.max(Date.parse(huidige.geplandVan), s === "onderweg" ? Date.parse(nuIso) : 0);
  const aankomst = new Date(basis + vertraging * 60_000);
  const venster = huidige.adres.tijdvenster;
  return {
    taakId: huidige.id,
    aankomstIso: aankomst.toISOString(),
    vertragingMin: vertraging,
    naVenster: venster ? aankomst.getTime() > Date.parse(venster.tot) : false,
  };
}

export interface VoertuigPositie {
  lat: number;
  lon: number;
  onderweg: boolean;
  vanPlaats: string;
  naarPlaats: string | null;
}

const opPlaats = (plaats: string, naar: string | null = null): VoertuigPositie => {
  const [lat, lon] = PLAATS_COORDS[plaats] ?? PLAATS_COORDS.Venlo;
  return { lat, lon, onderweg: false, vanPlaats: plaats, naarPlaats: naar };
};

/** Gesimuleerde live positie: interpolatie op de huidige leg. */
export function voertuigPositie(state: AppState, rit: Rit, nuIso: string): VoertuigPositie {
  const taken = actieveTakenVanRit(state, rit.id);
  if (taken.length === 0) return opPlaats("Venlo");

  const index = taken.findIndex((t) => statusVanTaak(state, t.id) !== "afgerond");
  if (index < 0) return opPlaats(taken[taken.length - 1].adres.plaats);

  const huidige = taken[index];
  const s = statusVanTaak(state, huidige.id);
  const van = vorigePlaats(taken, index);
  const naar = huidige.adres.plaats;

  if (s === "gepland") return opPlaats(van, naar);
  if (s === "bezig" || s === "probleem") return opPlaats(naar);

  // Onderweg: positie tussen vertrek en (geplande aankomst + vertraging).
  const vertrokken = eventsVanTaak(state, huidige.id)
    .filter((e) => e.type === "vertrokken")
    .at(-1);
  const vertrek = Date.parse(vertrokken?.tijdstip ?? huidige.geplandVan);
  const aankomst =
    Date.parse(huidige.geplandVan) + vertragingOpLeg(van, naar) * 60_000;
  const frac = Math.min(
    0.95,
    Math.max(0.05, (Date.parse(nuIso) - vertrek) / Math.max(1, aankomst - vertrek))
  );
  const [vLat, vLon] = PLAATS_COORDS[van] ?? PLAATS_COORDS.Venlo;
  const [nLat, nLon] = PLAATS_COORDS[naar] ?? PLAATS_COORDS.Venlo;
  return {
    lat: vLat + (nLat - vLat) * frac,
    lon: vLon + (nLon - vLon) * frac,
    onderweg: true,
    vanPlaats: van,
    naarPlaats: naar,
  };
}

/** Geschatte rijtijd tussen twee plaatsen, in minuten (gem. 65 km/u). */
export function geschatteRijMinuten(vanPlaats: string, naarPlaats: string): number {
  const van = PLAATS_COORDS[vanPlaats];
  const naar = PLAATS_COORDS[naarPlaats];
  if (!van || !naar) return 45;
  return Math.max(10, Math.round((kmTussen(van, naar) / 65) * 60));
}

/** Vandaag afgelegde kilometers: som van legs waarop is vertrokken. */
export function kmVandaag(state: AppState, ritId: string): number {
  const taken = actieveTakenVanRit(state, ritId);
  let km = 0;
  taken.forEach((taakItem, index) => {
    const gestart = eventsVanTaak(state, taakItem.id).some((e) => e.type === "vertrokken");
    if (!gestart) return;
    const van = PLAATS_COORDS[vorigePlaats(taken, index)];
    const naar = PLAATS_COORDS[taakItem.adres.plaats];
    if (van && naar) km += kmTussen(van, naar);
  });
  return km;
}
