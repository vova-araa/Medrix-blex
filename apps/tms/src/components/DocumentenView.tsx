import {
  controleerVrachtbrief, formatteerGeld, formatteerKenteken, termijnenVan, vrachtbriefVan,
  type CmrVeld, type TermijnStand, type Voorbehoud, type VoorbehoudSoort, type Zending,
} from "@sharzi/domain";
import { useMemo, useState } from "react";
import { tariefVoorZending } from "../data/facturen";
import { eventsVanTaak, statusVanTaak, type AppState } from "../data/state";
import { t } from "../i18n";
import { datumKort, laadmeters, tijd } from "../utils";
import { Icoon } from "./Icoon";

// Digitale vrachtbrief: volledig opgebouwd uit het eigen datamodel — partijen,
// lading en de append-only event-log als bewijs (§5.1). Eigen documentvorm,
// geen kopie van bestaande formulieren.
//
// Twee dingen maken het verschil met een plaatje van een CMR-formulier:
// · de verplichte vermeldingen uit art. 6 lid 1 worden gecontroleerd, dus je
//   ziet dat een brief onvolledig is vóórdat er een claim komt;
// · voorbehouden uit art. 30 hebben een termijn, en die telt zichtbaar af.

const VERVOERDER = "Blex Logistics";

export function DocumentenView({ state, nu, onVoorbehoud }: {
  state: AppState;
  nu: string;
  onVoorbehoud: (zendingId: string, soort: VoorbehoudSoort, omschrijving: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [alleenOnvolledig, setAlleenOnvolledig] = useState(false);

  const regels = useMemo(
    () => Object.values(state.zendingen).map((z) => regelVan(state, z)),
    [state]
  );

  const term = zoek.trim().toLowerCase();
  const zichtbaar = regels.filter((r) => {
    if (alleenOnvolledig && r.ontbrekend.length === 0) return false;
    if (!term) return true;
    return [r.zending.barcode, r.opdrachtgever, r.zending.van.plaats, r.zending.naar.plaats, r.zending.naar.naam]
      .some((veld) => veld.toLowerCase().includes(term));
  });

  const onvolledig = regels.filter((r) => r.ontbrekend.length > 0).length;

  return (
    // Bij het afdrukken telt alleen de geopende brief; de lijst eromheen wordt
    // dan verborgen (zie de printregels in styles.css).
    <div className={`uren-main documenten${open ? " brief-open" : ""}`}>
      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("documenten.titel")}</h3>
        <p className="uren-noot">{t("documenten.noot")}</p>

        <div className="doc-balk">
          <input
            className="doc-zoek"
            type="search"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t("documenten.zoek")}
          />
          <label className="doc-filter">
            <input
              type="checkbox"
              checked={alleenOnvolledig}
              onChange={(e) => setAlleenOnvolledig(e.target.checked)}
            />
            {t("documenten.alleenOnvolledig", { n: onvolledig })}
          </label>
          <span className="doc-telling">{t("documenten.telling", { n: zichtbaar.length })}</span>
        </div>

        <div className="rap-tabelwrap">
          <table className="rap-tabel">
            <thead>
              <tr>
                <th>{t("detail.zending")}</th>
                <th>{t("klanten.klant")}</th>
                <th>{t("documenten.route")}</th>
                <th>{t("documenten.volledig")}</th>
                <th>{t("documenten.pod")}</th>
                <th>{t("documenten.voorbehoud")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((r) => (
                <tr key={r.zending.id}>
                  <td className="mono">{r.zending.barcode}</td>
                  <td>{r.opdrachtgever}</td>
                  <td>{r.zending.van.plaats} → {r.zending.naar.plaats}</td>
                  <td>
                    {r.ontbrekend.length === 0
                      ? <span className="status-chip s-afgerond">{t("documenten.compleet")}</span>
                      : <span className="status-chip s-probleem">
                          {t("documenten.mist", { n: r.ontbrekend.length })}
                        </span>}
                  </td>
                  <td>
                    {r.gelost
                      ? <span className="status-chip s-afgerond">{t("documenten.podJa")}</span>
                      : <span className="status-chip s-gepland">{t("documenten.podNee")}</span>}
                  </td>
                  <td>
                    {r.voorbehouden.length > 0
                      ? <span className="status-chip s-probleem">{r.voorbehouden.length}</span>
                      : <span className="doc-geen">—</span>}
                  </td>
                  <td>
                    <button className="btn knop-met-icoon doc-open" onClick={() => setOpen(r.zending.id)}>
                      <Icoon naam="document" maat={13} /> {t("documenten.open")}
                    </button>
                  </td>
                </tr>
              ))}
              {zichtbaar.length === 0 && (
                <tr><td colSpan={7} className="doc-geen">{t("documenten.geenResultaat")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && state.zendingen[open] && (
        <Vrachtbrief
          state={state}
          nu={nu}
          zending={state.zendingen[open]}
          onVoorbehoud={onVoorbehoud}
          onSluit={() => setOpen(null)}
        />
      )}
    </div>
  );
}

interface Regel {
  zending: Zending;
  opdrachtgever: string;
  gelost: boolean;
  ontbrekend: CmrVeld[];
  voorbehouden: Voorbehoud[];
}

function regelVan(state: AppState, zending: Zending): Regel {
  const gegevens = gegevensVan(state, zending);
  const losTaak = state.taken.find((tk) => tk.soort === "lossen" && tk.zendingId === zending.id);
  return {
    zending,
    opdrachtgever: state.orders[zending.orderId]?.opdrachtgever ?? "—",
    gelost: !!losTaak && statusVanTaak(state, losTaak.id) === "afgerond",
    ontbrekend: controleerVrachtbrief(gegevens).ontbrekend,
    voorbehouden: state.voorbehouden.filter((v) => v.zendingId === zending.id),
  };
}

/** Vrachtbriefgegevens uit de state: laadtijd komt uit de event-log, niet uit de planning. */
function gegevensVan(state: AppState, zending: Zending) {
  const taken = state.taken.filter((tk) => tk.zendingId === zending.id);
  const laadTaak = taken.find((tk) => tk.soort === "laden");
  const geladenEvent = laadTaak
    ? eventsVanTaak(state, laadTaak.id).find((e) => e.type === "geladen")
    : undefined;
  const order = state.orders[zending.orderId];
  const tarief = order ? state.tarieven[order.opdrachtgever] : undefined;

  return vrachtbriefVan({
    zending,
    vervoerder: VERVOERDER,
    plaatsOpmaak: zending.van.plaats,
    datumOpmaak: taken.length ? taken[0].geplandVan : null,
    geladenOp: geladenEvent?.tijdstip ?? null,
    aantalColli: zending.aantalColli ?? null,
    verpakkingswijze: zending.verpakkingswijze ?? "",
    vervoerskostenCenten: tariefVoorZending(zending, tarief).bedragCenten,
  });
}

function Vrachtbrief({ state, nu, zending, onVoorbehoud, onSluit }: {
  state: AppState;
  nu: string;
  zending: Zending;
  onVoorbehoud: (zendingId: string, soort: VoorbehoudSoort, omschrijving: string) => void;
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

  const gegevens = gegevensVan(state, zending);
  const controle = controleerVrachtbrief(gegevens);
  const voorbehouden = state.voorbehouden.filter((v) => v.zendingId === zending.id);
  const stand = pod ? termijnenVan(pod.tijdstip, voorbehouden, nu) : null;

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail vrachtbrief-paneel">
        <div className="detail-head geen-print">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
          <div className="eyebrow">{t("documenten.eyebrow")}</div>
          <h3 className="mono">{zending.barcode}</h3>
        </div>
        <div className="detail-body vrachtbrief">
          <div className="vb-printkop">
            <b>{VERVOERDER}</b>
            <span>{t("documenten.eyebrow")} · <span className="mono">{zending.barcode}</span></span>
          </div>

          {!controle.volledig && (
            <div className="vb-onvolledig geen-print">
              <b><Icoon naam="waarschuwing" maat={13} /> {t("documenten.onvolledigKop")}</b>
              <p>{t("documenten.onvolledigUitleg")}</p>
              <ul>
                {controle.ontbrekend.map((veld) => (
                  <li key={veld}>{t(`documenten.veld.${veld}`)}</li>
                ))}
              </ul>
            </div>
          )}

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
              <b>{VERVOERDER}</b>
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
            <div className="vb-blok">
              <span className="vb-label">{t("documenten.inontvangst")}</span>
              <b>{gegevens.plaatsInontvangstneming}</b>
              <span>
                {gegevens.datumInontvangstneming
                  ? `${datumKort(gegevens.datumInontvangstneming)} ${tijd(gegevens.datumInontvangstneming)}`
                  : t("documenten.nogNiet")}
              </span>
            </div>
            <div className="vb-blok">
              <span className="vb-label">{t("documenten.vervoerskosten")}</span>
              <b>
                {gegevens.vervoerskostenCenten === null
                  ? "—"
                  : formatteerGeld({ bedragCenten: gegevens.vervoerskostenCenten, valuta: "EUR" })}
              </b>
            </div>
          </div>

          <div className="vb-lading">
            <span className="vb-label">{t("documenten.lading")}</span>
            <p>{zending.omschrijving}</p>
            <span className="vb-specs">
              {zending.aantalColli
                ? `${zending.aantalColli} × ${zending.verpakkingswijze ?? "—"} · `
                : ""}
              {laadmeters(zending.laadmeters)} lm · {zending.gewichtKg.toLocaleString("nl-NL")} kg
            </span>
          </div>

          {stand && (
            <Termijnen
              stand={stand}
              voorbehouden={voorbehouden}
              onVoorbehoud={(soort, omschrijving) => onVoorbehoud(zending.id, soort, omschrijving)}
            />
          )}

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
          <button className="btn primary knop-met-icoon geen-print" onClick={() => window.print()}>
            <Icoon naam="document" maat={14} /> {t("documenten.print")}
          </button>
        </div>
      </aside>
    </div>
  );
}

/**
 * Termijnen uit art. 30 CMR. Een voorbehoud dat te laat komt is geen zwak
 * voorbehoud maar geen voorbehoud: bij vertraging is de 21-dagentermijn een
 * vervaltermijn. Daarom telt hij hier zichtbaar af.
 */
function Termijnen({ stand, voorbehouden, onVoorbehoud }: {
  stand: { zichtbaarGemeld: boolean; termijnen: TermijnStand[] };
  voorbehouden: readonly Voorbehoud[];
  onVoorbehoud: (soort: VoorbehoudSoort, omschrijving: string) => void;
}) {
  const [soort, setSoort] = useState<VoorbehoudSoort>("niet_zichtbaar");
  const [tekst, setTekst] = useState("");

  return (
    <div className="vb-voorbehoud">
      <h4>{t("documenten.voorbehoudKop")}</h4>
      <p className="events-note">{t("documenten.voorbehoudUitleg")}</p>

      <ul className="vb-termijnen">
        <li className={stand.zichtbaarGemeld ? "gemeld" : ""}>
          <span className="vt-naam">{t("documenten.soort.zichtbaar")}</span>
          <span className="vt-stand">
            {stand.zichtbaarGemeld ? t("documenten.aangetekend") : t("documenten.geenAantekening")}
          </span>
        </li>
        {stand.termijnen.map((termijn) => (
          <li key={termijn.soort} className={termijn.gemeld ? "gemeld" : termijn.verstreken ? "verstreken" : ""}>
            <span className="vt-naam">{t(`documenten.soort.${termijn.soort}`)}</span>
            <span className="vt-stand">
              {termijn.gemeld
                ? t("documenten.aangetekend")
                : termijn.verstreken
                  ? t("documenten.termijnVerstreken", { datum: datumKort(`${termijn.uiterlijk}T12:00:00Z`) })
                  : t("documenten.termijnOver", {
                      n: termijn.dagenOver,
                      datum: datumKort(`${termijn.uiterlijk}T12:00:00Z`),
                    })}
            </span>
          </li>
        ))}
      </ul>

      {voorbehouden.length > 0 && (
        <ul className="event-list vb-gemeld">
          {voorbehouden.map((v) => (
            <li key={v.id}>
              <div className="e-type">{t(`documenten.soort.${v.soort}`)} — {v.omschrijving}</div>
              <div className="e-meta">{datumKort(v.tijdstip)} {tijd(v.tijdstip)} · {v.wie}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="vb-nieuw geen-print">
        <select value={soort} onChange={(e) => setSoort(e.target.value as VoorbehoudSoort)}>
          {(["zichtbaar", "niet_zichtbaar", "vertraging"] as VoorbehoudSoort[]).map((s) => (
            <option key={s} value={s}>{t(`documenten.soort.${s}`)}</option>
          ))}
        </select>
        <input
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          placeholder={t("documenten.voorbehoudVoorbeeld")}
        />
        <button
          className="btn vb-leg-vast"
          disabled={tekst.trim() === ""}
          onClick={() => { onVoorbehoud(soort, tekst.trim()); setTekst(""); }}
        >
          {t("documenten.legVast")}
        </button>
      </div>
    </div>
  );
}
