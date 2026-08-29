import { bewakingVanVloot, formatteerGeld, formatteerKenteken, kostenVanDag, type WagenparkVoertuig } from "@sharzi/domain";
import { takenVanRit, type AppState } from "../data/state";
import { kmVandaag } from "../kaart/simulatie";
import { t } from "../i18n";
import { tijd } from "../utils";
import { Icoon } from "./Icoon";

const DAG_MS = 24 * 60 * 60 * 1000;

interface Props {
  state: AppState;
  nu: string;
  onZetTrailer: (ritId: string, kenteken: string) => void;
}

/** Dieselprijs voor de kostprijsberekening; komt later uit de tankkoppeling. */
const DIESEL_CENTEN_PER_LITER = 172;

export function WagenparkView({ state, nu, onZetTrailer }: Props) {
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
