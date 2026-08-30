// Weergavehulpjes. Tijden staan in UTC in de data; hier — en alleen hier —
// worden ze geformatteerd naar Europe/Amsterdam (CLAUDE.md §5.3).

import { taal } from "./i18n";

export const DATUM_LOCALES: Record<string, string> = {
  nl: "nl-NL", en: "en-GB", pl: "pl-PL", ro: "ro-RO",
};
const locale = () => DATUM_LOCALES[taal()] ?? "nl-NL";

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
  return new Intl.DateTimeFormat(locale(), {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

/** Dag zonder jaartal voor een tab: vr 7 aug. */
export function datumDagKort(iso: string): string {
  return new Intl.DateTimeFormat(locale(), {
    weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

/** Volledige dag voor een kop: vrijdag 7 augustus. */
export function datumLabel(iso: string): string {
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}
