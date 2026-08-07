import { formatteerKenteken, type TaakEventType } from "@sharzi/domain";
import { eventsVanTaak, statusVanTaak, zendingVan, type AppState } from "../data/state";
import { statusLabel, t } from "../i18n";
import { tijd, venster } from "../utils";

interface Props {
  state: AppState;
  taakId: string;
  onSluit: () => void;
  onSimuleer: (taakId: string, type: TaakEventType) => void;
}

export function DetailPaneel({ state, taakId, onSluit, onSimuleer }: Props) {
  const taak = state.taken.find((tk) => tk.id === taakId);
  if (!taak) return null;
  const rit = state.ritten.find((r) => r.id === taak.ritId);
  if (!rit) return null;

  const s = statusVanTaak(state, taakId);
  const events = [...eventsVanTaak(state, taakId)].reverse();
  const zending = zendingVan(state, taak);

  const volgende: TaakEventType[] = {
    gepland: ["vertrokken" as const],
    onderweg: ["aangekomen" as const],
    bezig: [(taak.soort === "laden" ? "geladen" : "gelost") as TaakEventType, "probleem_gemeld" as const],
    afgerond: [] as TaakEventType[],
    probleem: ["aangekomen" as const],
  }[s];

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>✕</button>
          <div className="eyebrow">{rit.id} · {rit.chauffeur || t("vloot.beschikbaar")}</div>
          <h3>{t(`taak.${taak.soort}`)} — {taak.adres.naam}</h3>
          <span className={`status-chip s-${s === "bezig" || s === "onderweg" ? "onderweg" : s}`}>{statusLabel(s)}</span>
        </div>
        <div className="detail-body">
          <dl className="kv">
            <dt>{t("detail.gepland")}</dt>
            <dd>{tijd(taak.geplandVan)}–{tijd(taak.geplandTot)}</dd>
            {taak.adres.tijdvenster && (
              <>
                <dt>{t("detail.tijdvenster")}</dt>
                <dd>{venster(taak.adres.tijdvenster)}</dd>
              </>
            )}
            {zending && (
              <>
                <dt>{t("detail.zending")}</dt>
                <dd className="mono">{zending.barcode}</dd>
              </>
            )}
            <dt>{t("detail.voertuig")}</dt>
            <dd>
              {rit.voertuig.landcode}{" "}
              {formatteerKenteken({ landcode: rit.voertuig.landcode, kenteken: rit.voertuig.kentekenGenormaliseerd })}
              {" · "}{rit.voertuig.omschrijving}
            </dd>
          </dl>
          <div className="events">
            <h4>{t("detail.eventlog")}</h4>
            <p className="events-note">{t("detail.eventlogNoot")}</p>
            <ul className="event-list">
              {events.map((e) => (
                <li key={e.id}>
                  <div className="e-type">{t(`event.${e.type}`)}</div>
                  <div className="e-meta">{tijd(e.tijdstip)} · {e.wie} · {e.apparaat}</div>
                </li>
              ))}
            </ul>
            <div className="event-actions">
              {volgende.map((type) => (
                <button className="btn" key={type} onClick={() => onSimuleer(taakId, type)}>
                  {t("detail.simuleer", { event: t(`event.${type}`) })}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
