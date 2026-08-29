import type { VervangResultaat } from "@sharzi/domain";
import { t } from "../i18n";
import { tijd } from "../utils";
import { Icoon } from "./Icoon";

interface Props {
  chauffeur: string;
  ritId: string;
  resultaat: VervangResultaat;
  onSluit: () => void;
  onKies: (chauffeur: string) => void;
}

export function VervangingView({ chauffeur, ritId, resultaat, onSluit, onKies }: Props) {
  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail autoplan-paneel">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
          <div className="eyebrow">{ritId}</div>
          <h3><Icoon naam="stuur" maat={16} /> {t("vervang.titel", { chauffeur })}</h3>
          <p className="uren-noot">{t("vervang.noot")}</p>
        </div>
        <div className="detail-body">
          {resultaat.voorstellen.length === 0 && (
            <p className="kaart-kies">{t("vervang.geen")}</p>
          )}
          {resultaat.voorstellen.map((v, i) => (
            <div className={`autoplan-voorstel vervang-voorstel${i === 0 ? " beste" : ""}`} key={v.chauffeur}>
              <div className="av-inhoud">
                <div className="av-kop">
                  {i === 0 && <span className="vervang-rang">{t("vervang.beste")}</span>}
                  <b>{v.chauffeur}</b>
                  <span className={`klok-chip ${v.soort === "extra" ? "rt-warn" : "rt-ok"}`}>
                    {t(`vervang.soort.${v.soort}`)}
                  </span>
                  <span className="mono av-rit">{v.ritId}</span>
                </div>
                <div className="av-tijden">
                  {t("vervang.aankomst", { tijd: tijd(v.aankomstIso) })}
                  {v.vereistVerlenging && (
                    <span className="av-pauze">
                      <Icoon naam="waarschuwing" maat={11} /> {t("vervang.verlenging")}
                    </span>
                  )}
                  {v.vensterAlVerstreken && (
                    <span className="av-pauze">
                      <Icoon naam="timer" maat={11} /> {t("vervang.vensterVerstreken")}
                    </span>
                  )}
                  {v.vereistPauze && (
                    <span className="av-pauze"><Icoon naam="koffie" maat={11} /> {t("autoplan.pauze")}</span>
                  )}
                </div>
                <ul className="av-motivatie">
                  {v.motivatie.map((regel, k) => <li key={k}>{regel}</li>)}
                </ul>
                <button className="btn primary knop-met-icoon" onClick={() => onKies(v.chauffeur)}>
                  <Icoon naam="check" maat={13} /> {t("vervang.kies", { chauffeur: v.chauffeur })}
                </button>
              </div>
            </div>
          ))}

          {resultaat.afgewezen.length > 0 && (
            <div className="autoplan-rest">
              <h4><Icoon naam="waarschuwing" maat={14} /> {t("vervang.afgewezen", { aantal: resultaat.afgewezen.length })}</h4>
              <p className="uren-noot">{t("vervang.afgewezenNoot")}</p>
              <ul>
                {resultaat.afgewezen.map((a) => (
                  <li key={a.chauffeur}>
                    <b>{a.chauffeur}</b> — {a.redenen.map((r) => t(`vervang.reden.${r}`)).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
