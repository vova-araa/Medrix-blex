import type { Order, Zending } from "@sharzi/domain";
import { useState } from "react";
import { eventsVanTaak, statusVanTaak, type AppState } from "../data/state";
import { statusLabel, t } from "../i18n";
import { ritEta } from "../kaart/simulatie";
import { datumDagKort, tijd, venster } from "../utils";
import { Icoon } from "./Icoon";
import { OrderFormulier } from "./OrderFormulier";

// Twee gezichten van hetzelfde portaal:
// · Ontvanger — de publieke track & trace-pagina bij één barcode.
// · Opdrachtgever — ingelogd, ziet zijn eigen zendingen en meldt nieuwe aan.
// Privacy (§9): geen chauffeursnamen, geen apparaten — alleen zendingstatus.

type Kant = "ontvanger" | "opdrachtgever";

export function PortaalView({ state, nu, standaardDatum, onAfspraak, onAanmaken }: {
  state: AppState;
  nu: string;
  standaardDatum: string;
  onAfspraak: () => void;
  onAanmaken: (order: Order, zending: Zending) => void;
}) {
  const [kant, setKant] = useState<Kant>("ontvanger");
  const zendingIds = Object.keys(state.zendingen);
  const [gekozen, setGekozen] = useState(zendingIds[0] ?? "");
  const zending = state.zendingen[gekozen];

  const lossenTaak = state.taken.find(
    (taak) => taak.soort === "lossen" && taak.zendingId === gekozen
  );
  const status = lossenTaak ? statusVanTaak(state, lossenTaak.id) : null;
  const rit = lossenTaak && state.ritten.find((r) => r.id === lossenTaak.ritId);
  const eta = rit ? ritEta(state, rit.id, nu) : null;
  const etaVoorDeze = eta && lossenTaak && eta.taakId === lossenTaak.id ? eta : null;

  const stappen = lossenTaak
    ? eventsVanTaak(state, lossenTaak.id).map((e) => ({
        id: e.id,
        label: t(`portaal.stap.${e.type}`),
        tijdstip: e.tijdstip,
      }))
    : [];

  return (
    <div className="kaart-main">
      <aside className="kaart-zij">
        <div className="ph-card">
          <h4 className="zij-kop">{t("portaal.titel")}</h4>
          <p className="uren-noot">{t("portaal.noot")}</p>
          <div className="portaal-kant">
            {(["ontvanger", "opdrachtgever"] as Kant[]).map((k) => (
              <button
                key={k}
                className={`dagkiezer-tab${k === kant ? " actief" : ""}`}
                onClick={() => setKant(k)}
              >
                {t(`portaal.kant.${k}`)}
              </button>
            ))}
          </div>
          {kant === "ontvanger" && (
            <label className="portaal-kies">
              {t("portaal.kiesZending")}
              <select value={gekozen} onChange={(e) => setGekozen(e.target.value)}>
                {zendingIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          )}
        </div>
      </aside>

      {kant === "opdrachtgever" ? (
        <OpdrachtgeverPortaal
          state={state}
          nu={nu}
          standaardDatum={standaardDatum}
          onAanmaken={onAanmaken}
        />
      ) : (

      <div className="portaal-preview">
        <div className="portaal-frame">
          <div className="portaal-balk">
            <span className="mark">S</span> {t("app.naam")} · {t("portaal.trackTrace")}
          </div>
          {zending && (
            <div className="portaal-inhoud">
              <p className="portaal-barcode mono">{zending.barcode}</p>
              <h3>{zending.van.plaats} → {zending.naar.plaats}</h3>
              <p className="portaal-oms">{zending.omschrijving}</p>

              {status && (
                <span className={`status-chip s-${status === "bezig" || status === "onderweg" ? "onderweg" : status}`}>
                  {status === "afgerond" ? t("portaal.bezorgd") : statusLabel(status)}
                </span>
              )}

              {etaVoorDeze && (
                <p className={`portaal-eta${etaVoorDeze.naVenster ? " eta-te-laat" : ""}`}>
                  {t("portaal.verwacht", { tijd: tijd(etaVoorDeze.aankomstIso) })}
                  {etaVoorDeze.vertragingMin > 0 && ` (+${etaVoorDeze.vertragingMin} min)`}
                </p>
              )}
              {zending.naar.tijdvenster && (
                <p className="portaal-venster">
                  {t("portaal.venster", { venster: venster(zending.naar.tijdvenster) })}
                </p>
              )}

              {stappen.length > 0 && (
                <ul className="event-list portaal-tijdlijn">
                  {[...stappen].reverse().map((stap) => (
                    <li key={stap.id}>
                      <div className="e-type">{stap.label}</div>
                      <div className="e-meta">{tijd(stap.tijdstip)}</div>
                    </li>
                  ))}
                </ul>
              )}

              {status !== "afgerond" && (
                <button className="btn" onClick={onAfspraak}>{t("portaal.verzet")}</button>
              )}
              <p className="portaal-privacy">{t("portaal.privacy")}</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Wat een opdrachtgever ziet als hij zelf inlogt: alleen zijn eigen zendingen,
 * en een formulier om nieuwe transportopdrachten aan te melden. De aanmelding
 * loopt door dezelfde controle als de invoer aan de balie.
 */
function OpdrachtgeverPortaal({ state, nu, standaardDatum, onAanmaken }: {
  state: AppState;
  nu: string;
  standaardDatum: string;
  onAanmaken: (order: Order, zending: Zending) => void;
}) {
  const namen = [
    ...new Set(Object.values(state.orders).map((o) => o.opdrachtgever)),
  ].sort();
  const [klant, setKlant] = useState(namen[0] ?? "");
  const [aangemeld, setAangemeld] = useState<string[]>([]);

  // Alleen zendingen van deze opdrachtgever: het portaal is klant-gescoped,
  // net zoals de database tenant-gescoped is (§8).
  const eigenOrders = new Set(
    Object.values(state.orders).filter((o) => o.opdrachtgever === klant).map((o) => o.id)
  );
  const eigen = Object.values(state.zendingen).filter((z) => eigenOrders.has(z.orderId));

  const regels = eigen.map((zending) => {
    const losTaak = state.taken.find((tk) => tk.soort === "lossen" && tk.zendingId === zending.id);
    const rit = losTaak && state.ritten.find((r) => r.id === losTaak.ritId);
    return {
      zending,
      status: losTaak ? statusVanTaak(state, losTaak.id) : null,
      datum: rit?.datum ?? null,
      nieuw: aangemeld.includes(zending.id),
    };
  });

  return (
    <div className="portaal-klant">
      <div className="ph-card">
        <div className="pk-kop">
          <h4 className="zij-kop">{t("portaal.mijnZendingen")}</h4>
          <label className="pk-wie">
            {t("portaal.ingelogdAls")}
            <select value={klant} onChange={(e) => { setKlant(e.target.value); setAangemeld([]); }}>
              {namen.map((naam) => <option key={naam}>{naam}</option>)}
            </select>
          </label>
        </div>
        {regels.length === 0 ? (
          <p className="kaart-kies">{t("portaal.geenZendingen")}</p>
        ) : (
          <div className="rap-tabelwrap">
            <table className="rap-tabel">
              <thead>
                <tr>
                  <th>{t("portaal.kol.barcode")}</th>
                  <th>{t("portaal.kol.route")}</th>
                  <th>{t("portaal.kol.lading")}</th>
                  <th>{t("portaal.kol.dag")}</th>
                  <th>{t("portaal.kol.status")}</th>
                </tr>
              </thead>
              <tbody>
                {regels.map(({ zending, status, datum, nieuw }) => (
                  <tr key={zending.id} className={nieuw ? "pk-nieuw" : ""}>
                    <td className="mono">{zending.barcode}</td>
                    <td>{zending.van.plaats} → {zending.naar.naam}</td>
                    <td>{zending.omschrijving}</td>
                    <td>{datum ? datumDagKort(`${datum}T12:00:00Z`) : t("portaal.nogNietGepland")}</td>
                    <td>
                      {status
                        ? <span className={`status-chip s-${status}`}>{statusLabel(status)}</span>
                        : <span className="status-chip s-gepland">{t("portaal.aangemeld")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ph-card">
        <h4 className="zij-kop"><Icoon naam="plus" maat={13} /> {t("portaal.nieuweOpdracht")}</h4>
        <p className="rap-uitleg">{t("portaal.nieuweOpdrachtUitleg")}</p>
        <OrderFormulier
          state={state}
          nu={nu}
          standaardDatum={standaardDatum}
          vasteOpdrachtgever={klant}
          knopLabel={t("portaal.meldAan")}
          onAanmaken={(order, zending) => {
            setAangemeld((vorig) => [...vorig, zending.id]);
            onAanmaken(order, zending);
          }}
        />
      </div>
    </div>
  );
}
