import { formatteerGeld, formatteerKenteken } from "@sharzi/domain";
import type { AppState } from "../data/state";
import { t } from "../i18n";

const DAG_MS = 24 * 60 * 60 * 1000;

export function WagenparkView({ state, nu }: { state: AppState; nu: string }) {
  return (
    <div className="uren-main">
      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("wagenpark.titel")}</h3>
        <p className="uren-noot">{t("wagenpark.noot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("wagenpark.voertuig")}</th>
                <th>{t("wagenpark.kmStand")}</th>
                <th>{t("wagenpark.apk")}</th>
                <th>{t("wagenpark.onderhoud")}</th>
                <th>{t("wagenpark.verbruik")}</th>
                <th>{t("wagenpark.kosten")}</th>
              </tr>
            </thead>
            <tbody>
              {state.wagenpark.map((voertuig) => {
                const apkDagen = Math.floor((Date.parse(voertuig.apkTot) - Date.parse(nu)) / DAG_MS);
                const kmTeGaan = voertuig.volgendeOnderhoudKm - voertuig.kmStand;
                return (
                  <tr key={voertuig.kenteken}>
                    <td>
                      <span className="plate">
                        <span className="eu">{voertuig.landcode}</span>
                        <span className="nr">
                          {formatteerKenteken({ landcode: voertuig.landcode, kenteken: voertuig.kenteken })}
                        </span>
                      </span>
                      <span className="voertuigtype wagenpark-type">{voertuig.omschrijving}</span>
                    </td>
                    <td>{voertuig.kmStand.toLocaleString("nl-NL")} km</td>
                    <td>
                      {new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" })
                        .format(new Date(voertuig.apkTot))}
                      {apkDagen <= 30 && (
                        <span className="eta-chip te-laat wagenpark-alarm">
                          {t("wagenpark.apkBinnen", { dagen: apkDagen })}
                        </span>
                      )}
                    </td>
                    <td>
                      {t("wagenpark.overKm", { km: kmTeGaan.toLocaleString("nl-NL") })}
                      {kmTeGaan <= 8000 && (
                        <span className="eta-chip wagenpark-alarm">{t("wagenpark.plannen")}</span>
                      )}
                    </td>
                    <td>{voertuig.verbruikL100.toLocaleString("nl-NL")} l/100km</td>
                    <td>{formatteerGeld({ bedragCenten: voertuig.kostenPerMaandCenten, valuta: "EUR" })}/{t("wagenpark.maand")}</td>
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
