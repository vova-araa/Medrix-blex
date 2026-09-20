import {
  bouwRitdossier, formatteerGeld, formatteerKenteken,
  type DossierStop, type Ritdossier,
} from "@sharzi/domain";
import { useMemo } from "react";
import { tariefVoorZending, WACHTUUR_TARIEF_CENTEN, WACHTTIJD_GRATIS_MIN } from "../data/facturen";
import { eventsVanTaak, rijtijdVan, takenVanRit, type AppState } from "../data/state";
import { t } from "../i18n";
import { kmVandaag } from "../kaart/simulatie";
import { datumKort, laadmeters, tijd } from "../utils";
import { Icoon } from "./Icoon";

// Het ritdossier: alles van één rit bij elkaar. Dit is het scherm waar de
// planner op terugvalt als iemand belt en vraagt wat er met die rit gebeurd is.
//
// Gepland naast werkelijk, waar de tijd verdween, welke uren erin zitten, wat
// de rit opbracht en wat hij kostte. Alles afgeleid, niets opgeslagen.

/**
 * Kostprijzen. Dit zijn richtgetallen tot Blex zijn eigen kostprijs per
 * kilometer en per uur aanlevert — daar hangt de marge volledig aan.
 */
const KOSTEN_PER_KM_CENTEN = 95;
const KOSTEN_PER_UUR_CENTEN = 4_200;

export function RitdossierPaneel({ state, nu, ritId, onSluit, onSelecteerTaak }: {
  state: AppState;
  nu: string;
  ritId: string;
  onSluit: () => void;
  onSelecteerTaak: (taakId: string) => void;
}) {
  const rit = state.ritten.find((r) => r.id === ritId);

  const dossier = useMemo<Ritdossier | null>(() => {
    if (!rit) return null;
    return bouwRitdossier({
      rit,
      taken: takenVanRit(state, ritId),
      eventsVanTaak: (taakId) => eventsVanTaak(state, taakId),
      zendingen: state.zendingen,
      vrachtCenten: (zendingId) => {
        const zending = state.zendingen[zendingId];
        if (!zending) return 0;
        const order = state.orders[zending.orderId];
        return tariefVoorZending(zending, order ? state.tarieven[order.opdrachtgever] : undefined)
          .bedragCenten;
      },
      kilometers: kmVandaag(state, ritId) || null,
      tarieven: {
        vrijeWachtMinuten: WACHTTIJD_GRATIS_MIN,
        wachtuurCenten: WACHTUUR_TARIEF_CENTEN,
        kostenPerKmCenten: KOSTEN_PER_KM_CENTEN,
        kostenPerUurCenten: KOSTEN_PER_UUR_CENTEN,
      },
    });
  }, [state, ritId, rit]);

  // De rijtijdstand van deze chauffeur op dit moment: hoort bij het dossier,
  // want een rit beoordelen zonder te weten hoeveel uur erin zat kan niet.
  const rijtijd = useMemo(
    () => (rit?.chauffeur ? rijtijdVan(state, rit.chauffeur, nu) : null),
    [state, rit, nu]
  );

  if (!dossier || !rit) return null;

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail ritdossier">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
          <div className="eyebrow">{t("dossier.eyebrow")}</div>
          <h3 className="mono">{dossier.ritId}</h3>
          <p className="rd-onder">
            {dossier.chauffeur || t("vloot.beschikbaar")} ·{" "}
            {formatteerKenteken({ landcode: dossier.landcode, kenteken: dossier.kentekenGenormaliseerd })}
            {dossier.charter && ` · ${t("vloot.charter")}`} ·{" "}
            {datumKort(`${dossier.datum}T12:00:00Z`)}
          </p>
        </div>

        <div className="detail-body">
          <Kerncijfers dossier={dossier} />

          <h4 className="rd-kop">{t("dossier.stops")}</h4>
          <div className="rap-tabelwrap">
            <table className="rap-tabel rd-stops">
              <thead>
                <tr>
                  <th>{t("dossier.kol.stop")}</th>
                  <th>{t("dossier.kol.gepland")}</th>
                  <th>{t("dossier.kol.werkelijk")}</th>
                  <th className="num">{t("dossier.kol.afwijking")}</th>
                  <th className="num">{t("dossier.kol.standtijd")}</th>
                  <th className="num">{t("dossier.kol.wachturen")}</th>
                  <th>{t("dossier.kol.venster")}</th>
                </tr>
              </thead>
              <tbody>
                {dossier.stops.map((stop) => (
                  <StopRegel key={stop.taakId} stop={stop} onSelecteerTaak={onSelecteerTaak} />
                ))}
              </tbody>
            </table>
          </div>

          {rijtijd && (
            <>
              <h4 className="rd-kop">{t("dossier.uren")}</h4>
              <div className="rd-uren">
                <Cijfer label={t("rijtijd.vandaag")} waarde={uren(rijtijd.dagRijMinuten)} />
                <Cijfer label={t("rijtijd.nogDag")} waarde={uren(rijtijd.dagResterendMinuten)} />
                <Cijfer label={t("rijtijd.blok")} waarde={uren(rijtijd.blokResterendMinuten)} />
                <Cijfer label={t("rijtijd.week")} waarde={uren(rijtijd.weekRijMinuten)} />
                <Cijfer
                  label={t("dossier.dienst")}
                  waarde={uren(rijtijd.dienstMinuten)}
                />
              </div>
              <p className="events-note">{t("dossier.urenNoot")}</p>
            </>
          )}

          <h4 className="rd-kop">{t("dossier.resultaat")}</h4>
          <Resultaat dossier={dossier} />
          <p className="events-note">{t("dossier.resultaatNoot")}</p>
        </div>
      </aside>
    </div>
  );
}

function Kerncijfers({ dossier }: { dossier: Ritdossier }) {
  return (
    <div className="rd-tegels">
      <Cijfer
        label={t("dossier.voortgang")}
        waarde={`${dossier.afgerond}/${dossier.totaal}`}
      />
      <Cijfer
        label={t("dossier.duur")}
        waarde={dossier.duurMinuten === null ? "—" : uren(dossier.duurMinuten)}
      />
      <Cijfer
        label={t("dossier.km")}
        waarde={dossier.kilometers === null ? "—" : dossier.kilometers.toLocaleString("nl-NL")}
      />
      <Cijfer label={t("dossier.laadmeters")} waarde={laadmeters(dossier.laadmeters)} />
      <Cijfer
        label={t("dossier.wachttijd")}
        waarde={dossier.totaalWachtMinuten === 0 ? "—" : uren(dossier.totaalWachtMinuten)}
        let={dossier.totaalWachtMinuten > 0}
      />
      <Cijfer
        label={t("dossier.buitenVenster")}
        waarde={String(dossier.buitenVenster)}
        let={dossier.buitenVenster > 0}
      />
    </div>
  );
}

function StopRegel({ stop, onSelecteerTaak }: {
  stop: DossierStop;
  onSelecteerTaak: (taakId: string) => void;
}) {
  const teLaat = stop.afwijkingMinuten !== null && stop.afwijkingMinuten > 10;

  return (
    <tr className={stop.status === "vervallen" ? "rd-vervallen" : ""}>
      <td>
        <button className="rd-stopnaam" onClick={() => onSelecteerTaak(stop.taakId)}>
          <b>{t(`taak.${stop.soort}`)}</b> {stop.adresNaam}
          <span className="rd-plaats">{stop.plaats}</span>
        </button>
      </td>
      <td>{tijd(stop.geplandVan)}–{tijd(stop.geplandTot)}</td>
      <td>
        {stop.aangekomen
          ? `${tijd(stop.aangekomen)}${stop.afgerond ? `–${tijd(stop.afgerond)}` : "–…"}`
          : <span className="doc-geen">{t(`status.${stop.status}`)}</span>}
      </td>
      <td className={`num${teLaat ? " let" : ""}`}>
        {stop.afwijkingMinuten === null
          ? "—"
          : `${stop.afwijkingMinuten > 0 ? "+" : ""}${stop.afwijkingMinuten} min`}
      </td>
      <td className="num">{stop.standtijdMinuten === null ? "—" : `${stop.standtijdMinuten} min`}</td>
      <td className={`num${stop.wachtMinuten > 0 ? " let" : ""}`}>
        {stop.wachtMinuten === 0 ? "—" : `${stop.wachtMinuten} min`}
      </td>
      <td>
        {stop.binnenVenster === null
          ? <span className="doc-geen">—</span>
          : stop.binnenVenster
            ? <span className="status-chip s-afgerond">{t("dossier.opTijd")}</span>
            : <span className="status-chip s-probleem">{t("dossier.teLaat")}</span>}
      </td>
    </tr>
  );
}

function Resultaat({ dossier }: { dossier: Ritdossier }) {
  const { geld } = dossier;
  const verlies = geld.saldo.bedragCenten < 0;

  return (
    <div className="rd-resultaat">
      <div className="rd-kolom">
        <span className="rd-kolomkop">{t("dossier.opbrengst")}</span>
        <Regel label={t("dossier.vracht")} bedrag={formatteerGeld(geld.vracht)} />
        <Regel label={t("dossier.wachturen")} bedrag={formatteerGeld(geld.wachturen)} />
        <Regel label={t("rapport.totaal")} bedrag={formatteerGeld(geld.opbrengst)} totaal />
      </div>
      <div className="rd-kolom">
        <span className="rd-kolomkop">{t("dossier.kosten")}</span>
        <Regel label={t("dossier.kmKosten")} bedrag={formatteerGeld(geld.kilometerkosten)} />
        <Regel label={t("dossier.uurKosten")} bedrag={formatteerGeld(geld.uurkosten)} />
        <Regel label={t("rapport.totaal")} bedrag={formatteerGeld(geld.kosten)} totaal />
      </div>
      <div className={`rd-saldo${verlies ? " verlies" : ""}`}>
        <span>{t("dossier.saldo")}</span>
        <b>{formatteerGeld(geld.saldo)}</b>
        {geld.margePct !== null && <span className="rd-marge">{geld.margePct}% marge</span>}
      </div>
    </div>
  );
}

function Regel({ label, bedrag, totaal }: { label: string; bedrag: string; totaal?: boolean }) {
  return (
    <div className={`rd-regel${totaal ? " totaal" : ""}`}>
      <span>{label}</span>
      <span className="num">{bedrag}</span>
    </div>
  );
}

function Cijfer({ label, waarde, let: letOp }: { label: string; waarde: string; let?: boolean }) {
  return (
    <div className={`rd-cijfer${letOp ? " let" : ""}`}>
      <span>{label}</span>
      <b>{waarde}</b>
    </div>
  );
}

const uren = (minuten: number) =>
  `${Math.floor(minuten / 60)}:${String(Math.abs(minuten) % 60).padStart(2, "0")}`;
