import {
  formatteerGeld, formatteerKenteken, naarCsv, perAdres, perChauffeur, perDag,
  perOpdrachtgever, perVoertuig, periodeVan,
  type Periode, type PeriodeKeuze, type RapportInvoer,
} from "@sharzi/domain";
import { useMemo, useState } from "react";
import { tariefVoorZending } from "../data/facturen";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { kmVandaag } from "../kaart/simulatie";
import { datumDagKort } from "../utils";
import { DashboardView } from "./DashboardView";
import { Icoon } from "./Icoon";

// Rapportage is een leesscherm: kies een periode, lees een tabel, neem hem mee
// naar de accountant of naar het gesprek met de opdrachtgever. Elke tabel is
// dezelfde vorm — kop, regels, totaalregel, exportknop — zodat er niets te
// leren valt per rapport.

type RapportNaam = "overzicht" | "opdrachtgever" | "chauffeur" | "voertuig" | "adres" | "dag";

const PERIODES: PeriodeKeuze[] = ["vandaag", "deze_week", "vorige_week", "deze_maand", "vorige_maand"];
const RAPPORTEN: RapportNaam[] = ["overzicht", "opdrachtgever", "chauffeur", "voertuig", "adres", "dag"];

/** Cel: een waarde plus hoe hij eruitziet. `ruw` gaat naar de CSV. */
interface Cel {
  tekst: string;
  ruw: string | number | null;
  getal?: boolean;
  /** Zet de cel in een waarschuwingskleur, bijv. bij structurele vertraging. */
  let?: boolean;
}

interface Tabel {
  kolommen: string[];
  rijen: Cel[][];
  totaal?: Cel[];
  leeg: string;
}

const tekst = (waarde: string): Cel => ({ tekst: waarde, ruw: waarde });
const getal = (waarde: number, cijfers = 0): Cel => ({
  tekst: waarde.toLocaleString("nl-NL", { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers }),
  ruw: waarde, getal: true,
});
const pct = (waarde: number | null, grens = 90): Cel =>
  waarde === null
    ? { tekst: "—", ruw: null, getal: true }
    : { tekst: `${waarde}%`, ruw: waarde, getal: true, let: waarde < grens };
const minuten = (waarde: number | null): Cel =>
  waarde === null ? { tekst: "—", ruw: null, getal: true } : { tekst: `${waarde} min`, ruw: waarde, getal: true, let: waarde > 0 };

export function RapportageView({ state, nu }: { state: AppState; nu: string }) {
  const [keuze, setKeuze] = useState<PeriodeKeuze>("deze_week");
  const [rapport, setRapport] = useState<RapportNaam>("overzicht");

  const periode = useMemo(() => periodeVan(keuze, nu), [keuze, nu]);
  const invoer = useMemo(() => bouwInvoer(state, periode), [state, periode]);
  const tabel = useMemo(
    () => (rapport === "overzicht" ? null : bouwTabel(rapport, invoer)),
    [rapport, invoer]
  );

  const exporteer = () => {
    if (!tabel) return;
    const csv = naarCsv(tabel.kolommen, tabel.rijen.map((rij) => rij.map((cel) => cel.ruw)));
    // BOM zodat Excel de accenten in klant- en plaatsnamen goed leest.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sharzi-${rapport}-${periode.van}_${periode.tot}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="uren-main rapportage">
      <div className="rap-balk">
        <div className="rap-periodes">
          {PERIODES.map((p) => (
            <button
              key={p}
              className={`dagkiezer-tab${p === keuze ? " actief" : ""}`}
              onClick={() => setKeuze(p)}
            >
              {t(`rapport.periode.${p}`)}
            </button>
          ))}
        </div>
        <div className="rap-bereik">
          {datumDagKort(`${periode.van}T12:00:00Z`)} — {datumDagKort(`${periode.tot}T12:00:00Z`)}
        </div>
        <button className="btn knop-met-icoon rap-export" onClick={exporteer} disabled={!tabel || tabel.rijen.length === 0}>
          <Icoon naam="document" maat={14} /> {t("rapport.export")}
        </button>
      </div>

      <div className="rap-tabs">
        {RAPPORTEN.map((r) => (
          <button
            key={r}
            className={`rap-tab${r === rapport ? " actief" : ""}`}
            onClick={() => setRapport(r)}
          >
            {t(`rapport.naam.${r}`)}
          </button>
        ))}
      </div>

      {tabel === null ? (
        <DashboardView state={state} nu={nu} />
      ) : (
      <div className="ph-card rap-kaart">
        <h4 className="zij-kop">{t(`rapport.naam.${rapport}`)}</h4>
        <p className="rap-uitleg">{t(`rapport.uitleg.${rapport}`)}</p>
        {tabel.rijen.length === 0 ? (
          <p className="kaart-kies">{tabel.leeg}</p>
        ) : (
          <div className="rap-tabelwrap">
            <table className="rap-tabel">
              <thead>
                <tr>
                  {tabel.kolommen.map((kolom, i) => (
                    <th key={kolom} className={i === 0 ? "" : "num"}>{kolom}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabel.rijen.map((rij, i) => (
                  <tr key={i}>
                    {rij.map((cel, j) => (
                      <td key={j} className={`${cel.getal ? "num" : ""}${cel.let ? " let" : ""}`}>
                        {cel.tekst}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {tabel.totaal && (
                <tfoot>
                  <tr>
                    {tabel.totaal.map((cel, j) => (
                      <td key={j} className={cel.getal ? "num" : ""}>{cel.tekst}</td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      )}
      <p className="uren-noot">{t("rapport.noot")}</p>
    </div>
  );
}

/**
 * Zet de app-state om in de platte invoer die het domein verwacht. Kilometers
 * komen uit de kaartsimulatie; zodra de boordcomputer gekoppeld is levert die
 * connector dezelfde vorm aan.
 */
function bouwInvoer(state: AppState, periode: Periode): RapportInvoer {
  const kilometersPerRit: Record<string, number> = {};
  for (const rit of state.ritten) kilometersPerRit[rit.id] = kmVandaag(state, rit.id);

  const omzetPerZendingCenten: Record<string, number> = {};
  for (const zending of Object.values(state.zendingen)) {
    const order = state.orders[zending.orderId];
    const tarief = order ? state.tarieven[order.opdrachtgever] : undefined;
    omzetPerZendingCenten[zending.id] = tariefVoorZending(zending, tarief).bedragCenten;
  }

  return {
    periode,
    ritten: state.ritten,
    taken: state.taken,
    events: state.events,
    zendingen: state.zendingen,
    orders: state.orders,
    kilometersPerRit,
    omzetPerZendingCenten,
  };
}

function bouwTabel(naam: Exclude<RapportNaam, "overzicht">, invoer: RapportInvoer): Tabel {
  const leeg = t("rapport.leeg");
  switch (naam) {
    case "opdrachtgever": {
      const regels = perOpdrachtgever(invoer);
      const som = (kies: (r: (typeof regels)[number]) => number) => regels.reduce((a, r) => a + kies(r), 0);
      return {
        leeg,
        kolommen: [
          t("rapport.kol.opdrachtgever"), t("rapport.kol.orders"), t("rapport.kol.zendingen"),
          t("rapport.kol.laadmeters"), t("rapport.kol.gewicht"), t("rapport.kol.stops"),
          t("rapport.kol.punctualiteit"), t("rapport.kol.omzet"),
        ],
        rijen: regels.map((r) => [
          tekst(r.opdrachtgever), getal(r.orders), getal(r.zendingen),
          getal(r.laadmeters, 1), getal(r.gewichtKg), getal(r.stops),
          pct(r.punctualiteitPct),
          { tekst: formatteerGeld(r.omzet), ruw: r.omzet.bedragCenten / 100, getal: true },
        ]),
        totaal: [
          tekst(t("rapport.totaal")), getal(som((r) => r.orders)), getal(som((r) => r.zendingen)),
          getal(Math.round(som((r) => r.laadmeters) * 10) / 10, 1), getal(som((r) => r.gewichtKg)),
          getal(som((r) => r.stops)), { tekst: "", ruw: null },
          { tekst: formatteerGeld({ bedragCenten: som((r) => r.omzet.bedragCenten), valuta: "EUR" }), ruw: null, getal: true },
        ],
      };
    }
    case "chauffeur": {
      const regels = perChauffeur(invoer);
      const som = (kies: (r: (typeof regels)[number]) => number) => regels.reduce((a, r) => a + kies(r), 0);
      return {
        leeg,
        kolommen: [
          t("rapport.kol.chauffeur"), t("rapport.kol.ritten"), t("rapport.kol.dagen"),
          t("rapport.kol.stops"), t("rapport.kol.afgerond"), t("rapport.kol.problemen"),
          t("rapport.kol.punctualiteit"), t("rapport.kol.km"),
        ],
        rijen: regels.map((r) => [
          tekst(r.chauffeur), getal(r.ritten), getal(r.gewerkteDagen), getal(r.stops),
          getal(r.stopsAfgerond),
          { tekst: String(r.stopsMetProbleem), ruw: r.stopsMetProbleem, getal: true, let: r.stopsMetProbleem > 0 },
          pct(r.punctualiteitPct), getal(r.kilometers),
        ]),
        totaal: [
          tekst(t("rapport.totaal")), getal(som((r) => r.ritten)), { tekst: "", ruw: null },
          getal(som((r) => r.stops)), getal(som((r) => r.stopsAfgerond)),
          getal(som((r) => r.stopsMetProbleem)), { tekst: "", ruw: null }, getal(som((r) => r.kilometers)),
        ],
      };
    }
    case "voertuig": {
      const regels = perVoertuig(invoer);
      const som = (kies: (r: (typeof regels)[number]) => number) => regels.reduce((a, r) => a + kies(r), 0);
      return {
        leeg,
        kolommen: [
          t("rapport.kol.kenteken"), t("rapport.kol.voertuig"), t("rapport.kol.ritten"),
          t("rapport.kol.km"), t("rapport.kol.capaciteit"), t("rapport.kol.geladen"),
          t("rapport.kol.benutting"),
        ],
        rijen: regels.map((r) => [
          tekst(formatteerKenteken({ landcode: r.landcode, kenteken: r.kentekenGenormaliseerd })),
          tekst(r.omschrijving), getal(r.ritten), getal(r.kilometers),
          getal(r.capaciteitLaadmeters, 1), getal(r.geladenLaadmeters, 1),
          pct(r.benuttingPct, 60),
        ]),
        totaal: [
          tekst(t("rapport.totaal")), { tekst: "", ruw: null }, getal(som((r) => r.ritten)),
          getal(som((r) => r.kilometers)), { tekst: "", ruw: null },
          getal(Math.round(som((r) => r.geladenLaadmeters) * 10) / 10, 1), { tekst: "", ruw: null },
        ],
      };
    }
    case "adres": {
      const regels = perAdres(invoer);
      return {
        leeg,
        kolommen: [
          t("rapport.kol.adres"), t("rapport.kol.plaats"), t("rapport.kol.stops"),
          t("rapport.kol.metVenster"), t("rapport.kol.teLaat"), t("rapport.kol.punctualiteit"),
          t("rapport.kol.gemiddeldTeLaat"), t("rapport.kol.ergste"),
        ],
        rijen: regels.map((r) => [
          tekst(r.naam), tekst(r.plaats), getal(r.stops), getal(r.metVenster),
          { tekst: String(r.teLaat), ruw: r.teLaat, getal: true, let: r.teLaat > 0 },
          pct(r.punctualiteitPct), minuten(r.gemiddeldTeLaatMinuten), minuten(r.ergsteTeLaatMinuten),
        ]),
      };
    }
    case "dag": {
      const regels = perDag(invoer);
      const som = (kies: (r: (typeof regels)[number]) => number) => regels.reduce((a, r) => a + kies(r), 0);
      return {
        leeg,
        kolommen: [
          t("rapport.kol.dag"), t("rapport.kol.ritten"), t("rapport.kol.stops"),
          t("rapport.kol.afgerond"), t("rapport.kol.km"),
        ],
        rijen: regels.map((r) => [
          tekst(datumDagKort(`${r.datum}T12:00:00Z`)), getal(r.ritten), getal(r.stops),
          getal(r.stopsAfgerond), getal(r.kilometers),
        ]),
        totaal: [
          tekst(t("rapport.totaal")), getal(som((r) => r.ritten)), getal(som((r) => r.stops)),
          getal(som((r) => r.stopsAfgerond)), getal(som((r) => r.kilometers)),
        ],
      };
    }
  }
}
