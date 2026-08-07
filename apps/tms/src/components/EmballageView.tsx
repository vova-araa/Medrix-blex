import { emballageSaldi, type EmballageSoort } from "@sharzi/domain";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { tijd } from "../utils";

const SOORTEN: EmballageSoort[] = ["europallet", "rolcontainer", "fust", "kist"];

export function EmballageView({ state }: { state: AppState }) {
  const saldi = emballageSaldi(state.emballage);
  const klanten = Object.keys(saldi).sort();
  const recente = [...state.emballage].reverse().slice(0, 12);

  return (
    <div className="uren-main">
      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("emballage.titel")}</h3>
        <p className="uren-noot">{t("emballage.noot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("emballage.klant")}</th>
                {SOORTEN.map((soort) => <th key={soort}>{t(`emballage.soort.${soort}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {klanten.map((klant) => (
                <tr key={klant}>
                  <td>{klant}</td>
                  {SOORTEN.map((soort) => {
                    const saldo = saldi[klant]?.[soort] ?? 0;
                    return (
                      <td key={soort} className={saldo > 0 ? "saldo-plus" : saldo < 0 ? "saldo-min" : "saldo-nul"}>
                        {saldo > 0 ? `+${saldo}` : saldo}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="uren-noot saldo-uitleg">{t("emballage.uitleg")}</p>
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("emballage.transacties")}</h3>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("emballage.tijd")}</th>
                <th>{t("emballage.klant")}</th>
                <th>{t("emballage.soortKop")}</th>
                <th>{t("emballage.geleverd")}</th>
                <th>{t("emballage.retour")}</th>
                <th>{t("emballage.bron")}</th>
              </tr>
            </thead>
            <tbody>
              {recente.map((transactie) => (
                <tr key={transactie.id}>
                  <td>{tijd(transactie.tijdstip)}</td>
                  <td>{transactie.klant}</td>
                  <td>{t(`emballage.soort.${transactie.soort}`)}</td>
                  <td>{transactie.geleverd || "—"}</td>
                  <td>{transactie.retour || "—"}</td>
                  <td>{transactie.ritId ?? t("emballage.depot")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
