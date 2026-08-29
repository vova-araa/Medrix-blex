import {
  RIJTIJD_REGELS,
  formatteerKenteken,
  urenTotalen,
  type EmballageSoort,
  type TaakEventType,
  type WerktijdEventType,
} from "@sharzi/domain";
import { useState } from "react";
import type { CmrSoort } from "../data/bron";
import {
  actieveTakenVanRit,
  adresInfoVan,
  cmrsVanTaak,
  huidigeTaak,
  rijtijdVan,
  ritVanChauffeur,
  statusVanTaak,
  takenVanRit,
  werktijdenVan,
  zendingVan,
  type AppState,
} from "../data/state";
import { statusLabel, t, TALEN, type Taal } from "../i18n";
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
  onCmr: (taakId: string, soort: CmrSoort, nummer: string, lading?: string) => void;
  onNulCmr: (taakId: string) => void;
  onZetTrailer: (ritId: string, kenteken: string) => void;
  onRitKm: (ritId: string, veld: "start" | "eind", waarde: number) => void;
  taal: Taal;
  onZetTaal: (taal: Taal) => void;
}

export function ChauffeurView({
  state, nu, actieveChauffeur, onKiesChauffeur, onRegistreer, onWerktijdEvent,
  onZetOffline, onEmballage, onCmr, onNulCmr, onZetTrailer, onRitKm, taal, onZetTaal,
}: Props) {
  const [verbergGedane, setVerbergGedane] = useState(false);
  const chauffeurs = state.ritten.map((r) => r.chauffeur).filter(Boolean);
  const rit = ritVanChauffeur(state, actieveChauffeur);
  const alleTaken = rit ? takenVanRit(state, rit.id) : [];
  const actieveTaken = rit ? actieveTakenVanRit(state, rit.id) : [];
  const klaar = actieveTaken.filter((tk) => statusVanTaak(state, tk.id) === "afgerond").length;
  const huidige = rit ? huidigeTaak(state, rit.id) : undefined;
  const km = rit ? state.ritKm[rit.id] : undefined;
  const trailerKenteken = rit ? state.trailerVanRit[rit.id] : undefined;

  const routeTaken = verbergGedane
    ? alleTaken.filter((tk) => {
        const s = statusVanTaak(state, tk.id);
        return s !== "afgerond" && s !== "vervallen";
      })
    : alleTaken;

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
                    {trailerKenteken && (
                      <> + {formatteerKenteken({ landcode: "NL", kenteken: trailerKenteken })}</>
                    )}
                  </span>
                </div>
              </div>
              <div className="ph-progress">
                <div className="pp-label">
                  <span>{t("chauffeur.voortgang")}</span>
                  <span>{t("chauffeur.taken", { klaar, totaal: actieveTaken.length })}</span>
                </div>
                <div className="pp-bar">
                  <div className="pp-fill" style={{ width: `${actieveTaken.length ? Math.round((klaar / actieveTaken.length) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          )}

          {rit && alleTaken.length > 0 && km?.start === undefined && (
            <KmKaart
              titel={t("km.startTitel")}
              uitleg={t("km.startUitleg")}
              onOpslaan={(waarde) => onRitKm(rit.id, "start", waarde)}
            />
          )}

          {!rit || alleTaken.length === 0 ? (
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
                <span>{t("chauffeur.klaar.uitleg", { totaal: actieveTaken.length })}</span>
              </div>
              {km?.start !== undefined && km?.eind === undefined && (
                <KmKaart
                  titel={t("km.eindTitel")}
                  uitleg={t("km.eindUitleg", { start: km.start.toLocaleString("nl-NL") })}
                  minimum={km.start}
                  onOpslaan={(waarde) => onRitKm(rit.id, "eind", waarde)}
                />
              )}
              {km?.eind !== undefined && km?.start !== undefined && (
                <p className="km-klaar">
                  {t("km.geregistreerd", {
                    start: km.start.toLocaleString("nl-NL"),
                    eind: km.eind.toLocaleString("nl-NL"),
                    gereden: (km.eind - km.start).toLocaleString("nl-NL"),
                  })}
                </p>
              )}
            </div>
          ) : (
            <HuidigeTaakKaart
              state={state}
              taakId={huidige.id}
              kmStartOntbreekt={km?.start === undefined}
              onRegistreer={onRegistreer}
              onEmballage={onEmballage}
              onCmr={onCmr}
              onNulCmr={onNulCmr}
              onZetTrailer={onZetTrailer}
            />
          )}

          {alleTaken.length > 0 && (
            <div className="ph-card ph-stops">
              <div className="stops-kop">
                <h4>{t("chauffeur.route")}</h4>
                <label className="offline-toggle">
                  <input
                    type="checkbox"
                    checked={verbergGedane}
                    onChange={(e) => setVerbergGedane(e.target.checked)}
                  />
                  {t("chauffeur.verbergGedane")}
                </label>
              </div>
              <ul className="vstops">
                {routeTaken.map((tk) => {
                  const s = statusVanTaak(state, tk.id);
                  const cls = s === "afgerond" ? "done" : s === "vervallen" ? "vervallen" : s === "probleem" ? "probleem" : tk.id === huidige?.id ? "bezig" : "";
                  return (
                    <li className={cls} key={tk.id}>
                      <span className="vdot" />
                      <div>
                        <div className="vs-titel">
                          {t(`taak.${tk.soort}`)} · {tk.adres.plaats}
                          {s === "vervallen" && <span className="vs-vervallen"> — {t("cmr.vervallenLabel")}</span>}
                        </div>
                        <div className="vs-sub">
                          {tk.adres.naam}
                          {tk.adres.tijdvenster && <> · {venster(tk.adres.tijdvenster)}</>}
                        </div>
                      </div>
                      <span className="vs-tijd">{tijd(tk.geplandVan)}</span>
                    </li>
                  );
                })}
                {routeTaken.length === 0 && (
                  <li className="vstops-leeg">{t("chauffeur.allesVerborgen")}</li>
                )}
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

          {state.offline && state.outbox > 0 && (
            <div className="ph-card outbox-kaart">
              <h4><Icoon naam="pakket" maat={13} /> {t("outbox.titel")} ({state.outbox})</h4>
              <p className="klok-noot">{t("outbox.noot")}</p>
            </div>
          )}

          <TaalKiezer taal={taal} onZetTaal={onZetTaal} />

          <p className="nacht-note"><Icoon naam="maan" maat={12} /> {t("chauffeur.nachtNoot")}</p>
        </div>
      </div>
    </div>
  );
}

function KmKaart({
  titel, uitleg, minimum, onOpslaan,
}: {
  titel: string;
  uitleg: string;
  minimum?: number;
  onOpslaan: (waarde: number) => void;
}) {
  const [waarde, setWaarde] = useState("");
  const getal = Number(waarde);
  const geldig = waarde !== "" && Number.isFinite(getal) && getal > 0 && (minimum === undefined || getal >= minimum);

  return (
    <div className="ph-card km-kaart">
      <h4><Icoon naam="wagenpark" maat={14} /> {titel}</h4>
      <p className="km-uitleg">{uitleg}</p>
      <div className="km-rij">
        <input
          type="number"
          inputMode="numeric"
          min={minimum ?? 0}
          placeholder={t("km.placeholder")}
          value={waarde}
          onChange={(e) => setWaarde(e.target.value)}
        />
        <button className="btn primary" disabled={!geldig} onClick={() => onOpslaan(getal)}>
          {t("km.opslaan")}
        </button>
      </div>
    </div>
  );
}

const urenTekst = (minuten: number) =>
  `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;

/**
 * Taalwissel voor de chauffeur. NL is volledig; EN, PL en RO dekken de
 * chauffeursapp en vallen per sleutel terug op Nederlands als iets ontbreekt.
 */
function TaalKiezer({ taal, onZetTaal }: { taal: Taal; onZetTaal: (taal: Taal) => void }) {
  return (
    <div className="ph-card taal-kaart">
      <span className="taal-label">{t("taal.kies")}</span>
      <div className="taal-chips">
        {TALEN.map((optie) => (
          <button
            key={optie.code}
            className={optie.code === taal ? "actief" : ""}
            onClick={() => onZetTaal(optie.code)}
          >
            {optie.naam}
          </button>
        ))}
      </div>
    </div>
  );
}

function KlokKaart({
  state, nu, chauffeur, onWerktijdEvent,
}: {
  state: AppState;
  nu: string;
  chauffeur: string;
  onWerktijdEvent: (type: WerktijdEventType) => void;
}) {
  const totalen = urenTotalen(werktijdenVan(state, chauffeur), nu);
  const rijtijd = rijtijdVan(state, chauffeur, nu);

  const knoppen: Array<[WerktijdEventType, string, IcoonNaam]> =
    totalen.actief === null
      ? [["ingeklokt", t("klok.inklokken"), "speel"]]
      : [
          ...(totalen.actief !== "rijden" ? [["rijden_gestart", t("klok.rijden"), "stuur"] as [WerktijdEventType, string, IcoonNaam]] : []),
          ...(totalen.actief !== "werk" ? [["werk_gestart", t("klok.werk"), "pakket"] as [WerktijdEventType, string, IcoonNaam]] : []),
          ...(totalen.actief !== "beschikbaar" ? [["beschikbaar_gestart", t("klok.beschikbaar"), "timer"] as [WerktijdEventType, string, IcoonNaam]] : []),
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
        <div><b>{urenTekst(totalen.beschikbaarMinuten)}</b><span>{t("uren.beschikbaar")}</span></div>
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
      <p className={`rijtijd-regel${rijtijd.pauzeNodig ? " kritiek" : rijtijd.blokResterendMinuten <= 30 ? " warn" : ""}`}>
        <Icoon naam="stuur" maat={12} />{" "}
        {rijtijd.pauzeNodig
          ? t("rijtijd.appPauze", { blok: urenTekst(rijtijd.blokRijMinuten) })
          : t("rijtijd.appRegel", {
              vandaag: urenTekst(rijtijd.dagRijMinuten),
              over: urenTekst(rijtijd.dagResterendMinuten),
              pauzeOver: urenTekst(rijtijd.blokResterendMinuten),
            })}
      </p>
      <EigenRijtijden rijtijd={rijtijd} bron={state.tachoBron[chauffeur] ?? "app"} />
      <p className="klok-noot">{t("klok.avgNoot")}</p>
    </div>
  );
}

/**
 * De chauffeur moet zijn eigen registraties kunnen inzien (CLAUDE.md §9).
 * Dit paneel toont precies wat de planner ook ziet — geen versimpelde versie,
 * want dan gaan de cijfers uit elkaar lopen in een gesprek.
 */
function EigenRijtijden({
  rijtijd, bron,
}: {
  rijtijd: ReturnType<typeof rijtijdVan>;
  bron: string;
}) {
  const [open, setOpen] = useState(false);
  const regels: Array<[string, string]> = [
    [t("eigen.dag"), `${urenTekst(rijtijd.dagRijMinuten)} / ${urenTekst(RIJTIJD_REGELS.maxDagRijMinuten)}`],
    [t("eigen.blok"), urenTekst(rijtijd.blokResterendMinuten)],
    [t("eigen.week"), `${urenTekst(rijtijd.weekRijMinuten)} / ${urenTekst(RIJTIJD_REGELS.maxWeekRijMinuten)}`],
    [t("eigen.tweeWeken"), `${urenTekst(rijtijd.tweeWekenRijMinuten)} / ${urenTekst(RIJTIJD_REGELS.maxTweeWekenRijMinuten)}`],
    [t("eigen.verlengingen"), `${rijtijd.verlengingenGebruikt} / ${RIJTIJD_REGELS.maxVerlengingenPerWeek}`],
    ...(rijtijd.minutenTotWeekRustDeadline !== null
      ? [[t("eigen.weekrust"), urenTekst(Math.max(0, rijtijd.minutenTotWeekRustDeadline))] as [string, string]]
      : []),
    [t("eigen.bron"), t(`rijtijd.bron.${bron === "tachograaf" ? "tachograaf" : "app"}`)],
  ];

  return (
    <div className="eigen-rijtijden">
      <button className="btn eigen-knop" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icoon naam="stuur" maat={13} /> {open ? t("eigen.verberg") : t("eigen.toon")}
      </button>
      {open && (
        <>
          <dl className="eigen-lijst">
            {regels.map(([label, waarde]) => (
              <div key={label}><dt>{label}</dt><dd>{waarde}</dd></div>
            ))}
          </dl>
          <p className="klok-noot">{t("eigen.noot")}</p>
        </>
      )}
    </div>
  );
}

function HuidigeTaakKaart({
  state, taakId, kmStartOntbreekt, onRegistreer, onEmballage, onCmr, onNulCmr, onZetTrailer,
}: {
  state: AppState;
  taakId: string;
  kmStartOntbreekt: boolean;
  onRegistreer: (taakId: string, type: TaakEventType) => void;
  onEmballage: (taakId: string, soort: EmballageSoort, geleverd: number, retour: number) => void;
  onCmr: (taakId: string, soort: CmrSoort, nummer: string, lading?: string) => void;
  onNulCmr: (taakId: string) => void;
  onZetTrailer: (ritId: string, kenteken: string) => void;
}) {
  const taak = state.taken.find((tk) => tk.id === taakId);
  if (!taak) return null;
  const s = statusVanTaak(state, taakId);
  const zending = zendingVan(state, taak);
  const adresInfo = adresInfoVan(state, taak.adres);
  const cmrs = cmrsVanTaak(state, taakId);

  const heeftLaadCmr = cmrs.some((c) => c.soort === "laad" || c.soort === "nul");
  const heeftLosCmr = cmrs.some((c) => c.soort === "los");

  // CMR-poorten: laden vereist een (0-)CMR, lossen vereist het 3e exemplaar.
  const cmrNodig = Boolean(zending);
  const geladenGeblokkeerd = taak.soort === "laden" && cmrNodig && !heeftLaadCmr;
  const gelostGeblokkeerd = taak.soort === "lossen" && cmrNodig && !heeftLosCmr;

  const acties: Array<[TaakEventType, string, string, IcoonNaam, boolean]> = ({
    gepland: [["vertrokken", t("chauffeur.actie.vertrek"), "primary", "truck", kmStartOntbreekt]],
    onderweg: [["aangekomen", t("chauffeur.actie.aangekomen"), "primary", "locatie", false]],
    bezig: [
      [taak.soort === "laden" ? "geladen" : "gelost",
        taak.soort === "laden" ? t("chauffeur.actie.geladen") : t("chauffeur.actie.gelost"),
        "primary", taak.soort === "laden" ? "check" : "pen",
        taak.soort === "laden" ? geladenGeblokkeerd : gelostGeblokkeerd],
      ["probleem_gemeld", t("chauffeur.actie.probleem"), "probleem-knop", "waarschuwing", false],
    ],
    afgerond: [],
    vervallen: [],
    probleem: [["aangekomen", t("chauffeur.actie.hervatten"), "secundair", "speel", false]],
  } as Record<string, Array<[TaakEventType, string, string, IcoonNaam, boolean]>>)[s];

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

      {s === "bezig" && cmrNodig && (
        <CmrSectie
          state={state}
          taakId={taakId}
          soort={taak.soort === "laden" ? "laad" : "los"}
          onCmr={onCmr}
          onNulCmr={onNulCmr}
          onZetTrailer={onZetTrailer}
        />
      )}

      {(taak.soort === "lossen" || taak.soort === "emballage_retour") && s === "bezig" && (
        <EmballageFormulier taakId={taakId} onEmballage={onEmballage} />
      )}

      {kmStartOntbreekt && s === "gepland" && (
        <p className="cmr-hint">{t("km.eerstInvoeren")}</p>
      )}
      <div className="acties">
        {acties.map(([type, label, cls, icoon, geblokkeerd]) => (
          <button
            key={type}
            className={`btn big knop-met-icoon ${cls}`}
            disabled={geblokkeerd}
            onClick={() => onRegistreer(taakId, type)}
          >
            <Icoon naam={icoon} maat={17} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CmrSectie({
  state, taakId, soort, onCmr, onNulCmr, onZetTrailer,
}: {
  state: AppState;
  taakId: string;
  soort: "laad" | "los";
  onCmr: (taakId: string, soort: CmrSoort, nummer: string, lading?: string) => void;
  onNulCmr: (taakId: string) => void;
  onZetTrailer: (ritId: string, kenteken: string) => void;
}) {
  const taak = state.taken.find((tk) => tk.id === taakId)!;
  const zending = zendingVan(state, taak);
  const cmrs = cmrsVanTaak(state, taakId);
  const gescand = cmrs.find((c) => (soort === "laad" ? c.soort === "laad" || c.soort === "nul" : c.soort === "los"));
  const [nummer, setNummer] = useState("");
  const [lading, setLading] = useState("");
  const trailerKenteken = state.trailerVanRit[taak.ritId] ?? "";

  if (gescand) {
    return (
      <div className="cmr-sectie gescand">
        <Icoon naam={gescand.soort === "nul" ? "kruis" : "document"} maat={15} />
        <div>
          <b>
            {gescand.soort === "nul"
              ? t("cmr.nulGescand")
              : soort === "laad"
                ? t("cmr.laadGescand", { nummer: gescand.nummer })
                : t("cmr.losGescand", { nummer: gescand.nummer })}
          </b>
          {gescand.lading && <span>{t("cmr.ladingLabel")}: {gescand.lading}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="cmr-sectie">
      <h4>
        <Icoon naam="document" maat={14} />{" "}
        {soort === "laad" ? t("cmr.laadTitel") : t("cmr.losTitel")}
      </h4>
      <p className="cmr-hint">
        {soort === "laad" ? t("cmr.laadHint") : t("cmr.losHint")}
      </p>
      <div className="cmr-velden">
        <label>{t("cmr.nummer")}
          <input
            className="mono"
            value={nummer}
            onChange={(e) => setNummer(e.target.value)}
            placeholder={t("cmr.nummerPlaceholder")}
          />
        </label>
        {soort === "laad" && (
          <>
            <label>{t("cmr.ladingLabel")}
              <input
                value={lading}
                onChange={(e) => setLading(e.target.value)}
                placeholder={zending?.omschrijving ?? t("cmr.ladingPlaceholder")}
              />
            </label>
            <label>{t("cmr.trailer")}
              <select
                value={trailerKenteken}
                onChange={(e) => onZetTrailer(taak.ritId, e.target.value)}
              >
                <option value="">{t("cmr.geenTrailer")}</option>
                {state.trailers.map((trailer) => (
                  <option key={trailer.kenteken} value={trailer.kenteken}>
                    {formatteerKenteken({ landcode: trailer.landcode, kenteken: trailer.kenteken })} · {trailer.omschrijving}
                  </option>
                ))}
              </select>
              <span className="cmr-subhint">{t("cmr.trailerNoot")}</span>
            </label>
          </>
        )}
      </div>
      <div className="adres-acties">
        <button
          className="btn primary knop-met-icoon"
          disabled={!nummer.trim()}
          onClick={() => onCmr(taakId, soort, nummer.trim(), lading.trim() || undefined)}
        >
          <Icoon naam="portaal" maat={14} />
          {soort === "laad" ? t("cmr.scanLaad") : t("cmr.scanLos")}
        </button>
        {soort === "laad" && (
          <button className="btn knop-met-icoon" onClick={() => onNulCmr(taakId)}>
            <Icoon naam="kruis" maat={13} /> {t("cmr.nulKnop")}
          </button>
        )}
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
