import { useState } from "react";
import { eventsVanTaak, statusVanTaak, type AppState } from "../data/state";
import { statusLabel, t } from "../i18n";
import { ritEta } from "../kaart/simulatie";
import { tijd, venster } from "../utils";

// Ontvangerweergave: wat de klant op de publieke track & trace-pagina ziet.
// Privacy (§9): geen chauffeursnamen, geen apparaten — alleen zendingstatus.

export function PortaalView({ state, nu, onAfspraak }: {
  state: AppState;
  nu: string;
  onAfspraak: () => void;
}) {
  const zendingIds = Object.keys(state.zendingen);
  const [gekozen, setGekozen] = useState(zendingIds[0] ?? "");
  const zending = state.zendingen[gekozen];

  const lossenTaak = state.taken.find(
    (taak) => taak.soort === "lossen" && taak.zendingId === gekozen
  );
  const status = lossenTaak ? statusVanTaak(state, lossenTaak.id) : null;
  const rit = lossenTaak && state.ritten.find((r) => r.id === lossenTaak.ritId);
  const eta = rit ? ritEta(state, rit.id, nu) : null;
  const etaVoorDeze = eta && lossenTaak && eta.taakId === lossenTaak.id ? eta : null;

  const stappen = lossenTaak
    ? eventsVanTaak(state, lossenTaak.id).map((e) => ({
        id: e.id,
        label: t(`portaal.stap.${e.type}`),
        tijdstip: e.tijdstip,
      }))
    : [];

  return (
    <div className="kaart-main">
      <aside className="kaart-zij">
        <div className="ph-card">
          <h4 className="zij-kop">{t("portaal.titel")}</h4>
          <p className="uren-noot">{t("portaal.noot")}</p>
          <label className="portaal-kies">
            {t("portaal.kiesZending")}
            <select value={gekozen} onChange={(e) => setGekozen(e.target.value)}>
              {zendingIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        </div>
      </aside>

      <div className="portaal-preview">
        <div className="portaal-frame">
          <div className="portaal-balk">
            <span className="mark">S</span> {t("app.naam")} · {t("portaal.trackTrace")}
          </div>
          {zending && (
            <div className="portaal-inhoud">
              <p className="portaal-barcode mono">{zending.barcode}</p>
              <h3>{zending.van.plaats} → {zending.naar.plaats}</h3>
              <p className="portaal-oms">{zending.omschrijving}</p>

              {status && (
                <span className={`status-chip s-${status === "bezig" || status === "onderweg" ? "onderweg" : status}`}>
                  {status === "afgerond" ? t("portaal.bezorgd") : statusLabel(status)}
                </span>
              )}

              {etaVoorDeze && (
                <p className={`portaal-eta${etaVoorDeze.naVenster ? " eta-te-laat" : ""}`}>
                  {t("portaal.verwacht", { tijd: tijd(etaVoorDeze.aankomstIso) })}
                  {etaVoorDeze.vertragingMin > 0 && ` (+${etaVoorDeze.vertragingMin} min)`}
                </p>
              )}
              {zending.naar.tijdvenster && (
                <p className="portaal-venster">
                  {t("portaal.venster", { venster: venster(zending.naar.tijdvenster) })}
                </p>
              )}

              {stappen.length > 0 && (
                <ul className="event-list portaal-tijdlijn">
                  {[...stappen].reverse().map((stap) => (
                    <li key={stap.id}>
                      <div className="e-type">{stap.label}</div>
                      <div className="e-meta">{tijd(stap.tijdstip)}</div>
                    </li>
                  ))}
                </ul>
              )}

              {status !== "afgerond" && (
                <button className="btn" onClick={onAfspraak}>{t("portaal.verzet")}</button>
              )}
              <p className="portaal-privacy">{t("portaal.privacy")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
