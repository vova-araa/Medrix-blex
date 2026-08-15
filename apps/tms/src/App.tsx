import {
  kanInplannen,
  type DockEventType, type EmballageSoort, type Order, type Taak, type TaakEvent,
  type TaakEventType, type WerktijdEventType, type Zending,
} from "@sharzi/domain";
import { useEffect, useReducer, useRef, useState } from "react";
import { Assistent } from "./components/Assistent";
import { BedrijfView } from "./components/BedrijfView";
import { ChauffeurView } from "./components/ChauffeurView";
import { DashboardView } from "./components/DashboardView";
import { DetailPaneel } from "./components/DetailPaneel";
import { DockView } from "./components/DockView";
import { DocumentenView } from "./components/DocumentenView";
import { EmballageView } from "./components/EmballageView";
import { FacturenView } from "./components/FacturenView";
import { Icoon } from "./components/Icoon";
import { KaartView } from "./components/KaartView";
import { KlantenView } from "./components/KlantenView";
import { ModulesView } from "./components/ModulesView";
import { NieuweOrder } from "./components/NieuweOrder";
import { OperatieView } from "./components/OperatieView";
import { PortaalView } from "./components/PortaalView";
import { UrenView } from "./components/UrenView";
import { WagenparkView } from "./components/WagenparkView";
import type { AdresFoto, CmrSoort, Klant, Tarief } from "./data/bron";
import { meldingen } from "./data/meldingen";
import { MockDataBron } from "./data/mock";
import { MODULES, type ModuleId } from "./data/modules";
import {
  actieveTakenVanRit,
  gebruikteLaadmeters,
  leegState,
  reducer,
  rijtijdVan,
  statusVanTaak,
  takenVanRit,
} from "./data/state";
import { geschatteRijMinuten } from "./kaart/simulatie";
import { statusLabel, t } from "./i18n";
import { laadmeters } from "./utils";

const TENANT = "blex";
const bron = new MockDataBron();

// De demodag heeft een gesimuleerde klok die live doorloopt (1 min per 2 s),
// zodat posities en ETA's bewegen. Met echte data wordt dit gewoon de klok.
const SIM_START = Date.parse("2026-08-07T08:42:00Z");

type Tab = ModuleId | "modules";

export default function App() {
  const [state, dispatch] = useReducer(reducer, leegState);
  const [rol, setRol] = useState<"bedrijf" | "chauffeur" | "dock">("bedrijf");
  const [tab, setTab] = useState<Tab>("planbord");
  const [actieveChauffeur, setActieveChauffeur] = useState("J. Peeters");
  const [geselecteerdeTaak, setGeselecteerdeTaak] = useState<string | null>(null);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [simMs, setSimMs] = useState(SIM_START);
  const toastTimer = useRef<number | undefined>(undefined);

  const nu = new Date(simMs).toISOString();

  const tabModules = MODULES.filter(
    (m) => m.tab && state.actieveModules.includes(m.id)
  );
  const effectieveTab: Tab =
    tab === "modules" || tabModules.some((m) => m.id === tab) ? tab : "planbord";

  useEffect(() => {
    bron.laadDag("2026-08-07").then((snapshot) => dispatch({ type: "dag_geladen", snapshot }));
    const timer = window.setInterval(() => setSimMs((ms) => ms + 60_000), 2000);
    return () => window.clearInterval(timer);
  }, []);

  function meld(bericht: string) {
    setToast(bericht);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }

  function planZending(zendingId: string, ritId: string) {
    const zending = state.zendingen[zendingId];
    const rit = state.ritten.find((r) => r.id === ritId);
    if (!zending || !rit) return;

    const cap = rit.voertuig.capaciteitLaadmeters;
    const gebruikt = gebruikteLaadmeters(state, ritId);
    if (gebruikt + zending.laadmeters > cap) {
      meld(t("toast.pastNiet", {
        lm: laadmeters(zending.laadmeters),
        cap: laadmeters(cap),
        kenteken: rit.voertuig.kentekenGenormaliseerd,
      }));
      return;
    }

    // Rij- en rusttijdencontrole (EU 561/2006): past deze extra rit nog
    // binnen de dag- en weekrijtijd van de chauffeur?
    if (rit.chauffeur) {
      const actief = actieveTakenVanRit(state, ritId);
      const laatstePlaats = actief.length
        ? actief[actief.length - 1].adres.plaats
        : "Venlo";
      const extraMinuten = geschatteRijMinuten(laatstePlaats, zending.naar.plaats);
      const rijtijd = rijtijdVan(state, rit.chauffeur, nu);
      const controle = kanInplannen(rijtijd, extraMinuten);
      if (!controle.kan) {
        const reden = controle.redenen
          .map((r) => t(`rijtijd.reden.${r}`))
          .join(" én ");
        meld(t("toast.rijtijdBlokkade", {
          chauffeur: rit.chauffeur,
          minuten: extraMinuten,
          reden,
          dagOver: rijtijd.dagResterendMinuten,
          weekOver: Math.floor(rijtijd.weekResterendMinuten / 60) + ":" + String(rijtijd.weekResterendMinuten % 60).padStart(2, "0"),
        }));
        return;
      }
    }

    const bestaand = takenVanRit(state, ritId);
    const laatsteEind = bestaand.length
      ? Math.max(...bestaand.map((tk) => Date.parse(tk.geplandTot)))
      : simMs;
    const start = new Date(Math.max(laatsteEind, simMs) + 30 * 60_000);
    const eind = new Date(start.getTime() + 45 * 60_000);

    // Client genereert UUID's (CLAUDE.md §7.2) — nooit wachten op een server-id.
    const taak: Taak = {
      id: crypto.randomUUID(),
      tenantId: TENANT,
      ritId,
      soort: "lossen",
      adres: zending.naar,
      zendingId,
      geplandVan: start.toISOString(),
      geplandTot: eind.toISOString(),
    };
    const event: TaakEvent = {
      id: crypto.randomUUID(),
      tenantId: TENANT,
      taakId: taak.id,
      type: "taak_aangemaakt",
      tijdstip: nu,
      wie: "planning",
      apparaat: "tms-web",
    };
    dispatch({ type: "plan_zending", zendingId, taak, event });
    meld(t("toast.gepland", {
      zending: zending.barcode,
      rit: rit.id,
      kenteken: rit.voertuig.kentekenGenormaliseerd,
    }));
  }

  function registreer(taakId: string, type: TaakEventType, wie: string, apparaat: string) {
    const event: TaakEvent = {
      id: crypto.randomUUID(),
      tenantId: TENANT,
      taakId,
      type,
      tijdstip: nu,
      wie,
      apparaat,
    };
    dispatch({ type: "registreer", event });
    if (state.offline) {
      meld(t("toast.outbox", { event: t(`event.${type}`) }));
    } else {
      const na = statusVanTaak({ ...state, events: [...state.events, event] }, taakId);
      meld(t("toast.geregistreerd", { event: t(`event.${type}`), status: statusLabel(na) }));
    }
  }

  function registreerAlsChauffeur(taakId: string, type: TaakEventType) {
    registreer(taakId, type, actieveChauffeur, "mobile");
  }

  function simuleerVanuitPlanning(taakId: string, type: TaakEventType) {
    const taak = state.taken.find((tk) => tk.id === taakId);
    const rit = taak && state.ritten.find((r) => r.id === taak.ritId);
    registreer(taakId, type, rit?.chauffeur || "planning", "tms-web");
  }

  function werktijdEvent(type: WerktijdEventType) {
    dispatch({
      type: "werktijd_event",
      event: {
        id: crypto.randomUUID(),
        tenantId: TENANT,
        chauffeur: actieveChauffeur,
        type,
        tijdstip: nu,
      },
    });
    meld(t("toast.klok", { actie: t(`klok.event.${type}`) }));
  }

  function zetOffline(offline: boolean) {
    if (!offline && state.outbox > 0) {
      meld(t("toast.gesynct", { aantal: state.outbox }));
    }
    dispatch({ type: "zet_offline", offline });
  }

  function nieuweOrder(order: Order, zending: Zending) {
    dispatch({ type: "nieuwe_order", order, zending });
    setOrderFormOpen(false);
    meld(t("toast.orderAangemaakt", { zending: zending.barcode, opdrachtgever: order.opdrachtgever }));
  }

  function zetTarief(opdrachtgever: string, tarief: Tarief) {
    dispatch({ type: "zet_tarief", opdrachtgever, tarief });
  }

  function zetModule(module: ModuleId, actief: boolean) {
    dispatch({ type: "zet_module", module, actief });
    meld(t(actief ? "toast.moduleAan" : "toast.moduleUit", { module: t(`module.${module}.naam`) }));
  }

  function nieuweKlant(klant: Klant, tarief: Tarief) {
    dispatch({ type: "nieuwe_klant", klant, tarief });
    meld(t("toast.klantAangemaakt", { klant: klant.naam }));
  }

  function cmrRegistreer(taakId: string, soort: CmrSoort, nummer: string, lading?: string) {
    const taak = state.taken.find((tk) => tk.id === taakId);
    if (!taak) return;
    dispatch({
      type: "cmr_registreer",
      cmr: {
        id: crypto.randomUUID(),
        tenantId: TENANT,
        taakId,
        ritId: taak.ritId,
        zendingId: taak.zendingId,
        soort, nummer, lading,
        tijdstip: nu,
        wie: actieveChauffeur,
      },
    });
    meld(t("toast.cmr", { nummer }));
  }

  function nulCmr(taakId: string) {
    const taak = state.taken.find((tk) => tk.id === taakId);
    if (!taak) return;
    dispatch({
      type: "cmr_registreer",
      cmr: {
        id: crypto.randomUUID(),
        tenantId: TENANT,
        taakId,
        ritId: taak.ritId,
        zendingId: taak.zendingId,
        soort: "nul",
        nummer: "0-CMR",
        tijdstip: nu,
        wie: actieveChauffeur,
      },
    });
    // 0-CMR: geen lading — de laadtaak én de bijbehorende losstop vervallen,
    // als events, zodat de planner precies ziet wat er gebeurd is.
    const teVervallen = [
      taak,
      ...state.taken.filter(
        (tk) => tk.soort === "lossen" && tk.zendingId && tk.zendingId === taak.zendingId && tk.id !== taakId
      ),
    ];
    for (const tk of teVervallen) {
      dispatch({
        type: "registreer",
        event: {
          id: crypto.randomUUID(),
          tenantId: TENANT,
          taakId: tk.id,
          type: "vervallen",
          tijdstip: nu,
          wie: actieveChauffeur,
          apparaat: "mobile",
        },
      });
    }
    meld(t("toast.nulCmr"));
  }

  function zetTrailer(ritId: string, kenteken: string) {
    dispatch({ type: "zet_trailer", ritId, kenteken });
    meld(kenteken ? t("toast.trailer", { kenteken }) : t("toast.trailerLos"));
  }

  function ritKm(ritId: string, veld: "start" | "eind", waarde: number) {
    dispatch({ type: "rit_km", ritId, veld, waarde });
    meld(t(veld === "start" ? "toast.kmStart" : "toast.kmEind", { km: waarde.toLocaleString("nl-NL") }));
  }

  function dockEvent(zendingId: string, type: DockEventType, locatie?: string) {
    dispatch({
      type: "dock_event",
      event: {
        id: crypto.randomUUID(),
        tenantId: TENANT,
        zendingId, type, locatie,
        tijdstip: nu,
        wie: "F. Janssen",
        apparaat: "dock-scanner",
      },
    });
    meld(t("toast.dock", { event: t(`dock.event.${type}`), zending: zendingId }));
  }

  function registreerEmballage(taakId: string, soort: EmballageSoort, geleverd: number, retour: number) {
    const taak = state.taken.find((tk) => tk.id === taakId);
    if (!taak) return;
    const zending = taak.zendingId ? state.zendingen[taak.zendingId] : undefined;
    const klant = zending
      ? state.orders[zending.orderId]?.opdrachtgever ?? taak.adres.naam
      : taak.adres.naam;
    dispatch({
      type: "emballage_transactie",
      transactie: {
        id: crypto.randomUUID(),
        tenantId: TENANT,
        klant, soort, geleverd, retour,
        tijdstip: nu,
        ritId: taak.ritId,
        wie: actieveChauffeur,
      },
    });
    meld(t("toast.emballage", { klant }));
  }

  const assistentActief = state.actieveModules.includes("assistent");
  const aantalMeldingen = meldingen(state, nu).length;

  return (
    <div>
      <div className="proto-banner">{t("banner.mock")}</div>
      <div className="topbar">
        <div className="brand"><span className="mark">S</span> {t("app.naam")}</div>
        <div className="role-switch" role="tablist">
          <button className={rol === "bedrijf" ? "active" : ""} onClick={() => setRol("bedrijf")}>
            <Icoon naam="bedrijf" maat={14} /> {t("rol.bedrijf")}
          </button>
          <button className={rol === "chauffeur" ? "active" : ""} onClick={() => setRol("chauffeur")}>
            <Icoon naam="truck" maat={14} /> {t("rol.chauffeur")}
          </button>
          {state.actieveModules.includes("dock") && (
            <button className={rol === "dock" ? "active" : ""} onClick={() => setRol("dock")}>
              <Icoon naam="dock" maat={14} /> {t("rol.dock")}
            </button>
          )}
        </div>
        {rol === "bedrijf" && (
          <nav className="sub-tabs">
            {tabModules.map((moduleDef) => (
              <button
                key={moduleDef.id}
                className={effectieveTab === moduleDef.id ? "active" : ""}
                onClick={() => setTab(moduleDef.id)}
              >
                <Icoon naam={moduleDef.icoon} maat={13} /> {t(`module.${moduleDef.id}.naam`)}
                {moduleDef.id === "operatie" && aantalMeldingen > 0 && (
                  <span className="nav-badge">{aantalMeldingen}</span>
                )}
              </button>
            ))}
            <button
              className={`modules-tab${effectieveTab === "modules" ? " active" : ""}`}
              onClick={() => setTab("modules")}
            >
              <Icoon naam="modules" maat={13} /> {t("nav.modules")}
            </button>
          </nav>
        )}
        <div className="spacer" />
        {rol === "bedrijf" && (
          <button className="btn primary knop-met-icoon" onClick={() => setOrderFormOpen(true)}>
            <Icoon naam="plus" maat={14} /> {t("order.knop")}
          </button>
        )}
        <span className="date">
          {new Intl.DateTimeFormat("nl-NL", {
            weekday: "short", day: "numeric", month: "short",
            hour: "2-digit", minute: "2-digit",
            timeZone: "Europe/Amsterdam",
          }).format(new Date(simMs))}
        </span>
      </div>

      {rol === "bedrijf" && effectieveTab === "planbord" && (
        <BedrijfView
          state={state}
          nu={nu}
          onPlanZending={planZending}
          onSelecteerTaak={setGeselecteerdeTaak}
        />
      )}
      {rol === "bedrijf" && effectieveTab === "operatie" && <OperatieView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "klanten" && (
        <KlantenView state={state} onNieuweKlant={nieuweKlant} />
      )}
      {rol === "bedrijf" && effectieveTab === "kaart" && <KaartView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "uren" && <UrenView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "facturen" && (
        <FacturenView state={state} onZetTarief={zetTarief} />
      )}
      {rol === "bedrijf" && effectieveTab === "emballage" && <EmballageView state={state} />}
      {rol === "bedrijf" && effectieveTab === "portaal" && (
        <PortaalView state={state} nu={nu} onAfspraak={() => meld(t("toast.afspraak"))} />
      )}
      {rol === "bedrijf" && effectieveTab === "wagenpark" && <WagenparkView state={state} nu={nu} onZetTrailer={zetTrailer} />}
      {rol === "bedrijf" && effectieveTab === "documenten" && <DocumentenView state={state} />}
      {rol === "bedrijf" && effectieveTab === "rapportage" && <DashboardView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "modules" && (
        <ModulesView state={state} onZetModule={zetModule} />
      )}

      {rol === "chauffeur" && (
        <ChauffeurView
          state={state}
          nu={nu}
          actieveChauffeur={actieveChauffeur}
          onKiesChauffeur={setActieveChauffeur}
          onRegistreer={registreerAlsChauffeur}
          onWerktijdEvent={werktijdEvent}
          onZetOffline={zetOffline}
          onEmballage={registreerEmballage}
          onCmr={cmrRegistreer}
          onNulCmr={nulCmr}
          onZetTrailer={zetTrailer}
          onRitKm={ritKm}
        />
      )}

      {rol === "dock" && <DockView state={state} onDockEvent={dockEvent} />}

      {geselecteerdeTaak && (
        <DetailPaneel
          state={state}
          taakId={geselecteerdeTaak}
          onSluit={() => setGeselecteerdeTaak(null)}
          onSimuleer={simuleerVanuitPlanning}
          onZetInstructies={(sleutel, instructies) => {
            dispatch({ type: "adres_instructies", sleutel, instructies });
            meld(t("toast.adresOpgeslagen"));
          }}
          onVoegFotoToe={(sleutel, foto: AdresFoto) => {
            dispatch({ type: "adres_foto", sleutel, foto });
            meld(t("toast.fotoToegevoegd"));
          }}
        />
      )}

      {orderFormOpen && (
        <NieuweOrder state={state} onSluit={() => setOrderFormOpen(false)} onAanmaken={nieuweOrder} />
      )}

      {rol === "bedrijf" && assistentActief && <Assistent state={state} nu={nu} />}

      {toast && <div className="toast show" role="status">{toast}</div>}
    </div>
  );
}
