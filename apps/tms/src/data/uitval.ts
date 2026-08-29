// Uitval van een chauffeur doorrekenen: welke collega kan de rit overnemen?
// Deze module vertaalt de app-state naar de domeinfunctie zoekVervanging en
// terug — de regels zelf zitten in het domein, niet hier.

import { zoekVervanging, type UitgevallenRit, type VervangKandidaat, type VervangResultaat } from "@sharzi/domain";
import { geschatteRijMinuten } from "../kaart/simulatie";
import {
  actieveTakenVanRit, gebruikteLaadmeters, rijtijdVan, statusVanTaak, type AppState,
} from "./state";

/** Resterend werk op een rit: de stops die nog niet afgerond zijn. */
export function resterendeRit(state: AppState, ritId: string): UitgevallenRit | null {
  const rit = state.ritten.find((r) => r.id === ritId);
  if (!rit) return null;
  const open = actieveTakenVanRit(state, ritId).filter(
    (taak) => statusVanTaak(state, taak.id) !== "afgerond"
  );
  if (open.length === 0) return null;

  // Rijtijd over de resterende stops: van stop naar stop.
  let rijMinuten = 0;
  for (let i = 0; i < open.length - 1; i++) {
    rijMinuten += geschatteRijMinuten(open[i].adres.plaats, open[i + 1].adres.plaats);
  }
  // Benodigde laadruimte is de PIEK langs de resterende route, niet de som:
  // een zending die bij de eerste stop gelost wordt, bezet daarna niets meer.
  const alleTaken = actieveTakenVanRit(state, ritId);
  const isAfgerond = (taak: (typeof alleTaken)[number]) =>
    statusVanTaak(state, taak.id) === "afgerond";
  const lm = (zendingId?: string) =>
    zendingId ? state.zendingen[zendingId]?.laadmeters ?? 0 : 0;

  // Wat al aan boord staat: gelost moet nog, geladen is al gebeurd.
  let belading = 0;
  for (const taak of open) {
    if (taak.soort !== "lossen" || !taak.zendingId) continue;
    const laadstop = alleTaken.find(
      (t) => t.soort === "laden" && t.zendingId === taak.zendingId
    );
    if (!laadstop || isAfgerond(laadstop)) belading += lm(taak.zendingId);
  }
  let piek = belading;
  for (const taak of open) {
    if (taak.soort === "laden") belading += lm(taak.zendingId);
    if (taak.soort === "lossen") belading -= lm(taak.zendingId);
    piek = Math.max(piek, belading);
  }
  const laadmeters = Math.max(0, piek);

  return {
    ritId,
    chauffeur: rit.chauffeur,
    startPlaats: open[0].adres.plaats,
    resterendeRijMinuten: rijMinuten,
    vensterTotIso: open[0].adres.tijdvenster?.tot,
    laadmeters: Math.round(laadmeters * 10) / 10,
  };
}

export function vervangingVoorRit(
  state: AppState, ritId: string, nu: string
): VervangResultaat | null {
  const uitgevallen = resterendeRit(state, ritId);
  if (!uitgevallen) return null;

  const nuMs = Date.parse(nu);
  const kandidaten: VervangKandidaat[] = state.ritten
    .filter((rit) => rit.chauffeur && rit.id !== ritId)
    .map((rit) => {
      const actief = actieveTakenVanRit(state, rit.id);
      const laatste = actief.at(-1);
      const nogOpen = actief.some((taak) => statusVanTaak(state, taak.id) !== "afgerond");
      return {
        chauffeur: rit.chauffeur,
        ritId: rit.id,
        huidigePlaats: laatste?.adres.plaats ?? "Venlo",
        beschikbaarVanafIso: laatste
          ? new Date(Math.max(Date.parse(laatste.geplandTot), nuMs)).toISOString()
          : nu,
        resterendeLaadmeters:
          Math.round((rit.voertuig.capaciteitLaadmeters - gebruikteLaadmeters(state, rit.id)) * 10) / 10,
        rijtijd: rijtijdVan(state, rit.chauffeur, nu),
        heeftEigenRit: nogOpen,
      };
    });

  return zoekVervanging(uitgevallen, kandidaten, {
    nuIso: nu,
    reistijdMinuten: geschatteRijMinuten,
  });
}
