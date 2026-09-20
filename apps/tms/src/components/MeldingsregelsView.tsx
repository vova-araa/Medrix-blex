import {
  logVanKlant, NOTIFICATIE_GEBEURTENISSEN, standaardVoorkeur, tellingPerKlant,
  type NotificatieGebeurtenis, type NotificatieStand, type Notificatievoorkeur,
} from "@sharzi/domain";
import { useMemo, useState } from "react";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { datumKort, tijd } from "../utils";
import { Icoon } from "./Icoon";

// Per opdrachtgever instellen welke gebeurtenis een bericht oplevert.
//
// Drie standen, dezelfde ladder als de rest van de automatisering:
// automatisch versturen, alleen voorstellen aan de planner, of uit. Bij een
// verschuivende aankomsttijd hoort een drempel, anders mailt de app de klant
// gek bij elke vijf minuten drift.

const STANDEN: NotificatieStand[] = ["automatisch", "voorstel", "uit"];
const MET_DREMPEL: NotificatieGebeurtenis[] = ["eta_gewijzigd", "vertraging"];

export function MeldingsregelsView({ state, onZetVoorkeur }: {
  state: AppState;
  onZetVoorkeur: (voorkeur: Notificatievoorkeur) => void;
}) {
  const klanten = useMemo(
    () => [...new Set([
      ...Object.keys(state.klanten),
      ...Object.values(state.orders).map((o) => o.opdrachtgever),
    ])].sort(),
    [state.klanten, state.orders]
  );
  const [gekozen, setGekozen] = useState(klanten[0] ?? "");

  const voorkeur = state.notificatievoorkeuren[gekozen]
    ?? standaardVoorkeur(gekozen, state.klanten[gekozen]?.email ?? "");
  const ingesteld = gekozen in state.notificatievoorkeuren;
  const tellingen = useMemo(() => tellingPerKlant(state.notificatieLog), [state.notificatieLog]);
  const eigenLog = useMemo(
    () => logVanKlant(state.notificatieLog, gekozen),
    [state.notificatieLog, gekozen]
  );

  const zet = (wijziging: Partial<Notificatievoorkeur>) =>
    onZetVoorkeur({ ...voorkeur, ...wijziging });

  const zetRegel = (
    gebeurtenis: NotificatieGebeurtenis,
    wijziging: { stand?: NotificatieStand; drempelMinuten?: number }
  ) => zet({
    regels: voorkeur.regels.map((r) =>
      r.gebeurtenis === gebeurtenis ? { ...r, ...wijziging } : r
    ),
  });

  return (
    <div className="meldingsregels">
      <aside className="mr-klanten">
        <h4 className="zij-kop">{t("melding.klanten")}</h4>
        <p className="events-note">{t("melding.klantenNoot")}</p>
        <ul>
          {klanten.map((klant) => {
            const telling = tellingen.find((x) => x.opdrachtgever === klant);
            const heeft = klant in state.notificatievoorkeuren;
            return (
              <li key={klant}>
                <button
                  className={`mr-klant${klant === gekozen ? " actief" : ""}`}
                  onClick={() => setGekozen(klant)}
                >
                  <span className="mr-naam">{klant}</span>
                  <span className="mr-meta">
                    {heeft
                      ? <span className="mr-aan">{t("melding.ingesteld")}</span>
                      : <span className="mr-uit">{t("melding.nietIngesteld")}</span>}
                    {telling && <span className="mr-telling">{telling.totaal}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="mr-paneel">
        <div className="ph-card">
          <h4 className="zij-kop">{gekozen}</h4>
          <p className="events-note">{t("melding.uitleg")}</p>
          {!ingesteld && <p className="mr-standaard">{t("melding.standaardNoot")}</p>}

          <div className="mr-adres">
            <label>
              {t("melding.email")}
              <input
                type="email"
                value={voorkeur.email}
                placeholder={t("melding.emailPlaceholder")}
                onChange={(e) => zet({ email: e.target.value })}
              />
            </label>
            <label className="doc-filter">
              <input
                type="checkbox"
                checked={voorkeur.ookOntvanger}
                onChange={(e) => zet({ ookOntvanger: e.target.checked })}
              />
              {t("melding.ookOntvanger")}
            </label>
          </div>
          {voorkeur.email.trim() === "" && (
            <p className="mr-waarschuwing">
              <Icoon naam="waarschuwing" maat={13} /> {t("melding.geenEmail")}
            </p>
          )}

          <div className="rap-tabelwrap">
            <table className="rap-tabel mr-tabel">
              <thead>
                <tr>
                  <th>{t("melding.gebeurtenis")}</th>
                  <th>{t("melding.stand")}</th>
                  <th>{t("melding.drempel")}</th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATIE_GEBEURTENISSEN.map((gebeurtenis) => {
                  const regel = voorkeur.regels.find((r) => r.gebeurtenis === gebeurtenis);
                  if (!regel) return null;
                  return (
                    <tr key={gebeurtenis}>
                      <td>
                        <b>{t(`melding.gebeurtenis.${gebeurtenis}`)}</b>
                        <span className="mr-omschrijving">
                          {t(`melding.oms.${gebeurtenis}`)}
                        </span>
                      </td>
                      <td>
                        <div className="mr-standen">
                          {STANDEN.map((stand) => (
                            <button
                              key={stand}
                              className={`mr-stand s-${stand}${regel.stand === stand ? " actief" : ""}`}
                              onClick={() => zetRegel(gebeurtenis, { stand })}
                              aria-pressed={regel.stand === stand}
                            >
                              {t(`beleid.stand.${stand}`)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        {MET_DREMPEL.includes(gebeurtenis) ? (
                          <label className="mr-drempel">
                            <input
                              type="number" min="0" step="5"
                              value={regel.drempelMinuten ?? 0}
                              onChange={(e) =>
                                zetRegel(gebeurtenis, { drempelMinuten: Number(e.target.value) })}
                            />
                            min
                          </label>
                        ) : (
                          <span className="doc-geen">—</span>
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
          <h4 className="zij-kop">{t("melding.logboek")}</h4>
          <p className="events-note">{t("melding.logboekNoot")}</p>
          {eigenLog.length === 0 ? (
            <p className="kaart-kies">{t("melding.geenLog")}</p>
          ) : (
            <ul className="event-list mr-log">
              {eigenLog.map((bericht) => (
                <li key={bericht.id}>
                  <div className="e-type">
                    <span className={`mr-herkomst h-${bericht.herkomst}`}>
                      {t(`melding.herkomst.${bericht.herkomst}`)}
                    </span>{" "}
                    {bericht.onderwerp}
                  </div>
                  <div className="mr-logtekst">{bericht.tekst}</div>
                  <div className="e-meta">
                    {datumKort(bericht.tijdstip)} {tijd(bericht.tijdstip)} ·{" "}
                    {t(`melding.gebeurtenis.${bericht.gebeurtenis}`)} ·{" "}
                    {bericht.ontvangers.join(", ")}
                    {bericht.verschuivingMinuten !== undefined &&
                      ` · ${t("melding.verschoven", { n: bericht.verschuivingMinuten })}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
