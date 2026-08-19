import { KOPPELINGEN, koppelingStatus, laatsteSync, type KoppelingDef } from "../data/koppelingen";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { tijd } from "../utils";
import { Icoon } from "./Icoon";

interface Props {
  state: AppState;
  onReplay: (logId: string) => void;
  onAanvragen: (koppeling: KoppelingDef) => void;
}

export function KoppelingenView({ state, onReplay, onAanvragen }: Props) {
  const actieve = KOPPELINGEN.filter((k) => k.status === "actief");
  const catalogus = KOPPELINGEN.filter((k) => k.status === "beschikbaar");
  const log = [...state.koppelingLog].sort((a, b) => b.tijdstip.localeCompare(a.tijdstip));

  return (
    <div className="koppelingen-main">
      <div className="ph-card">
        <h3 className="zij-kop">{t("koppeling.actieve")}</h3>
        <p className="uren-noot">{t("koppeling.noot")}</p>
        <div className="koppeling-kaarten">
          {actieve.map((koppeling) => {
            const status = koppelingStatus(state, koppeling);
            const sync = laatsteSync(state, koppeling.id);
            return (
              <div className={`koppeling-kaart s-${status}`} key={koppeling.id}>
                <div className="koppeling-kop">
                  <Icoon naam="koppeling" maat={15} />
                  <b>{koppeling.naam}</b>
                  <span className={`status-chip k-${status}`}>{t(`koppeling.status.${status}`)}</span>
                </div>
                <div className="koppeling-meta">
                  {t(`koppeling.soort.${koppeling.soort}`)}
                  {sync && <> · {t("koppeling.laatsteSync", { tijd: tijd(sync) })}</>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("koppeling.logboek")}</h3>
        <p className="uren-noot">{t("koppeling.logboekNoot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("koppeling.tijd")}</th>
                <th>{t("koppeling.koppeling")}</th>
                <th>{t("koppeling.richting")}</th>
                <th>{t("koppeling.omschrijving")}</th>
                <th>{t("koppeling.statusKop")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {log.map((regel) => {
                const def = KOPPELINGEN.find((k) => k.id === regel.koppelingId);
                return (
                  <tr key={regel.id} className={regel.status === "gefaald" && !regel.opnieuwAfgespeeld ? "log-fout" : undefined}>
                    <td className="mono">{tijd(regel.tijdstip)}</td>
                    <td>{def?.naam ?? regel.koppelingId}</td>
                    <td>{t(`koppeling.richting.${regel.richting}`)}</td>
                    <td>
                      {regel.omschrijving}
                      {regel.foutmelding && <div className="log-foutmelding">{regel.foutmelding}</div>}
                    </td>
                    <td>
                      <span className={`status-chip k-${regel.status === "geslaagd" ? "actief" : regel.opnieuwAfgespeeld ? "hersteld" : "fout"}`}>
                        {regel.status === "gefaald" && regel.opnieuwAfgespeeld
                          ? t("koppeling.afgehandeld")
                          : t(`koppeling.log.${regel.status}`)}
                      </span>
                    </td>
                    <td>
                      {regel.status === "gefaald" && !regel.opnieuwAfgespeeld && (
                        <button className="btn knop-met-icoon" onClick={() => onReplay(regel.id)}>
                          <Icoon naam="speel" maat={12} /> {t("koppeling.replay")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ph-card">
        <h3 className="zij-kop">{t("koppeling.catalogus")}</h3>
        <p className="uren-noot">{t("koppeling.catalogusNoot")}</p>
        <div className="koppeling-kaarten">
          {catalogus.map((koppeling) => (
            <div className="koppeling-kaart s-beschikbaar" key={koppeling.id}>
              <div className="koppeling-kop">
                <Icoon naam="koppeling" maat={15} />
                <b>{koppeling.naam}</b>
              </div>
              <div className="koppeling-meta">{t(`koppeling.soort.${koppeling.soort}`)}</div>
              <button className="btn knop-met-icoon" onClick={() => onAanvragen(koppeling)}>
                <Icoon naam="plus" maat={12} /> {t("koppeling.aanvragen")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
