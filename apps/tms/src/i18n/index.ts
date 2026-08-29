import type { RitStatus, TaakStatus } from "@sharzi/domain";
import { nl, type VertaalSleutel } from "./nl";
import { en } from "./en";
import { pl } from "./pl";
import { ro } from "./ro";

// Nederlands is de volledige taal en tevens de terugval. De chauffeursapp is
// daarnaast vertaald naar EN, PL en RO — dat zijn de talen die op de bok
// gesproken worden (CLAUDE.md §7.5). Een sleutel die in een taal ontbreekt
// valt terug op Nederlands: liever een leesbare Nederlandse regel dan een
// lege knop.

export type Taal = "nl" | "en" | "pl" | "ro";

export const TALEN: Array<{ code: Taal; naam: string }> = [
  { code: "nl", naam: "Nederlands" },
  { code: "en", naam: "English" },
  { code: "pl", naam: "Polski" },
  { code: "ro", naam: "Română" },
];

type Woordenboek = Partial<Record<VertaalSleutel, string>>;
const WOORDENBOEKEN: Record<Taal, Woordenboek> = { nl, en, pl, ro };

let huidigeTaal: Taal = "nl";

export function zetTaal(taal: Taal): void {
  huidigeTaal = taal;
}
export function taal(): Taal {
  return huidigeTaal;
}

export function t(
  sleutel: VertaalSleutel,
  vars?: Record<string, string | number>
): string {
  let tekst: string = WOORDENBOEKEN[huidigeTaal][sleutel] ?? nl[sleutel];
  if (vars) {
    for (const [naam, waarde] of Object.entries(vars)) {
      tekst = tekst.replace(`{${naam}}`, String(waarde));
    }
  }
  return tekst;
}

export function statusLabel(status: TaakStatus | RitStatus): string {
  return t(`status.${status}`);
}
