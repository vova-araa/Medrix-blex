import { formatteerGeld } from "@sharzi/domain";
import type { Tarief } from "../data/bron";
import { conceptFacturen } from "../data/facturen";
import type { AppState } from "../data/state";
import { t } from "../i18n";

interface Props {
  state: AppState;
  onZetTarief: (opdrachtgever: string, tarief: Tarief) => void;
}

export function FacturenView({ state, onZetTarief }: Props) {
  const facturen = conceptFacturen(state);
  const opdrachtgevers = [...new Set(Object.values(state.orders).map((o) => o.opdrachtgever))].sort();

  return (
    <div className="facturen-main">
      <div className="facturen-kop">
        <h3 className="zij-kop">{t("facturen.titel")}</h3>
        <p className="uren-noot">{t("facturen.noot")}</p>
      </div>

      <div className="ph-card uren-kaart tarieven-kaart">
        <h4 className="zij-kop">{t("tarieven.titel")}</h4>
        <p className="uren-noot">{t("tarieven.noot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("tarieven.opdrachtgever")}</th>
                <th>{t("tarieven.basis")}</th>
                <th>{t("tarieven.perLm")}</th>
              </tr>
            </thead>
            <tbody>
              {opdrachtgevers.map((naam) => {
                const tarief = state.tarieven[naam] ?? { basisCenten: 4500, perLaadmeterCenten: 1850 };
                const zetCenten = (veld: keyof Tarief) => (waarde: string) =>
                  onZetTarief(naam, { ...tarief, [veld]: Math.round(Number(waarde) * 100) });
                return (
                  <tr key={naam}>
                    <td>{naam}</td>
                    <td>
                      <input
                        className="tarief-invoer" type="number" min="0" step="0.50"
                        value={(tarief.basisCenten / 100).toFixed(2)}
                        onChange={(e) => zetCenten("basisCenten")(e.target.value)}
                        aria-label={`${t("tarieven.basis")} ${naam}`}
                      />
                    </td>
                    <td>
                      <input
                        className="tarief-invoer" type="number" min="0" step="0.25"
                        value={(tarief.perLaadmeterCenten / 100).toFixed(2)}
                        onChange={(e) => zetCenten("perLaadmeterCenten")(e.target.value)}
                        aria-label={`${t("tarieven.perLm")} ${naam}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
