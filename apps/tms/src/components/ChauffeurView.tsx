import { formatteerKenteken, type TaakEventType } from "@sharzi/domain";
import {
  huidigeTaak,
  ritVanChauffeur,
  statusVanTaak,
  takenVanRit,
  zendingVan,
  type AppState,
} from "../data/state";
import { statusLabel, t } from "../i18n";
import { initialen, tijd, venster } from "../utils";

interface Props {
  state: AppState;
  actieveChauffeur: string;
  onKiesChauffeur: (naam: string) => void;
  onRegistreer: (taakId: string, type: TaakEventType) => void;
  onZetOffline: (offline: boolean) => void;
}

export function ChauffeurView({
  state, actieveChauffeur, onKiesChauffeur, onRegistreer, onZetOffline,
}: Props) {
  const chauffeurs = state.ritten.map((r) => r.chauffeur).filter(Boolean);
  const rit = ritVanChauffeur(state, actieveChauffeur);
  const taken = rit ? takenVanRit(state, rit.id) : [];
  const klaar = taken.filter((tk) => statusVanTaak(state, tk.id) === "afgerond").length;
  const huidige = rit ? huidigeTaak(state, rit.id) : undefined;

  return (
    <div className="driver-main">
      <div className="phone">
        <div className="ph-card ph-head">
          <div className="driver-chips">
            {chauffeurs.map((naam) => (
              <button
                key={naam}
                className={naam === actieveChauffeur ? "active" : ""}
                onClick={() => onKiesChauffeur(naam)}
              >
                {naam}
              </button>
            ))}
          </div>
        </div>

        <div className="ph-card sync-row">
          <span className={`sync-chip ${state.offline ? "offline" : "online"}`}>
            <span className="bol" />
            {state.offline ? t("chauffeur.offline", { aantal: state.outbox }) : t("chauffeur.online")}
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

        {rit && (
          <div className="ph-card">
            <div className="ph-rit-head">
              <span className="avatar">{initialen(rit.chauffeur)}</span>
              <div className="groet">
                <b>{t("chauffeur.groet", { naam: rit.chauffeur.split(" ").pop() ?? rit.chauffeur })}</b>
                <span>
                  {rit.id} · {rit.voertuig.landcode}{" "}
                  {formatteerKenteken({ landcode: rit.voertuig.landcode, kenteken: rit.voertuig.kentekenGenormaliseerd })}
                  {" · "}{rit.voertuig.omschrijving}
                </span>
              </div>
            </div>
            <div className="ph-progress">
              <div className="pp-label">
                <span>{t("chauffeur.voortgang")}</span>
                <span>{t("chauffeur.taken", { klaar, totaal: taken.length })}</span>
              </div>
              <div className="pp-bar">
                <div className="pp-fill" style={{ width: `${taken.length ? Math.round((klaar / taken.length) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        )}

        {!rit || taken.length === 0 ? (
          <div className="ph-card">
            <div className="klaar-melding">
              <span className="emoji">🕐</span>
              <b>{t("chauffeur.geenRit.titel")}</b>
              <span>{t("chauffeur.geenRit.uitleg")}</span>
            </div>
          </div>
        ) : !huidige ? (
          <div className="ph-card">
            <div className="klaar-melding">
              <span className="emoji">🎉</span>
              <b>{t("chauffeur.klaar.titel")}</b>
              <span>{t("chauffeur.klaar.uitleg", { totaal: taken.length })}</span>
            </div>
          </div>
        ) : (
          <HuidigeTaakKaart
            state={state}
            taakId={huidige.id}
            onRegistreer={onRegistreer}
          />
        )}

        {taken.length > 0 && (
          <div className="ph-card ph-stops">
            <h4>{t("chauffeur.route")}</h4>
            <ul className="vstops">
              {taken.map((tk) => {
                const s = statusVanTaak(state, tk.id);
                const cls = s === "afgerond" ? "done" : s === "probleem" ? "probleem" : tk.id === huidige?.id ? "bezig" : "";
                return (
                  <li className={cls} key={tk.id}>
                    <span className="vdot" />
                    <div>
                      <div className="vs-titel">{t(`taak.${tk.soort}`)} · {tk.adres.plaats}</div>
                      <div className="vs-sub">
                        {tk.adres.naam}
                        {tk.adres.tijdvenster && <> · {venster(tk.adres.tijdvenster)}</>}
                      </div>
                    </div>
                    <span className="vs-tijd">{tijd(tk.geplandVan)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="nacht-note">{t("chauffeur.nachtNoot")}</p>
      </div>
    </div>
  );
}

function HuidigeTaakKaart({
  state, taakId, onRegistreer,
}: {
  state: AppState;
  taakId: string;
  onRegistreer: (taakId: string, type: TaakEventType) => void;
}) {
  const taak = state.taken.find((tk) => tk.id === taakId);
  if (!taak) return null;
  const s = statusVanTaak(state, taakId);
  const zending = zendingVan(state, taak);

  const acties: Array<[TaakEventType, string, string]> = {
    gepland: [["vertrokken", t("chauffeur.actie.vertrek"), "primary"]] as Array<[TaakEventType, string, string]>,
    onderweg: [["aangekomen", t("chauffeur.actie.aangekomen"), "primary"]] as Array<[TaakEventType, string, string]>,
    bezig: [
      [taak.soort === "laden" ? "geladen" : "gelost",
        taak.soort === "laden" ? t("chauffeur.actie.geladen") : t("chauffeur.actie.gelost"), "primary"],
      ["probleem_gemeld", t("chauffeur.actie.probleem"), "probleem-knop"],
    ] as Array<[TaakEventType, string, string]>,
    afgerond: [] as Array<[TaakEventType, string, string]>,
    probleem: [["aangekomen", t("chauffeur.actie.hervatten"), "secundair"]] as Array<[TaakEventType, string, string]>,
  }[s];

  return (
    <div className="ph-card huidige">
      <span className="nu-label">{t("chauffeur.nu", { status: statusLabel(s) })}</span>
      <h3>{t(`taak.${taak.soort}`)} — {taak.adres.plaats}</h3>
      <p className="adres-sub">
        {taak.adres.naam}
        {zending && <> · <span className="mono">{zending.barcode}</span></>}
      </p>
      {taak.adres.tijdvenster && (
        <span className="venster-groot">{t("chauffeur.venster", { venster: venster(taak.adres.tijdvenster) })}</span>
      )}
      <div className="acties">
        {acties.map(([type, label, cls]) => (
          <button key={type} className={`btn big ${cls}`} onClick={() => onRegistreer(taakId, type)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
