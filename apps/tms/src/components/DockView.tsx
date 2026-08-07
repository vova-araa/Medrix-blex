import { dockLocatie, dockStatus, type DockEventType, type DockStatus } from "@sharzi/domain";
import { useState } from "react";
import { dockEventsVanZending, type AppState } from "../data/state";
import { t } from "../i18n";
import { tijd } from "../utils";
import { Icoon } from "./Icoon";

const VAKKEN = ["Dok 1", "Dok 2", "A1", "A2", "B1", "B2", "C1", "C2", "Schadevak"];

interface Props {
  state: AppState;
  onDockEvent: (zendingId: string, type: DockEventType, locatie?: string) => void;
}

export function DockView({ state, onDockEvent }: Props) {
  const [invoer, setInvoer] = useState("");
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [vak, setVak] = useState("A1");
  const [fout, setFout] = useState<string | null>(null);

  // Op het depot: alle zendingen waarvoor dock-events bestaan.
  const depotZendingen = Object.values(state.zendingen).filter(
    (z) => dockEventsVanZending(state, z.id).length > 0
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
        </div>
      </div>
    </div>
  );
}

export type { DockStatus };
