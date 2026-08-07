import {
  formatteerKenteken,
  urenTotalen,
  type EmballageSoort,
  type TaakEventType,
  type WerktijdEventType,
} from "@sharzi/domain";
import { useState } from "react";
import {
  adresInfoVan,
  huidigeTaak,
  ritVanChauffeur,
  statusVanTaak,
  takenVanRit,
  werktijdenVan,
  zendingVan,
  type AppState,
} from "../data/state";
import { statusLabel, t } from "../i18n";
import { initialen, tijd, venster } from "../utils";
import { Icoon, type IcoonNaam } from "./Icoon";

interface Props {
  state: AppState;
  nu: string;
  actieveChauffeur: string;
  onKiesChauffeur: (naam: string) => void;
  onRegistreer: (taakId: string, type: TaakEventType) => void;
  onWerktijdEvent: (type: WerktijdEventType) => void;
  onZetOffline: (offline: boolean) => void;
  onEmballage: (taakId: string, soort: EmballageSoort, geleverd: number, retour: number) => void;
}

export function ChauffeurView({
  state, nu, actieveChauffeur, onKiesChauffeur, onRegistreer, onWerktijdEvent, onZetOffline, onEmballage,
}: Props) {
  const chauffeurs = state.ritten.map((r) => r.chauffeur).filter(Boolean);
  const rit = ritVanChauffeur(state, actieveChauffeur);
  const taken = rit ? takenVanRit(state, rit.id) : [];
  const klaar = taken.filter((tk) => statusVanTaak(state, tk.id) === "afgerond").length;
  const huidige = rit ? huidigeTaak(state, rit.id) : undefined;

  return (
    <div className="driver-main">
      <div className="demo-kiezer">
        <span className="demo-label">{t("chauffeur.demoLabel")}</span>
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

      <div className="telefoon">
        <div className="tel-status">
          <span className="tel-tijd">{tijd(nu)}</span>
          <span className="tel-merk">{t("chauffeur.appNaam")}</span>
          <span className="tel-rechts">
            <span className="tel-signaal" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="tel-batterij" aria-hidden="true"><i /></span>
          </span>
        </div>

        <div className="tel-scherm">
          {rit && (
            <div className="ph-card app-kop">
              <div className="ph-rit-head">
                <span className="avatar avatar-accent">{initialen(rit.chauffeur)}</span>
                <div className="groet">
                  <b>{t("chauffeur.groet", { naam: rit.chauffeur.split(" ").pop() ?? rit.chauffeur })}</b>
                  <span>
                    {rit.id} · {rit.voertuig.landcode}{" "}
                    {formatteerKenteken({ landcode: rit.voertuig.landcode, kenteken: rit.voertuig.kentekenGenormaliseerd })}
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
                <span className="klaar-icoon wacht"><Icoon naam="klok" maat={26} /></span>
                <b>{t("chauffeur.geenRit.titel")}</b>
                <span>{t("chauffeur.geenRit.uitleg")}</span>
              </div>
            </div>
          ) : !huidige ? (
            <div className="ph-card">
              <div className="klaar-melding">
                <span className="klaar-icoon klaar"><Icoon naam="vlag" maat={26} /></span>
                <b>{t("chauffeur.klaar.titel")}</b>
                <span>{t("chauffeur.klaar.uitleg", { totaal: taken.length })}</span>
              </div>
            </div>
          ) : (
            <HuidigeTaakKaart state={state} taakId={huidige.id} onRegistreer={onRegistreer} onEmballage={onEmballage} />
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

          <KlokKaart state={state} nu={nu} chauffeur={actieveChauffeur} onWerktijdEvent={onWerktijdEvent} />

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

          <p className="nacht-note"><Icoon naam="maan" maat={12} /> {t("chauffeur.nachtNoot")}</p>
        </div>
      </div>
    </div>
  );
}

const urenTekst = (minuten: number) =>
  `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;

function KlokKaart({
  state, nu, chauffeur, onWerktijdEvent,
}: {
  state: AppState;
  nu: string;
  chauffeur: string;
  onWerktijdEvent: (type: WerktijdEventType) => void;
}) {
  const totalen = urenTotalen(werktijdenVan(state, chauffeur), nu);

  const knoppen: Array<[WerktijdEventType, string, IcoonNaam]> =
    totalen.actief === null
      ? [["ingeklokt", t("klok.inklokken"), "speel"]]
      : [
          ...(totalen.actief !== "rijden" ? [["rijden_gestart", t("klok.rijden"), "stuur"] as [WerktijdEventType, string, IcoonNaam]] : []),
          ...(totalen.actief !== "werk" ? [["werk_gestart", t("klok.werk"), "pakket"] as [WerktijdEventType, string, IcoonNaam]] : []),
          ...(totalen.actief !== "pauze" ? [["pauze_gestart", t("klok.pauze"), "koffie"] as [WerktijdEventType, string, IcoonNaam]] : []),
          ["uitgeklokt", t("klok.uitklokken"), "stopblok"],
        ];

  return (
    <div className="ph-card klok-kaart">
      <div className="klok-kop">
        <h4><Icoon naam="klok" maat={14} /> {t("klok.titel")}</h4>
        {totalen.actief ? (
          <span className={`klok-chip k-${totalen.actief}`}>{t(`uren.actief.${totalen.actief}`)}</span>
        ) : (
          <span className="klok-chip k-uit">{t("uren.actief.uit")}</span>
        )}
      </div>
      <div className="klok-totalen">
        <div><b>{urenTekst(totalen.dienstMinuten)}</b><span>{t("uren.dienst")}</span></div>
        <div><b>{urenTekst(totalen.rijMinuten)}</b><span>{t("uren.rijden")}</span></div>
        <div><b>{urenTekst(totalen.werkMinuten)}</b><span>{t("uren.werk")}</span></div>
        <div><b>{urenTekst(totalen.pauzeMinuten)}</b><span>{t("uren.pauze")}</span></div>
      </div>
      <div className="klok-knoppen">
        {knoppen.map(([type, label, icoon]) => (
          <button
            key={type}
            className={`btn knop-met-icoon${type === "ingeklokt" ? " primary" : type === "uitgeklokt" ? " secundair" : ""}`}
            onClick={() => onWerktijdEvent(type)}
          >
            <Icoon naam={icoon} maat={14} /> {label}
          </button>
        ))}
      </div>
      <p className="klok-noot">{t("klok.avgNoot")}</p>
    </div>
  );
}

function HuidigeTaakKaart({
  state, taakId, onRegistreer, onEmballage,
}: {
  state: AppState;
  taakId: string;
  onRegistreer: (taakId: string, type: TaakEventType) => void;
  onEmballage: (taakId: string, soort: EmballageSoort, geleverd: number, retour: number) => void;
}) {
  const taak = state.taken.find((tk) => tk.id === taakId);
  if (!taak) return null;
  const s = statusVanTaak(state, taakId);
  const zending = zendingVan(state, taak);
  const adresInfo = adresInfoVan(state, taak.adres);

  const acties: Array<[TaakEventType, string, string, IcoonNaam]> = {
    gepland: [["vertrokken", t("chauffeur.actie.vertrek"), "primary", "truck"]] as Array<[TaakEventType, string, string, IcoonNaam]>,
    onderweg: [["aangekomen", t("chauffeur.actie.aangekomen"), "primary", "locatie"]] as Array<[TaakEventType, string, string, IcoonNaam]>,
    bezig: [
      [taak.soort === "laden" ? "geladen" : "gelost",
        taak.soort === "laden" ? t("chauffeur.actie.geladen") : t("chauffeur.actie.gelost"),
        "primary", taak.soort === "laden" ? "check" : "pen"],
      ["probleem_gemeld", t("chauffeur.actie.probleem"), "probleem-knop", "waarschuwing"],
    ] as Array<[TaakEventType, string, string, IcoonNaam]>,
    afgerond: [] as Array<[TaakEventType, string, string, IcoonNaam]>,
    probleem: [["aangekomen", t("chauffeur.actie.hervatten"), "secundair", "speel"]] as Array<[TaakEventType, string, string, IcoonNaam]>,
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
        <span className="venster-groot">
          <Icoon naam="klok" maat={13} /> {t("chauffeur.venster", { venster: venster(taak.adres.tijdvenster) })}
        </span>
      )}
      {adresInfo && (adresInfo.instructies || adresInfo.fotos.length > 0) && (
        <div className="chauffeur-adres-info">
          <h4><Icoon naam="locatie" maat={13} /> {t("adres.chauffeurTitel")}</h4>
          {adresInfo.instructies && <p>{adresInfo.instructies}</p>}
          {adresInfo.fotos.length > 0 && (
            <div className="adres-fotos">
              {adresInfo.fotos.map((foto) => (
                <figure key={foto.id}>
                  <img src={foto.dataUrl} alt={foto.label} />
                  <figcaption>{foto.label}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
      {(taak.soort === "lossen" || taak.soort === "emballage_retour") && s === "bezig" && (
        <EmballageFormulier taakId={taakId} onEmballage={onEmballage} />
      )}
      <div className="acties">
        {acties.map(([type, label, cls, icoon]) => (
          <button key={type} className={`btn big knop-met-icoon ${cls}`} onClick={() => onRegistreer(taakId, type)}>
            <Icoon naam={icoon} maat={17} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const EMBALLAGE_SOORTEN: EmballageSoort[] = ["europallet", "rolcontainer", "fust", "kist"];

function EmballageFormulier({
  taakId, onEmballage,
}: {
  taakId: string;
  onEmballage: (taakId: string, soort: EmballageSoort, geleverd: number, retour: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [soort, setSoort] = useState<EmballageSoort>("europallet");
  const [geleverd, setGeleverd] = useState("0");
  const [retour, setRetour] = useState("0");

  if (!open) {
    return (
      <button className="btn knop-met-icoon emballage-toggle" onClick={() => setOpen(true)}>
        <Icoon naam="emballage" maat={14} /> {t("emballageForm.open")}
      </button>
    );
  }

  const kan = (Number(geleverd) || 0) > 0 || (Number(retour) || 0) > 0;

  return (
    <div className="emballage-form">
      <div className="emballage-velden">
        <label>{t("emballageForm.soort")}
          <select value={soort} onChange={(e) => setSoort(e.target.value as EmballageSoort)}>
            {EMBALLAGE_SOORTEN.map((naam) => (
              <option key={naam} value={naam}>{t(`emballage.soort.${naam}`)}</option>
            ))}
          </select>
        </label>
        <label>{t("emballage.geleverd")}
          <input type="number" min="0" value={geleverd} onChange={(e) => setGeleverd(e.target.value)} />
        </label>
        <label>{t("emballage.retour")}
          <input type="number" min="0" value={retour} onChange={(e) => setRetour(e.target.value)} />
        </label>
      </div>
      <div className="adres-acties">
        <button className="btn" onClick={() => setOpen(false)}>{t("klanten.annuleer")}</button>
        <button
          className="btn primary"
          disabled={!kan}
          onClick={() => {
            onEmballage(taakId, soort, Number(geleverd) || 0, Number(retour) || 0);
            setOpen(false); setGeleverd("0"); setRetour("0");
          }}
        >
          {t("emballageForm.vastleggen")}
        </button>
      </div>
    </div>
  );
}
