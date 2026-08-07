import { urenTotalen } from "@sharzi/domain";
import { werktijdenVan, type AppState } from "../data/state";
import { t } from "../i18n";
import { kmVandaag } from "../kaart/simulatie";
import { initialen, tijd } from "../utils";

const uren = (minuten: number) =>
  `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;

interface Props {
  state: AppState;
  nu: string;
}

export function UrenView({ state, nu }: Props) {
  const chauffeurs = state.ritten.map((r) => r.chauffeur).filter(Boolean);

  return (
    <div className="uren-main">
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
