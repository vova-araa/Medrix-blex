import {
  achterstallig, formatteerGeld, magVerstuurdWorden, ontbrekendeGegevens,
  totalenVan, type Factuur,
} from "@sharzi/domain";
import { useState } from "react";
import type { Tarief } from "../data/bron";
import { conceptFacturen } from "../data/facturen";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { datumKort } from "../utils";
import { Icoon } from "./Icoon";

interface Props {
  state: AppState;
  nu: string;
  onZetTarief: (opdrachtgever: string, tarief: Tarief) => void;
  onMaakFactuur: (opdrachtgever: string) => void;
  onVerstuurFactuur: (nummer: string) => void;
  onMarkeerBetaald: (nummer: string) => void;
  onCrediteer: (nummer: string) => void;
}

const STATUS_CHIP: Record<Factuur["status"], string> = {
  concept: "rt-warn",
  verstuurd: "k-actief",
  betaald: "rt-ok",
  gecrediteerd: "k-hersteld",
};

export function FacturenView({
  state, nu, onZetTarief, onMaakFactuur, onVerstuurFactuur, onMarkeerBetaald, onCrediteer,
}: Props) {
  const concepten = conceptFacturen(state);
  const openstaand = achterstallig(state.facturen, nu);
  // Voor wie is er nog geen factuur opgemaakt vandaag?
  const alReedsGefactureerd = new Set(
    state.facturen.filter((f) => f.status !== "gecrediteerd").map((f) => f.ontvanger.naam)
  );

  return (
    <div className="uren-main">
      {openstaand.length > 0 && (
        <div className="ph-card uren-kaart">
          <div className="operatie-kop">
            <h3 className="zij-kop"><Icoon naam="waarschuwing" maat={15} /> {t("factuur.openstaand")}</h3>
            <span className="melding-teller">{openstaand.length}</span>
          </div>
          <p className="uren-noot">{t("factuur.openstaandNoot")}</p>
          <div className="table-scroll">
            <table className="uren-tabel">
              <thead>
                <tr>
                  <th>{t("factuur.nummer")}</th>
                  <th>{t("factuur.ontvanger")}</th>
                  <th>{t("factuur.bedrag")}</th>
                  <th>{t("factuur.vervallen")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {openstaand.map((post) => (
                  <tr key={post.nummer} className="log-fout">
                    <td className="mono">{post.nummer}</td>
                    <td>{post.ontvanger}</td>
                    <td><b>{formatteerGeld(post.totaal)}</b></td>
                    <td><span className="klok-chip rt-kritiek">{t("factuur.dagenTeLaat", { dagen: post.dagenTeLaat })}</span></td>
                    <td>
                      <button className="btn knop-met-icoon" onClick={() => onVerstuurFactuur(post.nummer)}>
                        <Icoon naam="mail" maat={12} /> {t("factuur.herinner")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("factuur.concepten")}</h3>
        <p className="uren-noot">{t("factuur.conceptenNoot")}</p>
        {concepten.length === 0 && <p className="kaart-kies">{t("factuur.geenConcepten")}</p>}
        <div className="factuur-lijst">
          {concepten.map((concept) => (
            <div className="factuur-kaart" key={concept.opdrachtgever}>
              <div className="factuur-kop">
                <b>{concept.opdrachtgever}</b>
                <span className="factuur-totaal">{formatteerGeld(concept.totalen.totaal)}</span>
              </div>
              <ul className="factuur-regels">
                {concept.regels.map((regel, i) => (
                  <li key={i}>
                    <span>{regel.omschrijving}</span>
                    <span className="mono">{formatteerGeld(regel.bedrag)}</span>
                  </li>
                ))}
              </ul>
              <div className="factuur-voet">
                <span className="uren-noot">
                  {t("factuur.subtotaal")} {formatteerGeld(concept.totalen.subtotaal)} ·
                  {" "}{t("factuur.btw")} {formatteerGeld(concept.totalen.btw)}
                </span>
                <button
                  className="btn primary knop-met-icoon"
                  disabled={alReedsGefactureerd.has(concept.opdrachtgever)}
                  onClick={() => onMaakFactuur(concept.opdrachtgever)}
                >
                  <Icoon naam="factuur" maat={13} />
                  {alReedsGefactureerd.has(concept.opdrachtgever)
                    ? t("factuur.alGefactureerd")
                    : t("factuur.maakOp")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("factuur.opgemaakt")}</h3>
        <p className="uren-noot">{t("factuur.opgemaaktNoot")}</p>
        {state.facturen.length === 0 && <p className="kaart-kies">{t("factuur.geenOpgemaakt")}</p>}
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("factuur.nummer")}</th>
                <th>{t("factuur.ontvanger")}</th>
                <th>{t("factuur.datum")}</th>
                <th>{t("factuur.bedrag")}</th>
                <th>{t("factuur.status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...state.facturen].reverse().map((factuur) => {
                const ontbreekt = ontbrekendeGegevens(factuur, state.uitgever);
                const mag = magVerstuurdWorden(factuur, state.uitgever);
                return (
                  <tr key={factuur.nummer ?? factuur.datumIso}>
                    <td className="mono">
                      {factuur.nummer}
                      {factuur.crediteertNummer && (
                        <div className="uren-noot">{t("factuur.crediteert", { nummer: factuur.crediteertNummer })}</div>
                      )}
                    </td>
                    <td>{factuur.ontvanger.naam}</td>
                    <td>{factuur.datumIso ? datumKort(factuur.datumIso) : "—"}</td>
                    <td><b>{formatteerGeld(totalenVan(factuur).totaal)}</b></td>
                    <td>
                      <span className={`klok-chip ${STATUS_CHIP[factuur.status]}`}>
                        {t(`factuur.status.${factuur.status}`)}
                      </span>
                      {!mag && (
                        <div className="factuur-ontbreekt">
                          <Icoon naam="waarschuwing" maat={11} />{" "}
                          {ontbreekt.map((v) => t(`factuur.ontbreekt.${v}`)).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="factuur-acties">
                      {factuur.status === "concept" && factuur.nummer && (
                        <button
                          className="btn primary knop-met-icoon"
                          disabled={!mag}
                          title={mag ? undefined : t("factuur.geblokkeerd")}
                          onClick={() => onVerstuurFactuur(factuur.nummer!)}
                        >
                          <Icoon naam="mail" maat={12} /> {t("factuur.verstuur")}
                        </button>
                      )}
                      {factuur.status === "verstuurd" && factuur.nummer && (
                        <>
                          <button className="btn knop-met-icoon" onClick={() => onMarkeerBetaald(factuur.nummer!)}>
                            <Icoon naam="check" maat={12} /> {t("factuur.betaald")}
                          </button>
                          <button className="btn knop-met-icoon" onClick={() => onCrediteer(factuur.nummer!)}>
                            <Icoon naam="pijl" maat={12} /> {t("factuur.crediteer")}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Tarieven state={state} onZetTarief={onZetTarief} />
    </div>
  );
}

function Tarieven({ state, onZetTarief }: { state: AppState; onZetTarief: Props["onZetTarief"] }) {
  const [bewerkt, setBewerkt] = useState<string | null>(null);
  const namen = Object.keys(state.tarieven).sort();

  return (
    <div className="ph-card uren-kaart">
      <h3 className="zij-kop">{t("tarieven.titel")}</h3>
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
            {namen.map((naam) => {
              const tarief = state.tarieven[naam];
              return (
                <tr key={naam}>
                  <td>{naam}</td>
                  <td>
                    <input
                      type="number" min="0" step="0.50" className="tarief-invoer"
                      value={(tarief.basisCenten / 100).toFixed(2)}
                      onFocus={() => setBewerkt(naam)}
                      onChange={(e) => onZetTarief(naam, {
                        ...tarief, basisCenten: Math.round(Number(e.target.value) * 100),
                      })}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" step="0.25" className="tarief-invoer"
                      value={(tarief.perLaadmeterCenten / 100).toFixed(2)}
                      onFocus={() => setBewerkt(naam)}
                      onChange={(e) => onZetTarief(naam, {
                        ...tarief, perLaadmeterCenten: Math.round(Number(e.target.value) * 100),
                      })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bewerkt && <p className="uren-noot">{t("tarieven.directDoor")}</p>}
    </div>
  );
}
