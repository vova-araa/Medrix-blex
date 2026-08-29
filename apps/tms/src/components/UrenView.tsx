import { RIJTIJD_REGELS, urenTotalen } from "@sharzi/domain";
import { rijtijdVan, werktijdenVan, type AppState } from "../data/state";
import { t } from "../i18n";
import { kmVandaag } from "../kaart/simulatie";
import { initialen, tijd } from "../utils";
import { Icoon } from "./Icoon";

const uren = (minuten: number) =>
  `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;

interface Props {
  state: AppState;
  nu: string;
}

export function UrenView({ state, nu }: Props) {
  const chauffeurs = state.ritten.map((r) => r.chauffeur).filter(Boolean);

  const naleving = chauffeurs
    .map((naam) => ({ naam, status: rijtijdVan(state, naam, nu) }))
    .flatMap(({ naam, status }) => status.overtredingen.map((o) => ({ naam, ...o })));

  return (
    <div className="uren-main">
      <div className="ph-card uren-kaart">
        <div className="operatie-kop">
          <h3 className="zij-kop"><Icoon naam="waarschuwing" maat={15} /> {t("naleving.titel")}</h3>
          <span className="melding-teller">{naleving.length}</span>
        </div>
        <p className="uren-noot">{t("naleving.noot")}</p>
        {naleving.length === 0 ? (
          <p className="kaart-kies">{t("naleving.geen")}</p>
        ) : (
          <ul className="naleving-lijst">
            {naleving.map((o, i) => (
              <li key={i} className={`naleving-regel e-${o.ernst}`}>
                <span className="avatar avatar-klein">{initialen(o.naam)}</span>
                <div>
                  <div className="naleving-wie">
                    {o.naam}
                    <span className={`klok-chip ${o.ernst === "overtreding" ? "rt-kritiek" : "rt-warn"}`}>
                      {t(`naleving.ernst.${o.ernst}`)}
                    </span>
                  </div>
                  <div className="naleving-oms">{o.omschrijving}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop"><Icoon naam="stuur" maat={15} /> {t("rijtijd.titel")}</h3>
        <p className="uren-noot">{t("rijtijd.noot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("uren.chauffeur")}</th>
                <th>{t("rijtijd.vandaag")}</th>
                <th>{t("rijtijd.nogDag")}</th>
                <th>{t("rijtijd.blok")}</th>
                <th>{t("rijtijd.week")}</th>
                <th>{t("rijtijd.tweeWeken")}</th>
                <th>{t("rijtijd.verlengingen")}</th>
                <th>{t("rijtijd.arbeid")}</th>
                <th>{t("rijtijd.weekrust")}</th>
                <th>{t("rijtijd.status")}</th>
              </tr>
            </thead>
            <tbody>
              {chauffeurs.map((naam) => {
                const rijtijd = rijtijdVan(state, naam, nu);
                const dagPct = Math.min(100, Math.round((rijtijd.dagRijMinuten / RIJTIJD_REGELS.maxDagRijMinuten) * 100));
                const chip = rijtijd.pauzeNodig
                  ? { cls: "rt-kritiek", tekst: t("rijtijd.pauzeNu") }
                  : rijtijd.blokResterendMinuten <= 30 || rijtijd.dagResterendMinuten <= 60 || rijtijd.weekResterendMinuten <= 120
                    ? { cls: "rt-warn", tekst: t("rijtijd.bijnaOp") }
                    : { cls: "rt-ok", tekst: t("rijtijd.ok") };
                return (
                  <tr key={naam}>
                    <td>
                      <span className="avatar avatar-klein">{initialen(naam)}</span> {naam}
                    </td>
                    <td>
                      <div className="rijtijd-cel">
                        <span>{uren(rijtijd.dagRijMinuten)}</span>
                        <div className="lm-bar rijtijd-bar">
                          <div className={`lm-fill${dagPct >= 90 ? " vol" : ""}`} style={{ width: `${dagPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td><b>{uren(rijtijd.dagResterendMinuten)}</b></td>
                    <td>
                      {rijtijd.pauzeNodig
                        ? t("rijtijd.pauzeVerplicht")
                        : t("rijtijd.blokOver", { tijd: uren(rijtijd.blokResterendMinuten) })}
                    </td>
                    <td>{uren(rijtijd.weekRijMinuten)} / {uren(RIJTIJD_REGELS.maxWeekRijMinuten)}</td>
                    <td className={rijtijd.tweeWekenResterendMinuten <= 4 * 60 ? "eta-te-laat" : undefined}>
                      {uren(rijtijd.tweeWekenRijMinuten)} / {uren(RIJTIJD_REGELS.maxTweeWekenRijMinuten)}
                    </td>
                    <td>
                      {t("rijtijd.verlengingenWaarde", {
                        gebruikt: rijtijd.verlengingenGebruikt,
                        max: RIJTIJD_REGELS.maxVerlengingenPerWeek,
                      })}
                    </td>
                    <td className={rijtijd.weekArbeidResterendMinuten <= 2 * 60 ? "eta-te-laat" : undefined}>
                      {uren(rijtijd.weekArbeidMinuten)} / {uren(RIJTIJD_REGELS.maxWeekArbeidMinuten)}
                    </td>
                    <td className={
                      rijtijd.minutenTotWeekRustDeadline !== null && rijtijd.minutenTotWeekRustDeadline <= 24 * 60
                        ? "eta-te-laat" : undefined
                    }>
                      {rijtijd.minutenTotWeekRustDeadline === null
                        ? "—"
                        : rijtijd.minutenTotWeekRustDeadline < 0
                          ? t("rijtijd.weekrustTe", { tijd: uren(-rijtijd.minutenTotWeekRustDeadline) })
                          : t("rijtijd.weekrustBinnen", { tijd: uren(rijtijd.minutenTotWeekRustDeadline) })}
                    </td>
                    <td><span className={`klok-chip ${chip.cls}`}>{chip.tekst}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("uren.titel")}</h3>
        <p className="uren-noot">{t("uren.avgNoot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("uren.chauffeur")}</th>
                <th>{t("uren.status")}</th>
                <th>{t("uren.ingeklokt")}</th>
                <th>{t("uren.dienst")}</th>
                <th>{t("uren.rijden")}</th>
                <th>{t("uren.werk")}</th>
                <th>{t("uren.pauze")}</th>
                <th>{t("uren.beschikbaar")}</th>
                <th>{t("uren.km")}</th>
              </tr>
            </thead>
            <tbody>
              {chauffeurs.map((naam) => {
                const events = werktijdenVan(state, naam);
                const totalen = urenTotalen(events, nu);
                const ingeklokt = events.find((e) => e.type === "ingeklokt");
                const rit = state.ritten.find((r) => r.chauffeur === naam);
                return (
                  <tr key={naam}>
                    <td>
                      <span className="avatar avatar-klein">{initialen(naam)}</span> {naam}
                    </td>
                    <td>
                      {totalen.actief ? (
                        <span className={`klok-chip k-${totalen.actief}`}>{t(`uren.actief.${totalen.actief}`)}</span>
                      ) : (
                        <span className="klok-chip k-uit">{t("uren.actief.uit")}</span>
                      )}
                    </td>
                    <td>{ingeklokt ? tijd(ingeklokt.tijdstip) : "—"}</td>
                    <td><b>{uren(totalen.dienstMinuten)}</b></td>
                    <td>{uren(totalen.rijMinuten)}</td>
                    <td>{uren(totalen.werkMinuten)}</td>
                    <td>{uren(totalen.pauzeMinuten)}</td>
                    <td>{uren(totalen.beschikbaarMinuten)}</td>
                    <td>{rit ? `${kmVandaag(state, rit.id)} km` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
