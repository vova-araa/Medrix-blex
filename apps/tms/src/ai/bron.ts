import { formatteerGeld, urenTotalen } from "@sharzi/domain";
import { conceptFacturen } from "../data/facturen";
import {
  statusVanRit,
  takenVanRit,
  werktijdenVan,
  type AppState,
} from "../data/state";
import { ritEta, voertuigPositie } from "../kaart/simulatie";
import { tijd } from "../utils";

// AI-laag achter een poort: de UI kent alleen AiBron. Deze demo beantwoordt
// een handvol vragen regelgebaseerd over de echte app-state. In productie
// schuift hier de Claude API in (assistent → planhulp → order-inlezen,
// besluit 2026-08-07), met dezelfde interface.

export interface AiContext {
  state: AppState;
  nu: string;
}

export interface AiBron {
  beantwoord(vraag: string, context: AiContext): Promise<string>;
}

const uren = (minuten: number) =>
  `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;

export class DemoAssistent implements AiBron {
  beantwoord(vraag: string, context: AiContext): Promise<string> {
    return Promise.resolve(this.antwoord(vraag.toLowerCase(), context));
  }

  private antwoord(vraag: string, { state, nu }: AiContext): string {
    if (/te laat|uitloop|loopt uit|lopen uit|vertraag|eta|haal/.test(vraag)) {
      const regels = state.ritten
        .map((rit) => ({ rit, eta: ritEta(state, rit.id, nu) }))
        .filter(({ eta }) => eta && (eta.vertragingMin > 0 || eta.naVenster))
        .map(({ rit, eta }) => {
          const taak = state.taken.find((tk) => tk.id === eta!.taakId);
          const teLaat = eta!.naVenster ? " — buiten het tijdvenster ⚠️" : "";
          return `• ${rit.chauffeur} (${rit.id}): ETA ${taak?.adres.plaats} ${tijd(eta!.aankomstIso)} (+${eta!.vertragingMin} min)${teLaat}`;
        });
      return regels.length
        ? `Ritten met vertraging:\n${regels.join("\n")}`
        : "Geen enkele rit loopt op dit moment uit — alle ETA's vallen binnen de vensters.";
    }

    if (/waar (is|rijdt)|positie/.test(vraag)) {
      const rit = state.ritten.find(
        (r) => r.chauffeur && vraag.includes(r.chauffeur.split(" ").pop()!.toLowerCase())
      );
      if (rit) {
        const pos = voertuigPositie(state, rit, nu);
        const rs = statusVanRit(state, rit.id);
        return pos.onderweg && pos.naarPlaats
          ? `${rit.chauffeur} rijdt nu tussen ${pos.vanPlaats} en ${pos.naarPlaats} (rit ${rit.id}, status: ${rs}).`
          : `${rit.chauffeur} staat bij ${pos.vanPlaats} (rit ${rit.id}, status: ${rs}).`;
      }
      return "Welke chauffeur bedoel je? Noem een achternaam, bijvoorbeeld: “waar is Peeters?”";
    }

    if (/ongepland/.test(vraag)) {
      if (state.ongepland.length === 0) return "Alles is gepland — er staan geen zendingen meer open.";
      const regels = state.ongepland.map((id) => {
        const z = state.zendingen[id];
        return `• ${z.barcode}: ${z.van.plaats} → ${z.naar.plaats} (${z.laadmeters} lm)`;
      });
      return `Er staan ${state.ongepland.length} zendingen ongepland:\n${regels.join("\n")}`;
    }

    if (/omzet|factu|verdien/.test(vraag)) {
      const facturen = conceptFacturen(state);
      if (facturen.length === 0) return "Er zijn vandaag nog geen afgeleverde zendingen om te factureren.";
      const regels = facturen.map(
        (f) => `• ${f.opdrachtgever}: ${formatteerGeld(f.totalen.totaal)} (incl. btw)`
      );
      const totaal = facturen.reduce((som, f) => som + f.totalen.totaal.bedragCenten, 0);
      return `Concept-omzet van vandaag:\n${regels.join("\n")}\nTotaal: ${formatteerGeld({ bedragCenten: totaal, valuta: "EUR" })}`;
    }

    if (/uren|dienst|rijtijd|pauze/.test(vraag)) {
      const regels = state.ritten
        .filter((r) => r.chauffeur)
        .map((r) => {
          const totalen = urenTotalen(werktijdenVan(state, r.chauffeur), nu);
          return `• ${r.chauffeur}: ${uren(totalen.dienstMinuten)} dienst, waarvan ${uren(totalen.rijMinuten)} rijden en ${uren(totalen.pauzeMinuten)} pauze`;
        });
      return `Urenstand van vandaag:\n${regels.join("\n")}`;
    }

    if (/probleem|storing/.test(vraag)) {
      const problemen = state.ritten.filter((r) => statusVanRit(state, r.id) === "probleem");
      if (problemen.length === 0) return "Er zijn geen openstaande problemen.";
      return problemen
        .map((r) => {
          const taak = takenVanRit(state, r.id).find(
            (tk) => state.events.filter((e) => e.taakId === tk.id).at(-1)?.type === "probleem_gemeld"
          );
          return `⚠️ ${r.chauffeur} (${r.id}) heeft een probleem gemeld bij ${taak?.adres.naam ?? "een adres"}.`;
        })
        .join("\n");
    }

    return [
      "Ik kan je nu helpen met vragen over de lopende dag, bijvoorbeeld:",
      "• “Welke ritten lopen uit?”",
      "• “Waar is Kowalski?”",
      "• “Wat staat er ongepland?”",
      "• “Wat is de omzet van vandaag?”",
      "• “Hoeveel uren heeft Peeters gemaakt?”",
      "",
      "(Demo-assistent — in productie beantwoordt de AI-laag ook vrije vragen.)",
    ].join("\n");
  }
}
