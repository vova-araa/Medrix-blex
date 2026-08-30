import {
  dockLocatie, dockStatus, formatteerKenteken, laadlijsten, lokaleDatum,
  type DockEventType, type DockStatus, type Laadlijst,
} from "@sharzi/domain";
import { useMemo, useState } from "react";
import { dockEventsVanZending, takenVanRit, type AppState } from "../data/state";
import { t, TALEN, type Taal } from "../i18n";
import { laadmeters, tijd } from "../utils";
import { Icoon } from "./Icoon";
import { TAALCODE, Vlag } from "./Vlag";

const VAKKEN = ["Dok 1", "Dok 2", "A1", "A2", "B1", "B2", "C1", "C2", "Schadevak"];

interface Props {
  state: AppState;
  nu: string;
  onDockEvent: (zendingId: string, type: DockEventType, locatie?: string) => void;
  onZetOffline: (offline: boolean) => void;
  taal: Taal;
  onZetTaal: (taal: Taal) => void;
}

export function DockView({ state, nu, onDockEvent, onZetOffline, taal, onZetTaal }: Props) {
  const [invoer, setInvoer] = useState("");
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [vak, setVak] = useState("A1");
  const [fout, setFout] = useState<string | null>(null);

  // Op het depot: alle zendingen waarvoor dock-events bestaan.
  const depotZendingen = Object.values(state.zendingen).filter(
    (z) => dockEventsVanZending(state, z.id).length > 0
  );

  // Laadlijst per uitgaande rit: het werk op het depot is niet "scan wat je
  // ziet" maar "krijg deze auto vol en op tijd weg".
  const lijsten = useMemo(
    () => laadlijsten({
      // Alleen de auto's van vandaag: morgen laden doe je morgen, en anders
      // staat dezelfde chauffeur twee keer in de lijst.
      ritten: state.ritten.filter((r) => r.chauffeur !== "" && r.datum === lokaleDatum(nu)),
      zendingenVanRit: (ritId) => {
        const ids = new Set(
          takenVanRit(state, ritId)
            .map((tk) => tk.zendingId)
            .filter((id): id is string => !!id)
        );
        return [...ids].map((id) => state.zendingen[id]).filter(Boolean);
      },
      eventsVanZending: (zendingId) => dockEventsVanZending(state, zendingId),
    }).filter((lijst) => lijst.totaal > 0),
    [state, nu]
  );

  function scan(barcode: string) {
    const zending = Object.values(state.zendingen).find(
      (z) => z.barcode.toLowerCase() === barcode.trim().toLowerCase()
    );
    if (!zending) {
      setFout(t("dock.nietGevonden", { barcode: barcode.trim() }));
      return;
    }
    setFout(null);
    setGekozen(zending.id);
    setInvoer("");
    if (dockEventsVanZending(state, zending.id).length === 0) {
      onDockEvent(zending.id, "aangemeld");
    }
  }

  const actief = gekozen ? state.zendingen[gekozen] : null;
  const actiefEvents = actief ? dockEventsVanZending(state, actief.id) : [];
  const actiefStatus = actief ? dockStatus(actiefEvents) : null;

  const acties: Array<[DockEventType, string, boolean]> = actiefStatus
    ? [
        ["ingescand", t("dock.inscannen"), actiefStatus === "verwacht"],
        ["verplaatst", t("dock.verplaatsen"), actiefStatus === "op_depot" || actiefStatus === "schade"],
        ["uitgescand", t("dock.uitscannen"), actiefStatus === "op_depot" || actiefStatus === "schade"],
        ["schade_gemeld", t("dock.schade"), actiefStatus === "op_depot"],
      ]
    : [];

  return (
    <div className="driver-main">
      <div className="telefoon dock-toestel">
        <div className="tel-status">
          <span className="tel-tijd">{t("dock.depot")}</span>
          <span className="tel-merk">{t("dock.appNaam")}</span>
          <span className="tel-rechts">
            <span className="tel-signaal" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="tel-batterij" aria-hidden="true"><i /></span>
          </span>
        </div>
        <div className="tel-scherm">
          <div className="ph-card scan-kaart">
            <h4 className="zij-kop"><Icoon naam="portaal" maat={14} /> {t("dock.scanTitel")}</h4>
            <div className="scan-rij">
              <input
                className="scan-invoer mono"
                value={invoer}
                onChange={(e) => setInvoer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") scan(invoer); }}
                placeholder={t("dock.scanPlaceholder")}
                list="dock-barcodes"
              />
              <datalist id="dock-barcodes">
                {Object.values(state.zendingen).map((z) => <option key={z.id} value={z.barcode} />)}
              </datalist>
              <button className="btn primary" onClick={() => scan(invoer)}>{t("dock.scan")}</button>
            </div>
            {fout && <p className="scan-fout">{fout}</p>}
          </div>

          {actief && actiefStatus && (
            <div className="ph-card huidige dock-detail">
              <span className="nu-label">{t(`dock.status.${actiefStatus}`)}</span>
              <h3 className="mono">{actief.barcode}</h3>
              <p className="adres-sub">
                {actief.omschrijving} · {actief.van.plaats} → {actief.naar.plaats}
              </p>
              {dockLocatie(actiefEvents) && (
                <p className="dock-locatie">
                  <Icoon naam="locatie" maat={13} /> {t("dock.locatie", { vak: dockLocatie(actiefEvents)! })}
                </p>
              )}
              <label className="dock-vak">
                {t("dock.vakKiezen")}
                <select value={vak} onChange={(e) => setVak(e.target.value)}>
                  {VAKKEN.map((naam) => <option key={naam}>{naam}</option>)}
                </select>
              </label>
              <div className="acties">
                {acties.filter(([, , kan]) => kan).map(([type, label]) => (
                  <button
                    key={type}
                    className={`btn big knop-met-icoon ${type === "schade_gemeld" ? "probleem-knop" : type === "uitgescand" ? "secundair" : "primary"}`}
                    onClick={() => onDockEvent(actief.id, type, type === "uitgescand" ? undefined : vak)}
                  >
                    <Icoon naam={type === "schade_gemeld" ? "waarschuwing" : type === "uitgescand" ? "pijl" : type === "verplaatst" ? "emballage" : "check"} maat={16} />
                    {label}
                  </button>
                ))}
              </div>
              <ul className="event-list dock-log">
                {[...actiefEvents].reverse().slice(0, 4).map((e) => (
                  <li key={e.id}>
                    <div className="e-type">{t(`dock.event.${e.type}`)}{e.locatie ? ` — ${e.locatie}` : ""}</div>
                    <div className="e-meta">{tijd(e.tijdstip)} · {e.wie}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Laadlijsten lijsten={lijsten} onKies={(id) => { setGekozen(id); setFout(null); }} />

          <div className="ph-card ph-stops">
            <h4>{t("dock.opDepot")}</h4>
            {depotZendingen.length === 0 && <p className="kaart-kies">{t("dock.leeg")}</p>}
            <ul className="dock-lijst">
              {depotZendingen.map((z) => {
                const events = dockEventsVanZending(state, z.id);
                const status = dockStatus(events);
                const locatie = dockLocatie(events);
                return (
                  <li key={z.id}>
                    <button
                      className={`dock-rij${gekozen === z.id ? " actief" : ""}`}
                      onClick={() => { setGekozen(z.id); setFout(null); }}
                    >
                      <span className="mono dock-barcode">{z.barcode}</span>
                      <span className="dock-oms">{z.omschrijving}</span>
                      <span className={`dock-chip d-${status}`}>
                        {t(`dock.status.${status}`)}{locatie ? ` · ${locatie}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="ph-card sync-row">
            <span className={`sync-chip ${state.offline ? "offline" : "online"}`}>
              <span className="bol" />
              {state.offline ? t("dock.offline", { aantal: state.outbox }) : t("dock.online")}
            </span>
            <label className="offline-toggle">
              <input
                type="checkbox"
                checked={state.offline}
                onChange={(e) => onZetOffline(e.target.checked)}
              />
              {t("chauffeur.offlineToggle")}
            </label>
          </div>
          {state.offline && (
            <p className="dock-offline-noot">{t("dock.offlineNoot")}</p>
          )}

          <div className="ph-card taal-kaart">
            <span className="taal-label">{t("taal.kies")}</span>
            <div className="taal-vlaggen">
              {TALEN.map((optie) => (
                <button
                  key={optie.code}
                  className={`taal-vlag${optie.code === taal ? " actief" : ""}`}
                  onClick={() => onZetTaal(optie.code)}
                  aria-pressed={optie.code === taal}
                  aria-label={optie.naam}
                  title={optie.naam}
                >
                  <Vlag taal={optie.code} maat={34} />
                  <span>{TAALCODE[optie.code]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wat er nog op welke auto moet, met waar het staat. */
function Laadlijsten({ lijsten, onKies }: {
  lijsten: readonly Laadlijst[];
  onKies: (zendingId: string) => void;
}) {
  if (lijsten.length === 0) return null;
  return (
    <div className="ph-card laadlijst">
      <h4>{t("dock.laadlijst")}</h4>
      <p className="dock-uitleg">{t("dock.laadlijstUitleg")}</p>
      {lijsten.map((lijst) => (
        <div className="ll-rit" key={lijst.ritId}>
          <div className="ll-kop">
            <div>
              <b>{lijst.chauffeur}</b>
              <span className="ll-kenteken mono">
                {formatteerKenteken({ landcode: "NL", kenteken: lijst.kentekenGenormaliseerd })}
              </span>
              <span className="ll-ritnr mono">{lijst.ritId}</span>
            </div>
            <span className={`ll-stand${lijst.gereedVoorVertrek ? " gereed" : ""}`}>
              {lijst.gereedVoorVertrek
                ? t("dock.gereedVoorVertrek")
                : t("dock.nogTeLaden", { n: lijst.openstaand })}
            </span>
          </div>
          <div className="ll-balk">
            <div
              className="ll-vul"
              style={{ width: `${Math.round((lijst.geladen / lijst.totaal) * 100)}%` }}
            />
          </div>
          <ul className="ll-regels">
            {lijst.regels.map((regel) => (
              <li key={regel.zendingId}>
                <button className={`ll-regel s-${regel.stand}`} onClick={() => onKies(regel.zendingId)}>
                  <span className="mono ll-barcode">{regel.barcode}</span>
                  <span className="ll-oms">{regel.omschrijving} · {laadmeters(regel.laadmeters)} lm</span>
                  <span className="ll-plek">
                    {regel.locatie ?? t(`dock.stand.${regel.stand}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export type { DockStatus };
