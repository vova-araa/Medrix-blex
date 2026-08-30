// Tijdhulp voor de rij- en rusttijden. Tijdstippen staan in UTC (CLAUDE.md
// §5.3), maar de wet rekent in lokale tijd: een "week" loopt van maandag
// 00:00 tot zondag 24:00 en nachtarbeid ligt tussen 00:00 en 06:00 lokaal.
// Daarom rekenen we hier expliciet om naar Europe/Amsterdam.

export const ZONE = "Europe/Amsterdam";

/** Offset van de zone t.o.v. UTC op dat moment, in minuten (60 of 120). */
export function zoneOffsetMinuten(ms: number, zone = ZONE): number {
  const d = new Date(ms);
  const lokaal = new Date(d.toLocaleString("en-US", { timeZone: zone }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((lokaal.getTime() - utc.getTime()) / 60_000);
}

/** Lokale kalenderdelen op dat moment. */
export function lokaleDelen(ms: number, zone = ZONE) {
  const offset = zoneOffsetMinuten(ms, zone);
  const d = new Date(ms + offset * 60_000);
  return {
    jaar: d.getUTCFullYear(),
    maand: d.getUTCMonth(),
    dag: d.getUTCDate(),
    uur: d.getUTCHours(),
    minuut: d.getUTCMinutes(),
    /** 0 = maandag, 6 = zondag. */
    weekdag: (d.getUTCDay() + 6) % 7,
    offset,
  };
}

/** Datum als YYYY-MM-DD in lokale tijd — de sleutel van een kalenderdag. */
export function lokaleDatum(iso: string, zone = ZONE): string {
  const { jaar, maand, dag } = lokaleDelen(Date.parse(iso), zone);
  return `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

/**
 * UTC-tijdstip van maandag 00:00 lokale tijd van de week waarin `ms` valt.
 * De offset wordt twee keer bepaald zodat een zomertijdwissel binnen de week
 * niet tot een uur verschuiving leidt.
 */
export function weekStartMs(ms: number, zone = ZONE): number {
  const { jaar, maand, dag, weekdag, offset } = lokaleDelen(ms, zone);
  const middernachtLokaal = Date.UTC(jaar, maand, dag) - weekdag * 86_400_000;
  let gok = middernachtLokaal - offset * 60_000;
  const offsetDaar = zoneOffsetMinuten(gok, zone);
  if (offsetDaar !== offset) gok = middernachtLokaal - offsetDaar * 60_000;
  return gok;
}

/** Aantal minuten van een periode dat in het nachtvenster 00:00–06:00 valt. */
export function nachtMinuten(
  vanMs: number, totMs: number, zone = ZONE
): number {
  if (totMs <= vanMs) return 0;
  let nacht = 0;
  // Per kwartier beoordelen: nauwkeurig genoeg voor de 1-uursdrempel en
  // ongevoelig voor zomertijdwissels midden in een dienst.
  const stap = 15 * 60_000;
  for (let t = vanMs; t < totMs; t += stap) {
    const duur = Math.min(stap, totMs - t);
    const { uur } = lokaleDelen(t + duur / 2, zone);
    if (uur < 6) nacht += duur / 60_000;
  }
  return Math.round(nacht);
}

/**
 * UTC-tijdstip van een lokale klokstand op een kalenderdag (`YYYY-MM-DD`).
 * Twee passes zodat een zomertijdwissel op die dag geen uur verschuift.
 */
export function lokaalTijdstipMs(
  datum: string, uur = 0, minuut = 0, zone = ZONE
): number {
  const [jaar, maand, dag] = datum.split("-").map(Number);
  const lokaalAlsUtc = Date.UTC(jaar, maand - 1, dag, uur, minuut);
  let gok = lokaalAlsUtc - zoneOffsetMinuten(lokaalAlsUtc, zone) * 60_000;
  const offsetDaar = zoneOffsetMinuten(gok, zone);
  gok = lokaalAlsUtc - offsetDaar * 60_000;
  return gok;
}
