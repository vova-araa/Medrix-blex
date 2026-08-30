import {
  bewakingVanVloot, formatteerGeld, formatteerKenteken, geblokkeerdeVoertuigen,
  kostenVanDag, meldingStatus, openMeldingen,
  type Garagemelding, type MeldingStatus, type WagenparkVoertuig,
} from "@sharzi/domain";
import { takenVanRit, type AppState } from "../data/state";
import { kmVandaag } from "../kaart/simulatie";
import { t } from "../i18n";
import { datumKort, tijd } from "../utils";
import { Icoon } from "./Icoon";

const DAG_MS = 24 * 60 * 60 * 1000;

interface Props {
  state: AppState;
  nu: string;
  onZetTrailer: (ritId: string, kenteken: string) => void;
  onMeldingStatus: (meldingId: string, status: MeldingStatus) => void;
}

/** Dieselprijs voor de kostprijsberekening; komt later uit de tankkoppeling. */
const DIESEL_CENTEN_PER_LITER = 172;

export function WagenparkView({ state, nu, onZetTrailer, onMeldingStatus }: Props) {
  // De app-vorm van het wagenpark omzetten naar het domeinmodel.
  const vloot: WagenparkVoertuig[] = state.wagenpark.map((v) => ({
    kentekenGenormaliseerd: v.kenteken,
    landcode: v.landcode,
    omschrijving: v.omschrijving,
    kmStand: v.kmStand,
    apkTotIso: v.apkTot,
    volgendeOnderhoudKm: v.volgendeOnderhoudKm,
    tachograafGekeurdIso: v.tachograafGekeurd,
    verbruikL100: v.verbruikL100,
    kostenPerMaandCenten: v.kostenPerMaandCenten,
  }));
  const bewaking = bewakingVanVloot(vloot, nu).filter((b) => b.ernst !== "ok");
  const kmVanKenteken = (kenteken: string) => {
    const rit = state.ritten.find((r) => r.voertuig.kentekenGenormaliseerd === kenteken);
    return rit ? kmVandaag(state, rit.id) : 0;
  };

  return (
    <div className="uren-main">
      <Werkplaats state={state} onMeldingStatus={onMeldingStatus} />

      <div className="ph-card uren-kaart">
        <div className="operatie-kop">
          <h3 className="zij-kop"><Icoon naam="waarschuwing" maat={15} /> {t("bewaking.titel")}</h3>
          <span className="melding-teller">{bewaking.length}</span>
        </div>
        <p className="uren-noot">{t("bewaking.noot")}</p>
        {bewaking.length === 0 ? (
          <p className="kaart-kies">{t("bewaking.geen")}</p>
        ) : (
          <ul className="naleving-lijst">
            {bewaking.map((b, i) => (
              <li key={i} className={`naleving-regel e-${b.ernst === "verlopen" ? "overtreding" : "waarschuwing"}`}>
                <span className="plate plate-klein">
                  <span className="nr">{formatteerKenteken({ landcode: "NL", kenteken: b.kenteken })}</span>
                </span>
                <div>
                  <div className="naleving-wie">
                    {t(`bewaking.soort.${b.soort}`)}
                    <span className={`klok-chip ${b.ernst === "verlopen" ? "rt-kritiek" : "rt-warn"}`}>
                      {t(`bewaking.ernst.${b.ernst}`)}
                    </span>
                  </div>
                  <div className="naleving-oms">{b.omschrijving}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("wagenpark.titel")}</h3>
        <p className="uren-noot">{t("wagenpark.noot")}</p>
        {state.wagenparkSync && (
          <p className="koppeling-bron">
            <Icoon naam="edi" maat={12} /> {t("wagenpark.bron", { tijd: tijd(state.wagenparkSync) })}
          </p>
        )}
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("wagenpark.voertuig")}</th>
                <th>{t("wagenpark.kmStand")}</th>
                <th>{t("wagenpark.apk")}</th>
                <th>{t("wagenpark.onderhoud")}</th>
                <th>{t("wagenpark.verbruik")}</th>
                <th>{t("wagenpark.kosten")}</th>
                <th>{t("wagenpark.kostprijsKm")}</th>
              </tr>
            </thead>
            <tbody>
              {state.wagenpark.map((voertuig) => {
                const apkDagen = Math.floor((Date.parse(voertuig.apkTot) - Date.parse(nu)) / DAG_MS);
                const kmTeGaan = voertuig.volgendeOnderhoudKm - voertuig.kmStand;
                const kosten = kostenVanDag(
                  vloot.find((v) => v.kentekenGenormaliseerd === voertuig.kenteken)!,
                  kmVanKenteken(voertuig.kenteken),
                  DIESEL_CENTEN_PER_LITER
                );
                return (
                  <tr key={voertuig.kenteken}>
                    <td>
                      <span className="plate">
                        <span className="eu">{voertuig.landcode}</span>
                        <span className="nr">
                          {formatteerKenteken({ landcode: voertuig.landcode, kenteken: voertuig.kenteken })}
                        </span>
                      </span>
                      <span className="voertuigtype wagenpark-type">{voertuig.omschrijving}</span>
                    </td>
                    <td>{voertuig.kmStand.toLocaleString("nl-NL")} km</td>
                    <td>
                      {new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" })
                        .format(new Date(voertuig.apkTot))}
                      {apkDagen <= 30 && (
                        <span className="eta-chip te-laat wagenpark-alarm">
                          {t("wagenpark.apkBinnen", { dagen: apkDagen })}
                        </span>
                      )}
                    </td>
                    <td>
                      {t("wagenpark.overKm", { km: kmTeGaan.toLocaleString("nl-NL") })}
                      {kmTeGaan <= 8000 && (
                        <span className="eta-chip wagenpark-alarm">{t("wagenpark.plannen")}</span>
                      )}
                    </td>
                    <td>{voertuig.verbruikL100.toLocaleString("nl-NL")} l/100km</td>
                    <td>{formatteerGeld({ bedragCenten: voertuig.kostenPerMaandCenten, valuta: "EUR" })}/{t("wagenpark.maand")}</td>
                    <td>
                      {kosten.kostprijsPerKmCenten === null
                        ? <span className="uren-noot">{t("wagenpark.geenKm")}</span>
                        : <b>{formatteerGeld({ bedragCenten: kosten.kostprijsPerKmCenten, valuta: "EUR" })}</b>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("trailer.titel")}</h3>
        <p className="uren-noot">{t("trailer.noot")}</p>
        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("trailer.kenteken")}</th>
                <th>{t("trailer.omschrijving")}</th>
                <th>{t("trailer.toegewezen")}</th>
              </tr>
            </thead>
            <tbody>
              {state.trailers.map((trailer) => {
                const ritId = Object.entries(state.trailerVanRit)
                  .find(([, kenteken]) => kenteken === trailer.kenteken)?.[0];
                const rit = ritId ? state.ritten.find((r) => r.id === ritId) : undefined;
                return (
                  <tr key={trailer.kenteken}>
                    <td>
                      <span className="plate">
                        <span className="eu">{trailer.landcode}</span>
                        <span className="nr">
                          {formatteerKenteken({ landcode: trailer.landcode, kenteken: trailer.kenteken })}
                        </span>
                      </span>
                    </td>
                    <td>{trailer.omschrijving}</td>
                    <td>{rit ? `${rit.id} · ${rit.chauffeur || "—"}` : t("trailer.vrij")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h4 className="zij-kop trailer-toewijzing-kop">{t("trailer.toewijzing")}</h4>
        <div className="table-scroll">
          <table className="uren-tabel">
            <tbody>
              {state.ritten
                .filter((rit) => takenVanRit(state, rit.id).length > 0)
                .map((rit) => (
                  <tr key={rit.id}>
                    <td>{rit.id} · {rit.chauffeur || "—"}</td>
                    <td>
                      <select
                        className="trailer-select"
                        value={state.trailerVanRit[rit.id] ?? ""}
                        onChange={(e) => onZetTrailer(rit.id, e.target.value)}
                        aria-label={`${t("trailer.toewijzing")} ${rit.id}`}
                      >
                        <option value="">{t("cmr.geenTrailer")}</option>
                        {state.trailers.map((trailer) => (
                          <option key={trailer.kenteken} value={trailer.kenteken}>
                            {formatteerKenteken({ landcode: trailer.landcode, kenteken: trailer.kenteken })}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Wat de chauffeurs hebben gemeld. Een kritiek gebrek zet de auto stil tot de
 * werkplaats ernaar gekeken heeft — die blokkade staat hier, niet in de code
 * van het planbord, want het is een werkplaatsbesluit.
 */
function Werkplaats({ state, onMeldingStatus }: {
  state: AppState;
  onMeldingStatus: (meldingId: string, status: MeldingStatus) => void;
}) {
  const open = openMeldingen(state.garagemeldingen);
  const geblokkeerd = geblokkeerdeVoertuigen(state.garagemeldingen);
  const verholpen = state.garagemeldingen.filter((m) => meldingStatus(m) === "verholpen");

  return (
    <div className="ph-card uren-kaart werkplaats">
      <div className="operatie-kop">
        <h3 className="zij-kop"><Icoon naam="waarschuwing" maat={15} /> {t("garage.titel")}</h3>
        <span className="melding-teller">{open.length}</span>
      </div>
      <p className="uren-noot">{t("garage.noot")}</p>

      {geblokkeerd.length > 0 && (
        <div className="wp-blokkade">
          <b><Icoon naam="waarschuwing" maat={13} /> {t("garage.geblokkeerd")}</b>
          <span>
            {geblokkeerd
              .map((k) => formatteerKenteken({ landcode: "NL", kenteken: k }))
              .join(" · ")}
          </span>
          <p>{t("garage.geblokkeerdUitleg")}</p>
        </div>
      )}

      {open.length === 0 ? (
        <p className="kaart-kies">{t("garage.geenOpen")}</p>
      ) : (
        <ul className="wp-lijst">
          {open.map((melding) => (
            <MeldingRegel key={melding.id} melding={melding} onMeldingStatus={onMeldingStatus} />
          ))}
        </ul>
      )}

      {verholpen.length > 0 && (
        <p className="uren-noot wp-verholpen">
          {t("garage.verholpenTelling", { n: verholpen.length })}
        </p>
      )}
    </div>
  );
}

function MeldingRegel({ melding, onMeldingStatus }: {
  melding: Garagemelding;
  onMeldingStatus: (meldingId: string, status: MeldingStatus) => void;
}) {
  const status = meldingStatus(melding);
  const laatste = melding.afhandeling[melding.afhandeling.length - 1];

  return (
    <li className={`wp-melding${melding.kritisch ? " kritisch" : ""}`}>
      <div className="wp-kop">
        <span className="mono wp-kenteken">
          {formatteerKenteken({ landcode: "NL", kenteken: melding.kentekenGenormaliseerd })}
        </span>
        {melding.punt && <span className="wp-punt">{t(`dagcontrole.punt.${melding.punt}`)}</span>}
        {melding.kritisch && <span className="wp-kritisch">{t("garage.veiligheid")}</span>}
        <span className={`wp-status s-${status}`}>{t(`garage.status.${status}`)}</span>
      </div>
      <p className="wp-oms">{melding.omschrijving || t("dagcontrole.geenToelichting")}</p>
      <p className="wp-meta">
        {t(`garage.bron.${melding.bron}`)} · {melding.gemeldDoor} ·{" "}
        {datumKort(melding.gemeldOp)} {tijd(melding.gemeldOp)}
        {laatste?.notitie ? ` · ${laatste.notitie}` : ""}
      </p>
      <div className="wp-acties">
        {status === "open" && (
          <button className="btn wp-inplannen" onClick={() => onMeldingStatus(melding.id, "ingepland")}>
            {t("garage.actie.inplannen")}
          </button>
        )}
        <button className="btn primary wp-verhelpen" onClick={() => onMeldingStatus(melding.id, "verholpen")}>
          {t("garage.actie.verholpen")}
        </button>
      </div>
    </li>
  );
}
