import type { Taak } from "@sharzi/domain";
import { RIJTIJD_REGELS } from "@sharzi/domain";
import {
  actieveTakenVanRit,
  eventsVanTaak,
  rijtijdVan,
  statusVanTaak,
  type AppState,
} from "./state";
import { ritEta, vertragingOpLeg, wegenOpLeg, VERKEER } from "../kaart/simulatie";

// Meldingenmotor voor het Operatie-dashboard. Drie bewakers:
// 1. Chauffeursapp: gemeld probleem op een taak.
// 2. Standtijdbewaking: langer dan 30 min op een laad-/losplek.
// 3. AI-routebewaking: verkeer op de route en vensters die niet gehaald worden.
// De bronnen zijn nu gesimuleerd; de meldingsvorm is definitief.

export const STANDTIJD_GRENS_MIN = 30;

export type MeldingErnst = "kritiek" | "waarschuwing";

export interface Melding {
  id: string;
  ernst: MeldingErnst;
  bron: "chauffeursapp" | "standtijd" | "ai" | "rijtijden";
  titel: string;
  omschrijving: string;
  ritId: string;
  tijdstip: string;
}

const minutenSinds = (iso: string, nu: string) =>
  Math.floor((Date.parse(nu) - Date.parse(iso)) / 60_000);

function huidigeTaakMetIndex(state: AppState, ritId: string): { taak: Taak; index: number } | null {
  const taken = actieveTakenVanRit(state, ritId);
  const index = taken.findIndex((t) => statusVanTaak(state, t.id) !== "afgerond");
  return index >= 0 ? { taak: taken[index], index } : null;
}

const urenTekst = (minuten: number) =>
  `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;

export function meldingen(state: AppState, nu: string): Melding[] {
  const lijst: Melding[] = [];

  // 4. Rij- en rusttijdenbewaking (EU 561/2006).
  for (const rit of state.ritten) {
    if (!rit.chauffeur) continue;
    const rijtijd = rijtijdVan(state, rit.chauffeur, nu);
    if (rijtijd.pauzeNodig) {
      lijst.push({
        id: `M-blok-${rit.chauffeur}`,
        ernst: "kritiek",
        bron: "rijtijden",
        titel: `${rit.chauffeur} moet nu pauze houden`,
        omschrijving: `Al ${urenTekst(rijtijd.blokRijMinuten)} onafgebroken gereden — na ${urenTekst(RIJTIJD_REGELS.blokRijMinuten)} is ${RIJTIJD_REGELS.pauzeNaBlokMinuten} min pauze verplicht.`,
        ritId: rit.id,
        tijdstip: nu,
      });
    } else if (rijtijd.blokResterendMinuten <= 30 && rijtijd.blokRijMinuten > 0) {
      lijst.push({
        id: `M-blok-${rit.chauffeur}`,
        ernst: "waarschuwing",
        bron: "rijtijden",
        titel: `${rit.chauffeur} moet binnen ${rijtijd.blokResterendMinuten} min pauzeren`,
        omschrijving: `${urenTekst(rijtijd.blokRijMinuten)} onafgebroken gereden; plan een pauzeplek in.`,
        ritId: rit.id,
        tijdstip: nu,
      });
    }
    if (rijtijd.dagResterendMinuten <= 60) {
      lijst.push({
        id: `M-dag-${rit.chauffeur}`,
        ernst: "waarschuwing",
        bron: "rijtijden",
        titel: `${rit.chauffeur} heeft nog ${rijtijd.dagResterendMinuten} min dagrijtijd`,
        omschrijving: `Vandaag ${urenTekst(rijtijd.dagRijMinuten)} gereden van maximaal ${urenTekst(RIJTIJD_REGELS.maxDagRijMinuten)}.`,
        ritId: rit.id,
        tijdstip: nu,
      });
    }
    if (rijtijd.weekResterendMinuten <= 120) {
      lijst.push({
        id: `M-week-${rit.chauffeur}`,
        ernst: "waarschuwing",
        bron: "rijtijden",
        titel: `${rit.chauffeur} nadert de weekgrens`,
        omschrijving: `Deze week ${urenTekst(rijtijd.weekRijMinuten)} gereden van maximaal ${urenTekst(RIJTIJD_REGELS.maxWeekRijMinuten)} — nog ${urenTekst(rijtijd.weekResterendMinuten)} beschikbaar.`,
        ritId: rit.id,
        tijdstip: nu,
      });
    }
  }

  for (const rit of state.ritten) {
    const huidig = huidigeTaakMetIndex(state, rit.id);
    if (!huidig) continue;
    const { taak, index } = huidig;
    const status = statusVanTaak(state, taak.id);
    const wie = rit.chauffeur || rit.id;

    // 1. Probleem gemeld door de chauffeur.
    if (status === "probleem") {
      const event = eventsVanTaak(state, taak.id)
        .filter((e) => e.type === "probleem_gemeld")
        .at(-1);
      lijst.push({
        id: `M-probleem-${taak.id}`,
        ernst: "kritiek",
        bron: "chauffeursapp",
        titel: `${wie} meldt een probleem`,
        omschrijving: `Bij ${taak.adres.naam} (${taak.adres.plaats}), gemeld om ${event ? tijdKort(event.tijdstip) : "?"}.`,
        ritId: rit.id,
        tijdstip: event?.tijdstip ?? nu,
      });
    }

    // 2. Standtijd: langer dan 30 min op de laad-/losplek.
    if (status === "bezig" || status === "probleem") {
      const aangekomen = eventsVanTaak(state, taak.id)
        .filter((e) => e.type === "aangekomen")
        .at(-1);
      if (aangekomen) {
        const minuten = minutenSinds(aangekomen.tijdstip, nu);
        if (minuten > STANDTIJD_GRENS_MIN) {
          const plek = taak.soort === "laden" ? "laadplek" : "losplek";
          lijst.push({
            id: `M-standtijd-${taak.id}`,
            ernst: minuten > 2 * STANDTIJD_GRENS_MIN ? "kritiek" : "waarschuwing",
            bron: "standtijd",
            titel: `${wie} staat ${minuten} min op de ${plek}`,
            omschrijving: `${taak.adres.naam} (${taak.adres.plaats}), aangekomen om ${tijdKort(aangekomen.tijdstip)} — grens is ${STANDTIJD_GRENS_MIN} min.`,
            ritId: rit.id,
            tijdstip: aangekomen.tijdstip,
          });
        }
      }
    }

    // 3. AI-routebewaking: venster gemist of file op de route.
    const eta = ritEta(state, rit.id, nu);
    if (eta && eta.taakId === taak.id) {
      if (eta.naVenster) {
        lijst.push({
          id: `M-venster-${taak.id}`,
          ernst: "kritiek",
          bron: "ai",
          titel: `${wie} haalt het tijdvenster niet`,
          omschrijving: `ETA ${taak.adres.plaats} ${tijdKort(eta.aankomstIso)} (+${eta.vertragingMin} min) valt buiten het afgesproken venster.`,
          ritId: rit.id,
          tijdstip: nu,
        });
      } else if (eta.vertragingMin > 0) {
        const taken = actieveTakenVanRit(state, rit.id);
        const vorige = index > 0 ? taken[index - 1].adres.plaats : "Venlo";
        const wegen = wegenOpLeg(vorige, taak.adres.plaats);
        const oorzaak = VERKEER.filter((v) => wegen.includes(v.weg))
          .map((v) => `${v.weg}: ${v.omschrijving.toLowerCase()}`)
          .join("; ");
        lijst.push({
          id: `M-verkeer-${taak.id}`,
          ernst: "waarschuwing",
          bron: "ai",
          titel: `Vertraging op de route van ${wie}`,
          omschrijving: `${oorzaak || "Verkeer"} — verwachte aankomst ${taak.adres.plaats} ${tijdKort(eta.aankomstIso)} (+${vertragingOpLeg(vorige, taak.adres.plaats)} min).`,
          ritId: rit.id,
          tijdstip: nu,
        });
      }
    }
  }

  const gewicht: Record<MeldingErnst, number> = { kritiek: 0, waarschuwing: 1 };
  return lijst.sort(
    (a, b) => gewicht[a.ernst] - gewicht[b.ernst] || a.tijdstip.localeCompare(b.tijdstip)
  );
}

const tijdKort = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
