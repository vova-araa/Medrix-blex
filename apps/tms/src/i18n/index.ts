import type { RitStatus, TaakStatus } from "@sharzi/domain";
import { nl, type VertaalSleutel } from "./nl";

export function t(
  sleutel: VertaalSleutel,
  vars?: Record<string, string | number>
): string {
  let tekst: string = nl[sleutel];
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
