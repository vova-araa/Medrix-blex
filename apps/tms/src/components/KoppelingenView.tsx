import { uitleesStatussen, vatSamen, vergelijk } from "@sharzi/domain";
import { rijtijdVan } from "../data/state";
import { KOPPELINGEN, koppelingStatus, laatsteSync, type KoppelingDef } from "../data/koppelingen";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { initialen } from "../utils";
import { tijd } from "../utils";
import { Icoon } from "./Icoon";

interface Props {
  state: AppState;
  nu: string;
  onReplay: (logId: string) => void;
  onAanvragen: (koppeling: KoppelingDef) => void;
}

export function KoppelingenView({ state, nu, onReplay, onAanvragen }: Props) {
  const actieve = KOPPELINGEN.filter((k) => k.status === "actief");
  const catalogus = KOPPELINGEN.filter((k) => k.status === "beschikbaar");
  const log = [...state.koppelingLog].sort((a, b) => b.tijdstip.localeCompare(a.tijdstip));
  // Schaduwdraaien: onze berekening naast die van het bestaande pakket.
  const vergelijkingen = state.referenties.map((r) =>
    vergelijk(rijtijdVan(state, r.chauffeur, nu), r)
  );
  const samenvatting = vatSamen(vergelijkingen);

  const termijnen = uitleesStatussen(
    state.tachoUitlezingen,
    {
      kentekens: state.wagenpark.map((v) => v.kenteken),
      chauffeurs: state.ritten.map((r) => r.chauffeur).filter(Boolean),
    },
    nu
  );

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

      {state.referenties.length > 0 && (
        <div className="ph-card uren-kaart">
          <div className="operatie-kop">
            <h3 className="zij-kop">{t("schaduw.titel")}</h3>
            <span className={`klok-chip ${samenvatting.gereedVoorOverstap ? "rt-ok" : "rt-warn"}`}>
              {t("schaduw.akkoord", { akkoord: samenvatting.akkoord, totaal: samenvatting.totaal })}
            </span>
          </div>
          <p className="uren-noot">{t("schaduw.noot")}</p>
          <div className="table-scroll">
            <table className="uren-tabel">
              <thead>
                <tr>
                  <th>{t("uren.chauffeur")}</th>
                  <th>{t("schaduw.sharzi")}</th>
                  <th>{t("schaduw.referentie")}</th>
                  <th>{t("schaduw.verschil")}</th>
                </tr>
              </thead>
              <tbody>
                {vergelijkingen.map((v) => (
                  <tr key={v.chauffeur} className={v.akkoord ? undefined : "log-fout"}>
                    <td>
                      <span className="avatar avatar-klein">{initialen(v.chauffeur)}</span> {v.chauffeur}
                    </td>
                    <td>{v.verschillen.find((d) => d.soort === "dagrijtijd")?.sharzi ?? "—"}</td>
                    <td>{v.verschillen.find((d) => d.soort === "dagrijtijd")?.referentie ?? "—"}</td>
                    <td>
                      {v.verschillen.length === 0 ? (
                        <span className="klok-chip rt-ok">{t("schaduw.gelijk")}</span>
                      ) : (
                        <div className="schaduw-verschillen">
                          {v.verschillen.map((d, i) => (
                            <span key={i} className={`klok-chip ${d.blokkerend ? "rt-kritiek" : "rt-warn"}`}>
                              {d.omschrijving}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="uren-noot">
            {samenvatting.gereedVoorOverstap ? t("schaduw.gereed") : t("schaduw.nietGereed", { aantal: samenvatting.blokkerend })}
          </p>
        </div>
      )}

      <div className="ph-card uren-kaart">
        <div className="operatie-kop">
          <h3 className="zij-kop">{t("tacho.termijnen")}</h3>
          <span className="melding-teller">{termijnen.filter((s) => s.ernst !== "ok").length}</span>
        </div>
        <p className="uren-noot">{t("tacho.termijnenNoot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("tacho.soort")}</th>
                <th>{t("tacho.onderwerp")}</th>
                <th>{t("tacho.laatste")}</th>
                <th>{t("tacho.termijn")}</th>
                <th>{t("tacho.resterend")}</th>
              </tr>
            </thead>
            <tbody>
              {termijnen.map((s) => (
                <tr key={`${s.soort}-${s.onderwerp}`} className={s.ernst === "verstreken" ? "log-fout" : undefined}>
                  <td>{t(`tacho.soort.${s.soort}`)}</td>
                  <td>{s.onderwerp}</td>
                  <td>{s.laatsteUitlezingIso
                    ? t("tacho.dagenGeleden", { dagen: s.dagenGeleden ?? 0 })
                    : t("tacho.nooit")}</td>
                  <td>{t("tacho.elkeDagen", { dagen: s.termijnDagen })}</td>
                  <td>
                    <span className={`klok-chip ${
                      s.ernst === "verstreken" ? "rt-kritiek" : s.ernst === "waarschuwing" ? "rt-warn" : "rt-ok"
                    }`}>
                      {s.dagenResterend === null
                        ? t("tacho.nooit")
                        : s.dagenResterend < 0
                          ? t("tacho.teLaat", { dagen: -s.dagenResterend })
                          : t("tacho.nogDagen", { dagen: s.dagenResterend })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
