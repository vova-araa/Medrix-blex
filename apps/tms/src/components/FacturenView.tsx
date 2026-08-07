import { formatteerGeld } from "@sharzi/domain";
import { conceptFacturen } from "../data/facturen";
import type { AppState } from "../data/state";
import { t } from "../i18n";

export function FacturenView({ state }: { state: AppState }) {
  const facturen = conceptFacturen(state);

  return (
    <div className="facturen-main">
      <div className="facturen-kop">
        <h3 className="zij-kop">{t("facturen.titel")}</h3>
        <p className="uren-noot">{t("facturen.noot")}</p>
      </div>
      {facturen.length === 0 && (
        <div className="ph-card"><p className="kaart-kies">{t("facturen.leeg")}</p></div>
      )}
      <div className="facturen-grid">
        {facturen.map((factuur) => (
          <div className="ph-card factuur-kaart" key={factuur.opdrachtgever}>
            <div className="factuur-kop">
              <b>{factuur.opdrachtgever}</b>
              <span className="status-chip s-gepland">{t("facturen.concept")}</span>
            </div>
            <table className="factuur-regels">
              <tbody>
                {factuur.regels.map((regel) => (
                  <tr key={regel.omschrijving}>
                    <td>{regel.omschrijving}</td>
                    <td className="bedrag">{formatteerGeld(regel.bedrag)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t("facturen.subtotaal")}</td>
                  <td className="bedrag">{formatteerGeld(factuur.totalen.subtotaal)}</td>
                </tr>
                <tr>
                  <td>{t("facturen.btw")}</td>
                  <td className="bedrag">{formatteerGeld(factuur.totalen.btw)}</td>
                </tr>
                <tr className="factuur-totaal">
                  <td>{t("facturen.totaal")}</td>
                  <td className="bedrag">{formatteerGeld(factuur.totalen.totaal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
