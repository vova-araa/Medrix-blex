import type { Taak, TaakEvent, TaakEventType } from "@sharzi/domain";
import { useEffect, useReducer, useRef, useState } from "react";
import { BedrijfView } from "./components/BedrijfView";
import { ChauffeurView } from "./components/ChauffeurView";
import { DetailPaneel } from "./components/DetailPaneel";
import { MockDataBron } from "./data/mock";
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, leegState);
  const [rol, setRol] = useState<"bedrijf" | "chauffeur">("bedrijf");
  const [actieveChauffeur, setActieveChauffeur] = useState("J. Peeters");
  const [geselecteerdeTaak, setGeselecteerdeTaak] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    bron.laadDag("2026-08-07").then((snapshot) => dispatch({ type: "dag_geladen", snapshot }));
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
      : Date.now();
    const start = new Date(Math.max(laatsteEind, Date.now()) + 30 * 60_000);
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
      tijdstip: new Date().toISOString(),
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
      tijdstip: new Date().toISOString(),
      wie,
      apparaat,
    };
    dispatch({ type: "registreer", event });
    if (state.offline) {
      meld(t("toast.outbox", { event: t(`event.${type}`) }));
    } else {
      // Status na dit event: het event zelf bepaalt de nieuwe status.
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

  function zetOffline(offline: boolean) {
    if (!offline && state.outbox > 0) {
      meld(t("toast.gesynct", { aantal: state.outbox }));
    }
    dispatch({ type: "zet_offline", offline });
  }

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
        <div className="spacer" />
        <span className="date">
          {new Intl.DateTimeFormat("nl-NL", {
            weekday: "short", day: "numeric", month: "short", year: "numeric",
            timeZone: "Europe/Amsterdam",
          }).format(new Date("2026-08-07T10:00:00Z"))}
        </span>
      </div>

      {rol === "bedrijf" ? (
        <BedrijfView
          state={state}
          onPlanZending={planZending}
          onSelecteerTaak={setGeselecteerdeTaak}
        />
      ) : (
        <ChauffeurView
          state={state}
          actieveChauffeur={actieveChauffeur}
          onKiesChauffeur={setActieveChauffeur}
          onRegistreer={registreerAlsChauffeur}
          onZetOffline={zetOffline}
        />
      )}

      {geselecteerdeTaak && (
        <DetailPaneel
          state={state}
          taakId={geselecteerdeTaak}
          onSluit={() => setGeselecteerdeTaak(null)}
          onSimuleer={simuleerVanuitPlanning}
        />
      )}

      {toast && <div className="toast show" role="status">{toast}</div>}
    </div>
  );
}
