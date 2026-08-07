import { formatteerGeld, urenTotalen, type TaakStatus } from "@sharzi/domain";
import { useState } from "react";
import { conceptFacturen } from "../data/facturen";
import { statusVanTaak, werktijdenVan, type AppState } from "../data/state";
import { statusLabel, t } from "../i18n";
import { kmVandaag } from "../kaart/simulatie";
import { Icoon, type IcoonNaam } from "./Icoon";

// Vormkeuze (dataviz): statustegels voor kerncijfers, horizontale balken per
// rij voor omzet (één reeks, één kleur) en status (statuskleur + icoon + label,
// nooit kleur alleen). Waarden staan als tekst bij elke balk — geen legenda nodig.

const STATUS_VOLGORDE: TaakStatus[] = ["afgerond", "bezig", "onderweg", "gepland", "probleem"];
const STATUS_ICOON: Record<TaakStatus, IcoonNaam> = {
  afgerond: "check", bezig: "timer", onderweg: "pijl", gepland: "klok", probleem: "waarschuwing",
};

export function DashboardView({ state, nu }: { state: AppState; nu: string }) {
  const [tip, setTip] = useState<string | null>(null);

  const facturen = conceptFacturen(state);
  const omzetCenten = facturen.reduce((som, f) => som + f.totalen.subtotaal.bedragCenten, 0);

  const alleTaken = state.taken;
  const afgerond = alleTaken.filter((taak) => statusVanTaak(state, taak.id) === "afgerond");
  const metVenster = afgerond.filter((taak) => taak.adres.tijdvenster);
  const opTijd = metVenster.filter((taak) => {
    const laatste = state.events.filter((e) => e.taakId === taak.id).at(-1);
    return laatste && Date.parse(laatste.tijdstip) <= Date.parse(taak.adres.tijdvenster!.tot);
  });

  const kmTotaal = state.ritten.reduce((som, rit) => som + kmVandaag(state, rit.id), 0);
  const inDienst = state.ritten
    .map((rit) => rit.chauffeur)
    .filter((naam) => naam && urenTotalen(werktijdenVan(state, naam), nu).actief !== null);

  const perStatus = STATUS_VOLGORDE.map((status) => ({
    status,
    aantal: alleTaken.filter((taak) => statusVanTaak(state, taak.id) === status).length,
  }));
  const maxStatus = Math.max(1, ...perStatus.map((s) => s.aantal));
  const maxOmzet = Math.max(1, ...facturen.map((f) => f.totalen.subtotaal.bedragCenten));

  return (
    <div className="uren-main dashboard">
      <div className="dash-tegels">
        <div className="dash-tegel held">
          <span className="dash-label">{t("dashboard.omzet")}</span>
          <b>{formatteerGeld({ bedragCenten: omzetCenten, valuta: "EUR" })}</b>
          <span className="dash-sub">{t("dashboard.omzetSub")}</span>
        </div>
        <div className="dash-tegel">
          <span className="dash-label">{t("dashboard.taken")}</span>
          <b>{afgerond.length}/{alleTaken.length}</b>
          <span className="dash-sub">{t("dashboard.takenSub")}</span>
        </div>
        <div className="dash-tegel">
          <span className="dash-label">{t("dashboard.punctualiteit")}</span>
          <b>{metVenster.length ? Math.round((opTijd.length / metVenster.length) * 100) : 100}%</b>
          <span className="dash-sub">{t("dashboard.punctualiteitSub", { opTijd: opTijd.length, totaal: metVenster.length })}</span>
        </div>
        <div className="dash-tegel">
          <span className="dash-label">{t("dashboard.km")}</span>
          <b>{kmTotaal.toLocaleString("nl-NL")}</b>
          <span className="dash-sub">{t("dashboard.kmSub")}</span>
        </div>
        <div className="dash-tegel">
          <span className="dash-label">{t("dashboard.inDienst")}</span>
          <b>{inDienst.length}</b>
          <span className="dash-sub">{inDienst.join(" · ") || t("dashboard.niemand")}</span>
        </div>
      </div>

      <div className="dash-grafieken">
        <div className="ph-card">
          <h4 className="zij-kop">{t("dashboard.omzetPerKlant")}</h4>
          {facturen.length === 0 && <p className="kaart-kies">{t("facturen.leeg")}</p>}
          <div className="staaf-lijst" onMouseLeave={() => setTip(null)}>
            {facturen.map((factuur) => (
              <div
                className="staaf-rij"
                key={factuur.opdrachtgever}
                onMouseEnter={() =>
                  setTip(`${factuur.opdrachtgever} — ${factuur.regels.length}× transport, ${formatteerGeld(factuur.totalen.subtotaal)} excl. btw`)
                }
              >
                <span className="staaf-naam">{factuur.opdrachtgever}</span>
                <div className="staaf-baan">
                  <div
                    className="staaf omzet"
                    style={{ width: `${(factuur.totalen.subtotaal.bedragCenten / maxOmzet) * 100}%` }}
                  />
                </div>
                <span className="staaf-waarde">{formatteerGeld(factuur.totalen.subtotaal)}</span>
              </div>
            ))}
          </div>
          {tip && <p className="dash-tip">{tip}</p>}
        </div>

        <div className="ph-card">
          <h4 className="zij-kop">{t("dashboard.perStatus")}</h4>
          <div className="staaf-lijst">
            {perStatus.map(({ status, aantal }) => (
              <div className="staaf-rij" key={status}>
                <span className="staaf-naam">
                  <i className={`status-stip s-${status}`} aria-hidden="true">
                    <Icoon naam={STATUS_ICOON[status]} maat={9} />
                  </i>{" "}
                  {statusLabel(status)}
                </span>
                <div className="staaf-baan">
                  <div className={`staaf st-${status}`} style={{ width: `${(aantal / maxStatus) * 100}%` }} />
                </div>
                <span className="staaf-waarde">{aantal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="uren-noot">{t("dashboard.noot")}</p>
    </div>
  );
}
