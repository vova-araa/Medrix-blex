// Werktijden (Roadsoft-alternatief): rij-, werk- en pauzetijd per chauffeur,
// afgeleid uit een append-only reeks werktijd-events — zelfde principe als de
// taak-event-log (§5.1). AVG (§9): deze data is voor verantwoording en
// planning; de chauffeur ziet zijn eigen registraties in de app.

export type WerktijdEventType =
  | "ingeklokt"
  | "rijden_gestart"
  | "werk_gestart"
  | "pauze_gestart"
  | "uitgeklokt";

export interface WerktijdEvent {
  id: string;
  tenantId: string;
  chauffeur: string;
  type: WerktijdEventType;
  tijdstip: string;
}

export interface UrenTotalen {
  dienstMinuten: number;
  rijMinuten: number;
  werkMinuten: number;
  pauzeMinuten: number;
  /** Toestand na het laatste event; null = niet in dienst. */
  actief: "rijden" | "werk" | "pauze" | null;
}

const TOESTAND_NA: Record<WerktijdEventType, UrenTotalen["actief"]> = {
  ingeklokt: "werk",
  rijden_gestart: "rijden",
  werk_gestart: "werk",
  pauze_gestart: "pauze",
  uitgeklokt: null,
};

const minuten = (vanIso: string, totIso: string) =>
  Math.max(0, Math.round((Date.parse(totIso) - Date.parse(vanIso)) / 60_000));

export function urenTotalen(
  events: readonly WerktijdEvent[],
  nu: string
): UrenTotalen {
  const totalen: UrenTotalen = {
    dienstMinuten: 0, rijMinuten: 0, werkMinuten: 0, pauzeMinuten: 0, actief: null,
  };
  const gesorteerd = [...events].sort((a, b) => a.tijdstip.localeCompare(b.tijdstip));

  for (let i = 0; i < gesorteerd.length; i++) {
    const event = gesorteerd[i];
    const toestand = TOESTAND_NA[event.type];
    const tot = i + 1 < gesorteerd.length ? gesorteerd[i + 1].tijdstip : nu;
    const duur = toestand === null ? 0 : minuten(event.tijdstip, tot);
    if (toestand === "rijden") totalen.rijMinuten += duur;
    if (toestand === "werk") totalen.werkMinuten += duur;
    if (toestand === "pauze") totalen.pauzeMinuten += duur;
    totalen.dienstMinuten += duur;
    totalen.actief = toestand;
  }
  return totalen;
}
