// Weergavehulpjes. Tijden staan in UTC in de data; hier — en alleen hier —
// worden ze geformatteerd naar Europe/Amsterdam (CLAUDE.md §5.3).

const tijdFormat = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
});

export function tijd(iso: string): string {
  return tijdFormat.format(new Date(iso));
}

export function venster(v: { van: string; tot: string }): string {
  return `${tijd(v.van)}–${tijd(v.tot)}`;
}

export function laadmeters(lm: number): string {
  return lm.toLocaleString("nl-NL", { minimumFractionDigits: 1 });
}

export function initialen(naam: string): string {
  const delen = naam.split(/\s+/).filter((w) => /[\p{L}]/u.test(w[0] ?? ""));
  return delen.map((w) => w[0].toUpperCase()).slice(0, 2).join("") || "—";
}

/** Korte datum in lokale weergave: 7 aug 2026. */
export function datumKort(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}
