import { formatteerKenteken, type Rit } from "@sharzi/domain";
import { useState, type DragEvent } from "react";
import {
  gebruikteLaadmeters,
  statusVanRit,
  statusVanTaak,
  takenVanRit,
  type AppState,
} from "../data/state";
import { statusLabel, t } from "../i18n";
import { initialen, laadmeters, tijd } from "../utils";
import { TruckSvg } from "./TruckSvg";

interface Props {
  state: AppState;
  onPlanZending: (zendingId: string, ritId: string) => void;
  onSelecteerTaak: (taakId: string) => void;
}

export function BedrijfView({ state, onPlanZending, onSelecteerTaak }: Props) {
  const alleTaken = state.taken;
  const kpis = [
    { ico: "🚛", cls: "i-truck", n: String(state.ritten.filter((r) => statusVanRit(state, r.id) === "onderweg").length), label: t("kpi.rittenOnderweg") },
    { ico: "✅", cls: "i-ok", n: `${alleTaken.filter((tk) => statusVanTaak(state, tk.id) === "afgerond").length}/${alleTaken.length}`, label: t("kpi.takenAfgerond") },
    { ico: "⚠️", cls: "i-warn", n: String(alleTaken.filter((tk) => statusVanTaak(state, tk.id) === "probleem").length), label: t("kpi.problemen") },
    { ico: "📦", cls: "i-box", n: String(state.ongepland.length), label: t("kpi.ongepland") },
  ];

  return (
    <div>
      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi-tile" key={k.label}>
            <span className={`ico ${k.cls}`}>{k.ico}</span>
            <div><b>{k.n}</b><span>{k.label}</span></div>
          </div>
        ))}
      </div>
      <div className="bedrijf-main">
        <OngeplandLijst state={state} />
        <div className="fleet">
          {state.ritten.map((rit) => (
            <RitKaart
              key={rit.id}
              rit={rit}
              state={state}
              onPlanZending={onPlanZending}
              onSelecteerTaak={onSelecteerTaak}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OngeplandLijst({ state }: { state: AppState }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2>{t("ongepland.titel")} <span className="count">{state.ongepland.length}</span></h2>
        <p>{t("ongepland.hint")}</p>
      </div>
      <div className="sidebar-list">
        {state.ongepland.length === 0 && <div className="rc-leeg">{t("ongepland.leeg")}</div>}
        {state.ongepland.map((id) => {
          const z = state.zendingen[id];
          return (
            <div
              key={id}
              className="zending-card"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
            >
              <div className="barcode mono">{z.barcode}</div>
              <div className="route">{z.van.naam} → {z.naar.naam}</div>
              <div className="specs">{z.omschrijving} · {laadmeters(z.laadmeters)} lm</div>
              {z.naar.tijdvenster && (
                <div className="venster">{tijd(z.naar.tijdvenster.van)}–{tijd(z.naar.tijdvenster.tot)}</div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function RitKaart({
  rit, state, onPlanZending, onSelecteerTaak,
}: {
  rit: Rit;
  state: AppState;
  onPlanZending: (zendingId: string, ritId: string) => void;
  onSelecteerTaak: (taakId: string) => void;
}) {
  const [dropping, setDropping] = useState(false);
  const taken = takenVanRit(state, rit.id);
  const rs = statusVanRit(state, rit.id);
  const gebruikt = gebruikteLaadmeters(state, rit.id);
  const cap = rit.voertuig.capaciteitLaadmeters;
  const pct = Math.min(100, Math.round((gebruikt / cap) * 100));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    onPlanZending(e.dataTransfer.getData("text/plain"), rit.id);
  };

  return (
    <div
      className={`rit-card s-${rs}${dropping ? " dropping" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <div className="rc-head">
        <span className="avatar">{initialen(rit.chauffeur || t("vloot.beschikbaar"))}</span>
        <div className="rc-who">
          <div className="naam">
            {rit.chauffeur || t("vloot.beschikbaar")}
            {rit.charter && <span className="voertuigtype"> · {t("vloot.charter")}</span>}
          </div>
          <div className="ritnr">{rit.id}</div>
        </div>
        <span className={`status-chip s-${rs}`}>{statusLabel(rs)}</span>
      </div>
      <div className="rc-truck">
        <TruckSvg />
        <div className="rc-truck-meta">
          <span className="plate">
            <span className="eu">{rit.voertuig.landcode}</span>
            <span className="nr">{formatteerKenteken({ landcode: rit.voertuig.landcode, kenteken: rit.voertuig.kentekenGenormaliseerd })}</span>
          </span>
          <span className="voertuigtype">{rit.voertuig.omschrijving}</span>
          <div className="laadmeter">
            <div className="lm-bar">
              <div className={`lm-fill${pct >= 95 ? " vol" : ""}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="lm-label">
              {t("vloot.laadmeter", { gebruikt: laadmeters(gebruikt), cap: laadmeters(cap) })}
            </span>
          </div>
        </div>
      </div>
      {taken.length === 0 ? (
        <div className="rc-leeg">{t("vloot.vrijVoertuig")}</div>
      ) : (
        <div className="rc-route">
          <div className="stops">
            {taken.map((taakItem) => {
              const s = statusVanTaak(state, taakItem.id);
              const cls = s === "afgerond" ? "done" : s === "probleem" ? "probleem" : s === "gepland" ? "" : "bezig";
              return (
                <div className={`stop ${cls}`} key={taakItem.id}>
                  <button
                    className="stop-btn"
                    onClick={() => onSelecteerTaak(taakItem.id)}
                    title={`${t(`taak.${taakItem.soort}`)} — ${taakItem.adres.naam}`}
                  >
                    <span className="dot" />
                    <span className="plaats">{taakItem.adres.plaats}</span>
                    <span className="tijd">{tijd(taakItem.geplandVan)}</span>
                    <span className="soort-mini">{t(`taak.${taakItem.soort}`)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
