import type {
  Order, Taak, TaakEvent, TaakEventType, WerktijdEventType, Zending,
} from "@sharzi/domain";
import { useEffect, useReducer, useRef, useState } from "react";
import { Assistent } from "./components/Assistent";
import { BedrijfView } from "./components/BedrijfView";
import { ChauffeurView } from "./components/ChauffeurView";
import { DashboardView } from "./components/DashboardView";
import { DetailPaneel } from "./components/DetailPaneel";
import { EmballageView } from "./components/EmballageView";
import { FacturenView } from "./components/FacturenView";
import { KaartView } from "./components/KaartView";
import { ModulesView } from "./components/ModulesView";
import { NieuweOrder } from "./components/NieuweOrder";
import { PortaalView } from "./components/PortaalView";
import { UrenView } from "./components/UrenView";
import { WagenparkView } from "./components/WagenparkView";
import type { AdresFoto, Tarief } from "./data/bron";
import { MockDataBron } from "./data/mock";
import { MODULES, type ModuleId } from "./data/modules";
import {
  gebruikteLaadmeters,
  leegState,
  reducer,
  statusVanTaak,
  takenVanRit,
} from "./data/state";
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
  const [rol, setRol] = useState<"bedrijf" | "chauffeur">("bedrijf");
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

  const assistentActief = state.actieveModules.includes("assistent");

  return (
    <div>
      <div className="proto-banner">{t("banner.mock")}</div>
      <div className="topbar">
        <div className="brand"><span className="mark">S</span> {t("app.naam")}</div>
        <div className="role-switch" role="tablist">
          <button className={rol === "bedrijf" ? "active" : ""} onClick={() => setRol("bedrijf")}>
            {t("rol.bedrijf")}
          </button>
          <button className={rol === "chauffeur" ? "active" : ""} onClick={() => setRol("chauffeur")}>
            {t("rol.chauffeur")}
          </button>
        </div>
        {rol === "bedrijf" && (
          <nav className="sub-tabs">
            {tabModules.map((moduleDef) => (
              <button
                key={moduleDef.id}
                className={effectieveTab === moduleDef.id ? "active" : ""}
                onClick={() => setTab(moduleDef.id)}
              >
                {t(`module.${moduleDef.id}.naam`)}
              </button>
            ))}
            <button
              className={`modules-tab${effectieveTab === "modules" ? " active" : ""}`}
              onClick={() => setTab("modules")}
            >
              {t("nav.modules")}
            </button>
          </nav>
        )}
        <div className="spacer" />
        {rol === "bedrijf" && (
          <button className="btn primary" onClick={() => setOrderFormOpen(true)}>
            {t("order.knop")}
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
      {rol === "bedrijf" && effectieveTab === "kaart" && <KaartView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "uren" && <UrenView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "facturen" && (
        <FacturenView state={state} onZetTarief={zetTarief} />
      )}
      {rol === "bedrijf" && effectieveTab === "emballage" && <EmballageView state={state} />}
      {rol === "bedrijf" && effectieveTab === "portaal" && (
        <PortaalView state={state} nu={nu} onAfspraak={() => meld(t("toast.afspraak"))} />
      )}
      {rol === "bedrijf" && effectieveTab === "wagenpark" && <WagenparkView state={state} nu={nu} />}
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
        />
      )}

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
