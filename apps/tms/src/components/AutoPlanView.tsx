import type { PlanResultaat, PlanVoorstel } from "@sharzi/domain";
import { useState } from "react";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { tijd, venster } from "../utils";
import { Icoon } from "./Icoon";

interface Props {
  state: AppState;
  resultaat: PlanResultaat;
  onSluit: () => void;
  onAccepteer: (voorstellen: PlanVoorstel[]) => void;
}

export function AutoPlanView({ state, resultaat, onSluit, onAccepteer }: Props) {
  const [gekozen, setGekozen] = useState<Set<string>>(
    new Set(resultaat.voorstellen.map((v) => v.opdrachtId))
  );

  const wissel = (id: string) => {
    const volgende = new Set(gekozen);
    if (volgende.has(id)) volgende.delete(id);
    else volgende.add(id);
    setGekozen(volgende);
  };

  const geselecteerd = resultaat.voorstellen.filter((v) => gekozen.has(v.opdrachtId));

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail autoplan-paneel">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
          <div className="eyebrow">{t("autoplan.eyebrow")}</div>
          <h3><Icoon naam="assistent" maat={16} /> {t("autoplan.titel")}</h3>
          <p className="uren-noot">{t("autoplan.noot")}</p>
        </div>
        <div className="detail-body">
          {resultaat.voorstellen.length === 0 && (
            <p className="kaart-kies">{t("autoplan.geenVoorstellen")}</p>
          )}
          {resultaat.voorstellen.map((voorstel) => {
            const zending = state.zendingen[voorstel.opdrachtId];
            return (
              <label
                key={voorstel.opdrachtId}
                className={`autoplan-voorstel${gekozen.has(voorstel.opdrachtId) ? " gekozen" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={gekozen.has(voorstel.opdrachtId)}
                  onChange={() => wissel(voorstel.opdrachtId)}
                />
                <div className="av-inhoud">
                  <div className="av-kop">
                    <span className="mono">{voorstel.opdrachtId}</span>
                    <Icoon naam="pijl" maat={12} />
                    <b>{voorstel.chauffeur}</b>
                    <span className="mono av-rit">{voorstel.ritId}</span>
                  </div>
                  {zending && (
                    <div className="av-route">
                      {zending.van.plaats} → {zending.naar.plaats} · {zending.omschrijving}
                    </div>
                  )}
                  <div className="av-tijden">
                    {t("autoplan.aankomst", { tijd: tijd(voorstel.aankomstIso) })}
                    {zending?.naar.tijdvenster && (
                      <span className="av-venster"> · {t("autoplan.binnenVenster", { venster: venster(zending.naar.tijdvenster) })}</span>
                    )}
                    {voorstel.pauzeIngepland && (
                      <span className="av-pauze"><Icoon naam="koffie" maat={11} /> {t("autoplan.pauze")}</span>
                    )}
                  </div>
                  <ul className="av-motivatie">
                    {voorstel.motivatie.map((regel, i) => <li key={i}>{regel}</li>)}
                  </ul>
                </div>
              </label>
            );
          })}

          {resultaat.onplanbaar.length > 0 && (
            <div className="autoplan-rest">
              <h4><Icoon naam="waarschuwing" maat={14} /> {t("autoplan.onplanbaar", { aantal: resultaat.onplanbaar.length })}</h4>
              <p className="uren-noot">{t("autoplan.onplanbaarNoot")}</p>
              <ul>
                {resultaat.onplanbaar.map((regel) => (
                  <li key={regel.opdrachtId}>
                    <span className="mono">{regel.opdrachtId}</span> —{" "}
                    {regel.redenen.map((reden) => t(`autoplan.reden.${reden}`)).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            className="btn primary big knop-met-icoon"
            disabled={geselecteerd.length === 0}
            onClick={() => onAccepteer(geselecteerd)}
          >
            <Icoon naam="check" maat={16} />
            {t("autoplan.accepteer", { aantal: geselecteerd.length })}
          </button>
        </div>
      </aside>
    </div>
  );
}
