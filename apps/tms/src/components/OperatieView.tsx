import { formatteerKenteken } from "@sharzi/domain";
import { benodigdeBerichten, type BerichtVoorstel } from "../data/communicatie";
import { herstelVoorstellen, type HerstelVoorstel } from "../data/herstel";
import { meldingen, STANDTIJD_GRENS_MIN } from "../data/meldingen";
import {
  actieveTakenVanRit,
  eventsVanTaak,
  statusVanRit,
  statusVanTaak,
  takenVanRit,
  type AppState,
  type BeleidActie,
  type BeleidStand,
} from "../data/state";
import { statusLabel, t } from "../i18n";
import { ritEta, voertuigPositie } from "../kaart/simulatie";
import { initialen, tijd } from "../utils";
import { Icoon, type IcoonNaam } from "./Icoon";

const BRON_ICOON: Record<string, IcoonNaam> = {
  chauffeursapp: "truck",
  standtijd: "timer",
  ai: "assistent",
  rijtijden: "stuur",
};

const BELEID_ACTIES: BeleidActie[] = ["klantbericht", "herplannen", "wachturen"];
const BELEID_STANDEN: BeleidStand[] = ["automatisch", "voorstel", "uit"];

export function OperatieView({ state, nu, onHerstel, onZetBeleid, onVerstuurBericht }: {
  state: AppState;
  nu: string;
  onHerstel: (voorstel: HerstelVoorstel) => void;
  onZetBeleid: (actie: BeleidActie, stand: BeleidStand) => void;
  onVerstuurBericht: (voorstel: BerichtVoorstel) => void;
}) {
  const lijst = meldingen(state, nu);
  const herstel = state.beleid.herplannen === "uit" ? [] : herstelVoorstellen(state, nu);
  const openBerichten = state.beleid.klantbericht === "voorstel" ? benodigdeBerichten(state, nu) : [];
  const actieveRitten = state.ritten.filter((r) => takenVanRit(state, r.id).length > 0);

  return (
    <div className="operatie-main">
      <div className="operatie-meldingen">
        <div className="ph-card">
          <h3 className="zij-kop">{t("operatie.beleid")}</h3>
          <p className="uren-noot">{t("operatie.beleidNoot")}</p>
          <div className="beleid-lijst">
            {BELEID_ACTIES.map((actie) => (
              <div className="beleid-rij" key={actie}>
                <span className="beleid-label">{t(`beleid.${actie}`)}</span>
                <div className="beleid-standen">
                  {BELEID_STANDEN.map((stand) => (
                    <button
                      key={stand}
                      className={`beleid-knop${state.beleid[actie] === stand ? " actief" : ""}`}
                      onClick={() => onZetBeleid(actie, stand)}
                    >
                      {t(`beleid.stand.${stand}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ph-card">
          <div className="operatie-kop">
            <h3 className="zij-kop">{t("operatie.herstel")}</h3>
            <span className="melding-teller">{herstel.length}</span>
          </div>
          <p className="uren-noot">{t("operatie.herstelNoot")}</p>
          {state.beleid.herplannen === "uit" ? (
            <p className="kaart-kies">{t("operatie.herstelUitgezet")}</p>
          ) : (
            herstel.length === 0 && <p className="kaart-kies">{t("operatie.herstelGeen")}</p>
          )}
          <ul className="herstel-lijst">
            {herstel.map((h) => {
              const zending = state.zendingen[h.zendingId];
              return (
                <li key={`${h.ritId}-${h.zendingId}`} className="herstel-voorstel">
                  <div className="herstel-kop">
                    <span className="mono">{h.zendingId}</span>
                    <Icoon naam="pijl" maat={12} />
                    <b>{h.voorstel.chauffeur}</b>
                    <span className="mono av-rit">{h.voorstel.ritId}</span>
                  </div>
                  {zending && (
                    <div className="av-route">
                      {zending.van.plaats} → {zending.naar.plaats} · {zending.omschrijving}
                    </div>
                  )}
                  <div className="herstel-reden">
                    <Icoon naam="waarschuwing" maat={11} />{" "}
                    {t(`operatie.herstelReden.${h.reden}`, { chauffeur: h.chauffeur, rit: h.ritId })}
                  </div>
                  <div className="av-tijden">
                    {t("operatie.herstelNaar", { tijd: tijd(h.voorstel.aankomstIso) })}
                  </div>
                  <ul className="av-motivatie">
                    {h.voorstel.motivatie.map((regel, i) => <li key={i}>{regel}</li>)}
                  </ul>
                  <button className="btn primary knop-met-icoon" onClick={() => onHerstel(h)}>
                    <Icoon naam="check" maat={13} /> {t("operatie.herstelUitvoeren")}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="ph-card">
          <div className="operatie-kop">
            <h3 className="zij-kop">{t("operatie.communicatie")}</h3>
            <span className="melding-teller">{state.berichten.length}</span>
          </div>
          <p className="uren-noot">{t("operatie.communicatieNoot")}</p>
          {openBerichten.length > 0 && (
            <ul className="herstel-lijst">
              {openBerichten.map((voorstel) => (
                <li key={voorstel.zendingId} className="herstel-voorstel">
                  <div className="herstel-kop">
                    <b>{voorstel.klant}</b>
                    <span className="mono av-rit">{voorstel.zendingId}</span>
                  </div>
                  <div className="bericht-tekst">{voorstel.tekst}</div>
                  <button className="btn primary knop-met-icoon" onClick={() => onVerstuurBericht(voorstel)}>
                    <Icoon naam="pijl" maat={13} /> {t("operatie.verstuur")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state.berichten.length === 0 && openBerichten.length === 0 && (
            <p className="kaart-kies">{t("operatie.geenBerichten")}</p>
          )}
          <ul className="bericht-lijst">
            {[...state.berichten].reverse().map((bericht) => (
              <li key={bericht.id} className="bericht">
                <div className="herstel-kop">
                  <b>{bericht.klant}</b>
                  <span className="mono av-rit">{bericht.zendingId}</span>
                </div>
                <div className="bericht-tekst">{bericht.tekst}</div>
                <div className="melding-meta">
                  <span className="melding-bron">
                    {t(`operatie.berichtWie.${bericht.wie}`)} · {tijd(bericht.tijdstip)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="ph-card">
          <div className="operatie-kop">
            <h3 className="zij-kop">{t("operatie.meldingen")}</h3>
            <span className="melding-teller">{lijst.length}</span>
          </div>
          <p className="uren-noot">{t("operatie.noot", { grens: STANDTIJD_GRENS_MIN })}</p>
          {lijst.length === 0 && <p className="kaart-kies">{t("operatie.geenMeldingen")}</p>}
          <ul className="melding-lijst">
            {lijst.map((melding) => (
              <li key={melding.id} className={`melding e-${melding.ernst}`}>
                <span className="melding-icoon">
                  <Icoon naam={melding.ernst === "kritiek" ? "waarschuwing" : BRON_ICOON[melding.bron]} maat={17} />
                </span>
                <div className="melding-inhoud">
                  <div className="melding-titel">{melding.titel}</div>
                  <div className="melding-oms">{melding.omschrijving}</div>
                  <div className="melding-meta">
                    <span className="melding-bron">
                      <Icoon naam={BRON_ICOON[melding.bron]} maat={11} /> {t(`operatie.bron.${melding.bron}`)}
                    </span>
                    <span className="mono">{melding.ritId}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="operatie-ritten">
        <div className="ph-card uren-kaart">
          <h3 className="zij-kop">{t("operatie.ritten")}</h3>
          <div className="table-scroll">
            <table className="uren-tabel">
              <thead>
                <tr>
                  <th>{t("operatie.rit")}</th>
                  <th>{t("uren.status")}</th>
                  <th>{t("operatie.bezigMet")}</th>
                  <th>{t("kaart.positie")}</th>
                  <th>{t("kaart.eta")}</th>
                  <th>{t("operatie.standtijd")}</th>
                </tr>
              </thead>
              <tbody>
                {actieveRitten.map((rit) => {
                  const rs = statusVanRit(state, rit.id);
                  const taken = actieveTakenVanRit(state, rit.id);
                  const huidige = taken.find((tk) => statusVanTaak(state, tk.id) !== "afgerond");
                  const pos = voertuigPositie(state, rit, nu);
                  const eta = ritEta(state, rit.id, nu);

                  let standtijd: number | null = null;
                  if (huidige) {
                    const s = statusVanTaak(state, huidige.id);
                    if (s === "bezig" || s === "probleem") {
                      const aangekomen = eventsVanTaak(state, huidige.id)
                        .filter((e) => e.type === "aangekomen").at(-1);
                      if (aangekomen) {
                        standtijd = Math.floor((Date.parse(nu) - Date.parse(aangekomen.tijdstip)) / 60_000);
                      }
                    }
                  }

                  return (
                    <tr key={rit.id}>
                      <td>
                        <span className="avatar avatar-klein">{initialen(rit.chauffeur || "•")}</span>
                        <div className="operatie-wie">
                          <b>{rit.chauffeur || t("vloot.beschikbaar")}</b>
                          <span className="mono">
                            {formatteerKenteken({ landcode: rit.voertuig.landcode, kenteken: rit.voertuig.kentekenGenormaliseerd })}
                          </span>
                        </div>
                      </td>
                      <td><span className={`status-chip s-${rs}`}>{statusLabel(rs)}</span></td>
                      <td>
                        {huidige
                          ? `${t(`taak.${huidige.soort}`)} · ${huidige.adres.plaats}`
                          : t("operatie.klaar")}
                      </td>
                      <td>
                        {pos.onderweg && pos.naarPlaats
                          ? t("kaart.tussen", { van: pos.vanPlaats, naar: pos.naarPlaats })
                          : pos.vanPlaats}
                      </td>
                      <td className={eta?.naVenster ? "eta-te-laat" : undefined}>
                        {eta
                          ? `${tijd(eta.aankomstIso)}${eta.vertragingMin > 0 ? ` (+${eta.vertragingMin})` : ""}`
                          : "—"}
                      </td>
                      <td className={standtijd !== null && standtijd > STANDTIJD_GRENS_MIN ? "eta-te-laat" : undefined}>
                        {standtijd !== null ? `${standtijd} min` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
