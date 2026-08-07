import { formatteerKenteken, type Zending } from "@sharzi/domain";
import { useState } from "react";
import { eventsVanTaak, statusVanTaak, type AppState } from "../data/state";
import { t } from "../i18n";
import { laadmeters, tijd } from "../utils";
import { Icoon } from "./Icoon";

// Digitale vrachtbrief: volledig opgebouwd uit het eigen datamodel — partijen,
// lading en de append-only event-log als bewijs (§5.1). Eigen documentvorm,
// geen kopie van bestaande formulieren.

export function DocumentenView({ state }: { state: AppState }) {
  const [open, setOpen] = useState<string | null>(null);
  const zendingen = Object.values(state.zendingen);

  const lossenTaak = (z: Zending) =>
    state.taken.find((taak) => taak.soort === "lossen" && taak.zendingId === z.id);

  return (
    <div className="uren-main">
      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("documenten.titel")}</h3>
        <p className="uren-noot">{t("documenten.noot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("detail.zending")}</th>
                <th>{t("klanten.klant")}</th>
                <th>{t("documenten.route")}</th>
                <th>{t("documenten.pod")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zendingen.map((z) => {
                const taak = lossenTaak(z);
                const gelost = taak && statusVanTaak(state, taak.id) === "afgerond";
                const order = state.orders[z.orderId];
                return (
                  <tr key={z.id}>
                    <td className="mono">{z.barcode}</td>
                    <td>{order?.opdrachtgever ?? "—"}</td>
                    <td>{z.van.plaats} → {z.naar.plaats}</td>
                    <td>
                      {gelost
                        ? <span className="status-chip s-afgerond">{t("documenten.podJa")}</span>
                        : <span className="status-chip s-gepland">{t("documenten.podNee")}</span>}
                    </td>
                    <td>
                      <button className="btn knop-met-icoon" onClick={() => setOpen(z.id)}>
                        <Icoon naam="document" maat={13} /> {t("documenten.open")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && state.zendingen[open] && (
        <Vrachtbrief state={state} zending={state.zendingen[open]} onSluit={() => setOpen(null)} />
      )}
    </div>
  );
}

function Vrachtbrief({ state, zending, onSluit }: {
  state: AppState;
  zending: Zending;
  onSluit: () => void;
}) {
  const order = state.orders[zending.orderId];
  const taken = state.taken.filter((taak) => taak.zendingId === zending.id);
  const rit = taken.length ? state.ritten.find((r) => r.id === taken[0].ritId) : undefined;
  const events = taken
    .flatMap((taak) => eventsVanTaak(state, taak.id))
    .filter((e) => e.type !== "taak_aangemaakt")
    .sort((a, b) => a.tijdstip.localeCompare(b.tijdstip));
  const pod = events.filter((e) => e.type === "gelost").at(-1);

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail vrachtbrief-paneel">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
          <div className="eyebrow">{t("documenten.eyebrow")}</div>
          <h3 className="mono">{zending.barcode}</h3>
        </div>
        <div className="detail-body vrachtbrief">
          <div className="vb-partijen">
            <div className="vb-blok">
              <span className="vb-label">{t("documenten.afzender")}</span>
              <b>{zending.van.naam}</b><span>{zending.van.plaats}, {zending.van.land}</span>
            </div>
            <div className="vb-blok">
              <span className="vb-label">{t("documenten.ontvanger")}</span>
              <b>{zending.naar.naam}</b><span>{zending.naar.plaats}, {zending.naar.land}</span>
            </div>
            <div className="vb-blok">
              <span className="vb-label">{t("documenten.vervoerder")}</span>
              <b>Blex Logistics</b>
              {rit && (
                <span>
                  {rit.chauffeur} · {rit.voertuig.landcode}{" "}
                  {formatteerKenteken({ landcode: rit.voertuig.landcode, kenteken: rit.voertuig.kentekenGenormaliseerd })}
                </span>
              )}
            </div>
            <div className="vb-blok">
              <span className="vb-label">{t("documenten.opdracht")}</span>
              <b>{order?.opdrachtgever ?? "—"}</b>
              <span className="mono">{order?.referentie ?? ""}</span>
            </div>
          </div>

          <div className="vb-lading">
            <span className="vb-label">{t("documenten.lading")}</span>
            <p>{zending.omschrijving}</p>
            <span className="vb-specs">
              {laadmeters(zending.laadmeters)} lm · {zending.gewichtKg.toLocaleString("nl-NL")} kg
            </span>
          </div>

          <div className="events">
            <h4>{t("documenten.bewijs")}</h4>
            <p className="events-note">{t("detail.eventlogNoot")}</p>
            <ul className="event-list">
              {[...events].reverse().map((e) => (
                <li key={e.id}>
                  <div className="e-type">{t(`event.${e.type}`)}</div>
                  <div className="e-meta">{tijd(e.tijdstip)} · {e.wie} · {e.apparaat}</div>
                </li>
              ))}
            </ul>
          </div>

          {pod ? (
            <div className="vb-pod">
              <Icoon naam="pen" maat={15} />
              <div>
                <b>{t("documenten.podBevestigd")}</b>
                <span>{t("documenten.podDetail", { tijd: tijd(pod.tijdstip), wie: pod.wie })}</span>
              </div>
            </div>
          ) : (
            <p className="uren-noot">{t("documenten.podOpen")}</p>
          )}

          <p className="vb-voet">{t("documenten.voet")}</p>
          <button className="btn primary knop-met-icoon" onClick={() => window.print()}>
            <Icoon naam="document" maat={14} /> {t("documenten.print")}
          </button>
        </div>
      </aside>
    </div>
  );
}
