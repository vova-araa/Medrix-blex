import { formatteerKenteken } from "@sharzi/domain";
import { meldingen, STANDTIJD_GRENS_MIN } from "../data/meldingen";
import {
  actieveTakenVanRit,
  eventsVanTaak,
  statusVanRit,
  statusVanTaak,
  takenVanRit,
  type AppState,
} from "../data/state";
import { statusLabel, t } from "../i18n";
import { ritEta, voertuigPositie } from "../kaart/simulatie";
import { initialen, tijd } from "../utils";
import { Icoon, type IcoonNaam } from "./Icoon";

const BRON_ICOON: Record<string, IcoonNaam> = {
  chauffeursapp: "truck",
  standtijd: "timer",
  ai: "assistent",
};

export function OperatieView({ state, nu }: { state: AppState; nu: string }) {
  const lijst = meldingen(state, nu);
  const actieveRitten = state.ritten.filter((r) => takenVanRit(state, r.id).length > 0);

  return (
    <div className="operatie-main">
      <div className="operatie-meldingen">
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
