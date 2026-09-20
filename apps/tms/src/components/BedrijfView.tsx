import { formatteerKenteken, lokaleDatum, type HerplanUitkomst, type Rit } from "@sharzi/domain";
import { useState, type DragEvent } from "react";
import {
  gebruikteLaadmeters,
  statusVanRit,
  statusVanTaak,
  takenVanRit,
  type AppState,
} from "../data/state";
import { statusLabel, t } from "../i18n";
import { ritEta } from "../kaart/simulatie";
import { datumDagKort, datumLabel, initialen, laadmeters, tijd } from "../utils";
import { Icoon, type IcoonNaam } from "./Icoon";
import { Tijdbalk } from "./Tijdbalk";
import { TruckSvg } from "./TruckSvg";

interface Props {
  state: AppState;
  nu: string;
  onPlanZending: (zendingId: string, ritId: string) => void;
  onSelecteerTaak: (taakId: string) => void;
  onAutoPlan: () => void;
  onVerplaatsStop: (ritId: string, taakId: string, richting: "omhoog" | "omlaag") => void;
  planDatum: string;
  onZetPlanDatum: (datum: string) => void;
  onOpenDossier: (ritId: string) => void;
  onBeoordeelSleep: (taakId: string, ritId: string, startIso: string) => HerplanUitkomst | null;
  onSleep: (taakId: string, ritId: string, startIso: string) => void;
}

type Weergave = "kaarten" | "tijdbalk";

export function BedrijfView({
  state, nu, onPlanZending, onSelecteerTaak, onAutoPlan, onVerplaatsStop, planDatum,
  onZetPlanDatum, onOpenDossier, onBeoordeelSleep, onSleep,
}: Props) {
  // Twee manieren om naar dezelfde dag te kijken: kaarten om te slepen,
  // tijdbalk om te zien waar het knelt en waar nog ruimte zit.
  const [weergave, setWeergave] = useState<Weergave>("kaarten");
  // Het planbord toont één dag tegelijk. Ritten van andere dagen blijven in de state staan;
  // alleen de weergave is gefilterd.
  const dagRitten = state.ritten.filter((r) => r.datum === planDatum);
  const dagRitIds = new Set(dagRitten.map((r) => r.id));
  const alleTaken = state.taken.filter((tk) => dagRitIds.has(tk.ritId));
  const kpis: Array<{ ico: IcoonNaam; cls: string; n: string; label: string }> = [
    { ico: "truck", cls: "i-truck", n: String(dagRitten.filter((r) => statusVanRit(state, r.id) === "onderweg").length), label: t("kpi.rittenOnderweg") },
    { ico: "check", cls: "i-ok", n: `${alleTaken.filter((tk) => statusVanTaak(state, tk.id) === "afgerond").length}/${alleTaken.length}`, label: t("kpi.takenAfgerond") },
    { ico: "waarschuwing", cls: "i-warn", n: String(alleTaken.filter((tk) => statusVanTaak(state, tk.id) === "probleem").length), label: t("kpi.problemen") },
    { ico: "pakket", cls: "i-box", n: String(state.ongepland.length), label: t("kpi.ongepland") },
  ];

  return (
    <div>
      <Dagkiezer
        state={state}
        planDatum={planDatum}
        aantalRitten={dagRitten.length}
        onZetPlanDatum={onZetPlanDatum}
        weergave={weergave}
        onZetWeergave={setWeergave}
      />
      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi-tile" key={k.label}>
            <span className={`ico ${k.cls}`}><Icoon naam={k.ico} maat={18} /></span>
            <div><b>{k.n}</b><span>{k.label}</span></div>
          </div>
        ))}
      </div>
      {weergave === "tijdbalk" && (
        <Tijdbalk
          state={state}
          nu={nu}
          datum={planDatum}
          onSelecteerTaak={onSelecteerTaak}
          onOpenDossier={onOpenDossier}
          onBeoordeelSleep={onBeoordeelSleep}
          onSleep={onSleep}
        />
      )}

      <div className="bedrijf-main">
        <OngeplandLijst state={state} planDatum={planDatum} onAutoPlan={onAutoPlan} />
        <div className="fleet">
          {dagRitten.length === 0 && (
            <div className="fleet-leeg">{t("planbord.geenRitten")}</div>
          )}
          {weergave === "kaarten" && dagRitten.map((rit) => (
            <RitKaart
              key={rit.id}
              rit={rit}
              state={state}
              nu={nu}
              onPlanZending={onPlanZending}
              onSelecteerTaak={onSelecteerTaak}
              onVerplaatsStop={onVerplaatsStop}
              onOpenDossier={onOpenDossier}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function verschuifDatum(datum: string, dagen: number): string {
  const [j, m, d] = datum.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, d + dagen)).toISOString().slice(0, 10);
}

function Dagkiezer({
  state, planDatum, aantalRitten, onZetPlanDatum, weergave, onZetWeergave,
}: {
  state: AppState;
  planDatum: string;
  aantalRitten: number;
  onZetPlanDatum: (datum: string) => void;
  weergave: Weergave;
  onZetWeergave: (weergave: Weergave) => void;
}) {
  const datums = [...new Set(state.ritten.map((r) => r.datum))].sort();
  const eerste = datums[0] ?? planDatum;
  const laatste = datums[datums.length - 1] ?? planDatum;
  const vorige = verschuifDatum(planDatum, -1);
  const volgende = verschuifDatum(planDatum, 1);

  return (
    <div className="dagkiezer">
      <button
        className="btn dagkiezer-pijl"
        disabled={planDatum <= eerste}
        aria-label={t("planbord.vorige")}
        onClick={() => onZetPlanDatum(vorige)}
      >
        <Icoon naam="chevron-links" maat={14} />
      </button>
      <div className="dagkiezer-dag">
        <b>{datumLabel(planDatum)}</b>
        <span>{t("planbord.ritten", { n: String(aantalRitten) })}</span>
      </div>
      <button
        className="btn dagkiezer-pijl"
        disabled={planDatum >= laatste}
        aria-label={t("planbord.volgende")}
        onClick={() => onZetPlanDatum(volgende)}
      >
        <Icoon naam="chevron-rechts" maat={14} />
      </button>
      <div className="weergave-schakel">
        {(["kaarten", "tijdbalk"] as Weergave[]).map((w) => (
          <button
            key={w}
            className={`weergave-knop${w === weergave ? " actief" : ""}`}
            onClick={() => onZetWeergave(w)}
            aria-pressed={w === weergave}
          >
            <Icoon naam={w === "kaarten" ? "planbord" : "rapportage"} maat={13} />
            {t(`planbord.weergave.${w}`)}
          </button>
        ))}
      </div>
      <div className="dagkiezer-tabs">
        {datums.map((d) => (
          <button
            key={d}
            className={`dagkiezer-tab${d === planDatum ? " actief" : ""}`}
            onClick={() => onZetPlanDatum(d)}
          >
            {datumDagKort(d)}
          </button>
        ))}
      </div>
    </div>
  );
}

function OngeplandLijst({
  state, planDatum, onAutoPlan,
}: { state: AppState; planDatum: string; onAutoPlan: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2>{t("ongepland.titel")} <span className="count">{state.ongepland.length}</span></h2>
        <p>{t("ongepland.hint")}</p>
        <button
          className="btn primary knop-met-icoon autoplan-knop"
          disabled={state.ongepland.length === 0}
          onClick={onAutoPlan}
        >
          <Icoon naam="assistent" maat={14} /> {t("autoplan.knop")}
        </button>
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
              {z.naar.tijdvenster && (() => {
                // Op een planbord van meerdere dagen is een venster zonder dag
                // misleidend: toon de dag zodra hij afwijkt van de gekozen dag.
                const dagVanVenster = lokaleDatum(z.naar.tijdvenster.van);
                const anders = dagVanVenster !== planDatum;
                return (
                  <div className={`venster${anders ? " ander-dag" : ""}`}>
                    {anders && <>{datumDagKort(z.naar.tijdvenster.van)} · </>}
                    {tijd(z.naar.tijdvenster.van)}–{tijd(z.naar.tijdvenster.tot)}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function RitKaart({
  rit, state, nu, onPlanZending, onSelecteerTaak, onVerplaatsStop, onOpenDossier,
}: {
  rit: Rit;
  state: AppState;
  nu: string;
  onPlanZending: (zendingId: string, ritId: string) => void;
  onSelecteerTaak: (taakId: string) => void;
  onVerplaatsStop: (ritId: string, taakId: string, richting: "omhoog" | "omlaag") => void;
  onOpenDossier: (ritId: string) => void;
}) {
  const [dropping, setDropping] = useState(false);
  const taken = takenVanRit(state, rit.id);
  const rs = statusVanRit(state, rit.id);
  const eta = ritEta(state, rit.id, nu);
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
          <button
            className="ritnr rc-dossier"
            onClick={() => onOpenDossier(rit.id)}
            title={t("dossier.open")}
          >
            {rit.id}
          </button>
        </div>
        {eta && eta.vertragingMin > 0 && (
          <span className={`eta-chip${eta.naVenster ? " te-laat" : ""}`}>
            {t("kaart.etaChip", { tijd: tijd(eta.aankomstIso), minuten: eta.vertragingMin })}
          </span>
        )}
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
            {taken.map((taakItem, index) => {
              const s = statusVanTaak(state, taakItem.id);
              const vast = s === "afgerond" || s === "vervallen";
              const cls = s === "afgerond" ? "done" : s === "vervallen" ? "vervallen" : s === "probleem" ? "probleem" : s === "gepland" ? "" : "bezig";
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
                  {!vast && (
                    <div className="stop-verplaats">
                      <button
                        className="stop-pijl" disabled={index === 0}
                        aria-label={t("route.omhoog")} title={t("route.omhoog")}
                        onClick={() => onVerplaatsStop(rit.id, taakItem.id, "omhoog")}
                      >↑</button>
                      <button
                        className="stop-pijl" disabled={index === taken.length - 1}
                        aria-label={t("route.omlaag")} title={t("route.omlaag")}
                        onClick={() => onVerplaatsStop(rit.id, taakItem.id, "omlaag")}
                      >↓</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
