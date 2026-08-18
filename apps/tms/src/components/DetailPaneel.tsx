import { formatteerKenteken, type TaakEventType } from "@sharzi/domain";
import { useState, type ChangeEvent } from "react";
import { adresSleutel, type AdresFoto } from "../data/bron";
import { leertijdVanAdres } from "../data/leertijden";
import { adresInfoVan, eventsVanTaak, statusVanTaak, zendingVan, type AppState } from "../data/state";
import { statusLabel, t } from "../i18n";
import { tijd, venster } from "../utils";
import { Icoon } from "./Icoon";

interface Props {
  state: AppState;
  taakId: string;
  onSluit: () => void;
  onSimuleer: (taakId: string, type: TaakEventType) => void;
  onZetInstructies: (sleutel: string, instructies: string) => void;
  onVoegFotoToe: (sleutel: string, foto: AdresFoto) => void;
}

export function DetailPaneel({
  state, taakId, onSluit, onSimuleer, onZetInstructies, onVoegFotoToe,
}: Props) {
  const taak = state.taken.find((tk) => tk.id === taakId);
  const rit = taak && state.ritten.find((r) => r.id === taak.ritId);
  if (!taak || !rit) return null;

  const s = statusVanTaak(state, taakId);
  const events = [...eventsVanTaak(state, taakId)].reverse();
  const zending = zendingVan(state, taak);
  const leertijd = leertijdVanAdres(state, taak.adres);

  const volgende: TaakEventType[] = ({
    gepland: ["vertrokken"],
    onderweg: ["aangekomen"],
    bezig: [taak.soort === "laden" ? "geladen" : "gelost", "probleem_gemeld"],
    afgerond: [],
    probleem: ["aangekomen"],
    vervallen: [],
  } as Record<string, TaakEventType[]>)[s];

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
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
            {leertijd && (
              <>
                <dt>{t("detail.leertijd")}</dt>
                <dd>{t("detail.leertijdWaarde", { minuten: leertijd.gemiddeldeMinuten, metingen: leertijd.metingen })}</dd>
              </>
            )}
          </dl>

          <AdresInfoBewerker
            state={state}
            taakId={taakId}
            onZetInstructies={onZetInstructies}
            onVoegFotoToe={onVoegFotoToe}
          />

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

function AdresInfoBewerker({
  state, taakId, onZetInstructies, onVoegFotoToe,
}: {
  state: AppState;
  taakId: string;
  onZetInstructies: (sleutel: string, instructies: string) => void;
  onVoegFotoToe: (sleutel: string, foto: AdresFoto) => void;
}) {
  const taak = state.taken.find((tk) => tk.id === taakId)!;
  const sleutel = adresSleutel(taak.adres);
  const info = adresInfoVan(state, taak.adres);
  const [concept, setConcept] = useState(info?.instructies ?? "");

  function fotoGekozen(e: ChangeEvent<HTMLInputElement>) {
    const bestand = e.target.files?.[0];
    if (!bestand) return;
    const lezer = new FileReader();
    lezer.onload = () => {
      onVoegFotoToe(sleutel, {
        id: crypto.randomUUID(),
        label: bestand.name,
        dataUrl: String(lezer.result),
      });
    };
    lezer.readAsDataURL(bestand);
    e.target.value = "";
  }

  return (
    <div className="adres-info">
      <h4>{t("adres.titel")}</h4>
      <p className="events-note">{t("adres.noot")}</p>
      <textarea
        className="adres-instructies"
        value={concept}
        placeholder={t("adres.placeholder")}
        onChange={(e) => setConcept(e.target.value)}
      />
      <div className="adres-acties">
        <button
          className="btn"
          disabled={concept === (info?.instructies ?? "")}
          onClick={() => onZetInstructies(sleutel, concept)}
        >
          {t("adres.opslaan")}
        </button>
        <label className="btn adres-upload knop-met-icoon">
          <Icoon naam="camera" maat={14} /> {t("adres.fotoToevoegen")}
          <input type="file" accept="image/*" onChange={fotoGekozen} hidden />
        </label>
      </div>
      {info && info.fotos.length > 0 && (
        <div className="adres-fotos">
          {info.fotos.map((foto) => (
            <figure key={foto.id}>
              <img src={foto.dataUrl} alt={foto.label} />
              <figcaption>{foto.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
