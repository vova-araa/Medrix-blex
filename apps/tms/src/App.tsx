import {
  achterstallig,
  automatischPlan,
  formatteerGeld,
  kanInplannen,
  lokaalTijdstipMs,
  maakCreditnota,
  sjabloonVan,
  totalenVan,
  vervaldatum,
  volgendFactuurnummer,
  vulSjabloon,
  hertijden,
  verplaatsStop,
  type Factuur,
  type DockEventType, type EmballageSoort, type Order, type PlanResultaat, type VervangResultaat,
  type PlanVoorstel, type Taak, type TaakEvent,
  type TaakEventType, type WerktijdEventType, type Zending,
} from "@sharzi/domain";
import { useEffect, useReducer, useRef, useState } from "react";
import { Assistent } from "./components/Assistent";
import { AutoPlanView } from "./components/AutoPlanView";
import { BedrijfView } from "./components/BedrijfView";
import { BerichtenView, type MailConcept } from "./components/BerichtenView";
import { KoppelingenView } from "./components/KoppelingenView";
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
import { Zijbalk } from "./components/Zijbalk";
import type { AdresFoto, CmrSoort, Klant, Tarief } from "./data/bron";
import { benodigdeBerichten, type BerichtVoorstel } from "./data/communicatie";
import { conceptFacturen } from "./data/facturen";
import { leertijdVoorPlaats } from "./data/leertijden";
import { herstelVoorstellen, type HerstelVoorstel } from "./data/herstel";
import { vervangingVoorRit } from "./data/uitval";
import { VervangingView } from "./components/VervangingView";
import type { KoppelingDef } from "./data/koppelingen";
import { meldingen } from "./data/meldingen";
import { planKandidaten, planOpties } from "./data/planner";
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
  type BeleidActie,
  type BeleidStand,
} from "./data/state";
import { geschatteRijMinuten } from "./kaart/simulatie";
import { statusLabel, t, zetTaal, type Taal } from "./i18n";
import { datumKort, laadmeters } from "./utils";

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
  const [autoPlanResultaat, setAutoPlanResultaat] = useState<PlanResultaat | null>(null);
  const [mailConcept, setMailConcept] = useState<MailConcept | null>(null);
  const [uitval, setUitval] = useState<{ ritId: string; chauffeur: string; resultaat: VervangResultaat } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [zijbalkIn, setZijbalkIn] = useState(false);
  const [planDatum, setPlanDatum] = useState("2026-08-07");
  // De taal staat in de state, niet alleen in de i18n-module: anders
  // hertekent alleen de taalkiezer en blijft de rest van de app staan.
  const [huidigeTaal, setHuidigeTaal] = useState<Taal>("nl");
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

  // Stap 2/3: staat het beleid voor klantberichten op "automatisch", dan
  // verstuurt de automaat ETA-berichten zodra een levering uitloopt. De
  // 10-minutendrempel in benodigdeBerichten voorkomt herhaalberichten.
  useEffect(() => {
    if (state.beleid.klantbericht !== "automatisch") return;
    for (const voorstel of benodigdeBerichten(state, nu)) leverKlantbericht(voorstel, "automaat");
  }, [state, nu]);

  // Staat herplannen op "automatisch", dan voert de automaat het eerste
  // herstelvoorstel direct uit; de rest volgt vanzelf op de volgende tik.
  useEffect(() => {
    if (state.beleid.herplannen !== "automatisch") return;
    const [eerste] = herstelVoorstellen(state, nu);
    if (eerste) voerHerstelUit(eerste);
  }, [state, nu]);

  // Demo van inkomende mail: op een verstuurd bericht volgt na een paar
  // gesimuleerde minuten een antwoord van de tegenpartij. Met echte data
  // komt dit binnen via de e-mailkoppeling in plaats van deze simulatie.
  useEffect(() => {
    for (const thread of state.mailThreads) {
      const laatste = thread.berichten.at(-1);
      if (!laatste || laatste.richting !== "uit") continue;
      if (simMs - Date.parse(laatste.tijdstip) < 3 * 60_000) continue;
      dispatch({ type: "mail_bericht", threadId: thread.id, bericht: {
        id: crypto.randomUUID(),
        richting: "in",
        tekst: t("mail.demoAntwoord"),
        tijdstip: nu,
        wie: state.klanten[thread.tegenpartij]?.contactpersoon ?? thread.tegenpartij,
      }});
    }
  }, [state, nu, simMs]);

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

    // Een lege rit van morgen begint niet "over een half uur" maar op zijn eigen
    // dag: de basis is 06:00 lokaal op de ritdatum, of nu als die al voorbij is.
    const dagBasis = Math.max(simMs, lokaalTijdstipMs(rit.datum, 6));
    const bestaand = takenVanRit(state, ritId);
    const laatsteEind = bestaand.length
      ? Math.max(...bestaand.map((tk) => Date.parse(tk.geplandTot)))
      : dagBasis;
    const start = new Date(Math.max(laatsteEind, dagBasis) + 30 * 60_000);
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

  function startAutoPlan() {
    const opdrachten = state.ongepland.map((id) => {
      const zending = state.zendingen[id];
      return {
        id,
        laadmeters: zending.laadmeters,
        vanPlaats: zending.van.plaats,
        naarPlaats: zending.naar.plaats,
        vensterVan: zending.naar.tijdvenster?.van,
        vensterTot: zending.naar.tijdvenster?.tot,
      };
    });
    setAutoPlanResultaat(
      automatischPlan(opdrachten, planKandidaten(state, nu), planOpties(state, nu))
    );
  }

  // Herstel-lus (stap 1): verplaats een nog niet gestarte zending van een
  // vastgelopen rit naar de doelrit uit het voorstel. De oude taken krijgen
  // een vervallen-event (append-only); de nieuwe taken zet de automaat neer.
  function voerHerstelUit(herstel: HerstelVoorstel) {
    const zending = state.zendingen[herstel.zendingId];
    if (!zending) return;
    for (const taakId of herstel.taakIds) {
      dispatch({ type: "registreer", event: {
        id: crypto.randomUUID(), tenantId: TENANT, taakId,
        type: "vervallen", tijdstip: nu, wie: "automaat", apparaat: "tms-web",
      }});
    }
    const doelRitId = herstel.voorstel.ritId;
    const vanPlaats = actieveTakenVanRit(state, doelRitId).at(-1)?.adres.plaats ?? "Venlo";
    const aanrij = geschatteRijMinuten(vanPlaats, zending.van.plaats);
    const laadVanMs = Date.parse(herstel.voorstel.vertrekIso) + aanrij * 60_000;
    const aankomstMs = Date.parse(herstel.voorstel.aankomstIso);
    const nieuweTaak = (soort: Taak["soort"], adres: Zending["van"], vanMs: number): Taak => ({
      id: crypto.randomUUID(), tenantId: TENANT, ritId: doelRitId, soort, adres,
      zendingId: zending.id,
      geplandVan: new Date(vanMs).toISOString(),
      geplandTot: new Date(vanMs + 30 * 60_000).toISOString(),
    });
    for (const taak of [
      nieuweTaak("laden", zending.van, laadVanMs),
      nieuweTaak("lossen", zending.naar, aankomstMs),
    ]) {
      dispatch({ type: "plan_zending", zendingId: zending.id, taak, event: {
        id: crypto.randomUUID(), tenantId: TENANT, taakId: taak.id,
        type: "taak_aangemaakt", tijdstip: nu, wie: "automaat", apparaat: "tms-web",
      }});
    }
    meld(t("toast.herstel", { zending: zending.id, chauffeur: herstel.voorstel.chauffeur }));
  }

  function zetBeleid(actie: BeleidActie, stand: BeleidStand) {
    dispatch({ type: "zet_beleid", actie, stand });
  }

  // ── Berichtencentrum ──────────────────────────────────────────────────────
  function verstuurNieuweMail(
    tegenpartij: string, email: string, onderwerp: string, tekst: string, zendingId?: string
  ) {
    dispatch({ type: "mail_nieuw", thread: {
      id: crypto.randomUUID(), tegenpartij, email, onderwerp, zendingId,
      berichten: [{ id: crypto.randomUUID(), richting: "uit", tekst, tijdstip: nu, wie: t("mail.afzender") }],
    }});
    setMailConcept(null);
    logMail(t("koppeling.mailUit", { aan: tegenpartij }));
    meld(t("toast.mail", { aan: tegenpartij }));
  }

  function verstuurMailAntwoord(threadId: string, tekst: string) {
    dispatch({ type: "mail_bericht", threadId, bericht: {
      id: crypto.randomUUID(), richting: "uit", tekst, tijdstip: nu, wie: t("mail.afzender"),
    }});
    const thread = state.mailThreads.find((mt) => mt.id === threadId);
    if (thread) logMail(t("koppeling.mailUit", { aan: thread.tegenpartij }));
    meld(t("toast.mailAntwoord"));
  }

  function mailNaarKlant(klant: Klant) {
    setMailConcept({ tegenpartij: klant.naam, email: klant.email });
    setTab("berichten");
  }

  /** Mailen naar de ontvanger op een stop — adres komt uit de taak. */
  function mailNaarAdres(naam: string, email: string, zendingId?: string) {
    setMailConcept({ tegenpartij: naam, email, zendingId });
    setGeselecteerdeTaak(null);
    setTab("berichten");
  }

  // ── Koppelingen-hub ───────────────────────────────────────────────────────
  function replayKoppeling(logId: string) {
    const origineel = state.koppelingLog.find((regel) => regel.id === logId);
    if (!origineel) return;
    dispatch({ type: "koppeling_replay", logId, regel: {
      id: crypto.randomUUID(),
      koppelingId: origineel.koppelingId,
      richting: origineel.richting,
      omschrijving: t("koppeling.replayRegel", { omschrijving: origineel.omschrijving }),
      tijdstip: nu,
      status: "geslaagd",
    }});
    meld(t("toast.replay"));
  }

  /** Chauffeur valt uit: reken door wie de rit kan overnemen. */
  function meldUitval(ritId: string) {
    const rit = state.ritten.find((r) => r.id === ritId);
    const resultaat = vervangingVoorRit(state, ritId, nu);
    if (!rit || !resultaat) { meld(t("toast.geenUitval")); return; }
    setUitval({ ritId, chauffeur: rit.chauffeur, resultaat });
  }

  function kiesVervanger(chauffeur: string) {
    meld(t("toast.vervanger", { chauffeur, rit: uitval?.ritId ?? "" }));
    setUitval(null);
  }

  /**
   * Stop verplaatsen binnen een rit. De domeinregels blokkeren een volgorde
   * die niet uitvoerbaar is — lossen vóór laden, of een afgeronde stop
   * verschuiven — en daarna worden de tijden opnieuw berekend.
   */
  function verplaatsStopInRit(ritId: string, taakId: string, richting: "omhoog" | "omlaag") {
    const huidige = takenVanRit(state, ritId);
    const uit = verplaatsStop(huidige, taakId, richting, (id) => statusVanTaak(state, id));
    if (!uit.geldig) {
      const eerste = uit.fouten[0];
      meld(eerste ? t(`route.fout.${eerste.soort}`) : t("route.fout.rand"));
      return;
    }
    const eersteOpen = uit.taken.find((tk) => statusVanTaak(state, tk.id) !== "afgerond");
    const hertijd = hertijden(uit.taken, (id) => statusVanTaak(state, id), {
      startIso: eersteOpen
        ? new Date(Math.max(simMs, Date.parse(eersteOpen.geplandVan))).toISOString()
        : nu,
      reistijdMinuten: geschatteRijMinuten,
      handelingstijdMinuten: leertijdVoorPlaats(state),
    });
    dispatch({ type: "herorden", ritId, taken: hertijd });
    meld(t("toast.herordend"));
  }

  // ── Facturatie ────────────────────────────────────────────────────────────
  /** Conceptfactuur omzetten in een echte factuur met doorlopend nummer. */
  function maakFactuur(opdrachtgever: string) {
    const concept = conceptFacturen(state).find((c) => c.opdrachtgever === opdrachtgever);
    if (!concept) return;
    const jaar = Number(nu.slice(0, 4));
    const nummer = volgendFactuurnummer(
      state.facturen.flatMap((f) => (f.nummer ? [f.nummer] : [])),
      jaar
    );
    const klant = state.klanten[opdrachtgever];
    const factuur: Factuur = {
      nummer,
      tenantId: TENANT,
      ontvanger: {
        naam: opdrachtgever,
        adres: klant?.adres,
        postcodePlaats: klant?.postcodePlaats,
      },
      datumIso: nu,
      vervaldatumIso: vervaldatum(nu),
      regels: concept.regels,
      btwBehandeling: "standaard",
      status: "concept",
    };
    dispatch({ type: "factuur_opgemaakt", factuur });
    meld(t("toast.factuurOpgemaakt", { nummer, klant: opdrachtgever }));
  }

  /** Factuur versturen: gaat als mail met sjabloon naar het berichtencentrum. */
  function verstuurFactuur(nummer: string) {
    const factuur = state.facturen.find((f) => f.nummer === nummer);
    if (!factuur) return;
    const klant = state.klanten[factuur.ontvanger.naam];
    const totaal = formatteerGeld(totalenVan(factuur).totaal);
    const herinnering = factuur.status === "verstuurd";
    const post = achterstallig(state.facturen, nu).find((p) => p.nummer === nummer);

    const ingevuld = vulSjabloon(
      sjabloonVan(herinnering ? "betalingsherinnering" : "factuur_versturen"),
      {
        contactpersoon: klant?.contactpersoon,
        factuurnummer: nummer,
        datum: factuur.datumIso ? datumKort(factuur.datumIso) : "",
        totaal,
        vervaldatum: factuur.vervaldatumIso ? datumKort(factuur.vervaldatumIso) : "",
        dagenTeLaat: post?.dagenTeLaat,
        ons: state.uitgever.naam,
      }
    );

    dispatch({ type: "mail_nieuw", thread: {
      id: crypto.randomUUID(),
      tegenpartij: factuur.ontvanger.naam,
      email: klant?.email ?? "",
      onderwerp: ingevuld.onderwerp,
      berichten: [{
        id: crypto.randomUUID(), richting: "uit", tekst: ingevuld.tekst,
        tijdstip: nu, wie: t("mail.afzender"),
      }],
    }});
    logMail(t("koppeling.mailUit", { aan: factuur.ontvanger.naam }));
    if (!herinnering) dispatch({ type: "factuur_status", nummer, status: "verstuurd" });
    meld(t("toast.factuurVerstuurd", { nummer, klant: factuur.ontvanger.naam }));
  }

  function markeerBetaald(nummer: string) {
    dispatch({ type: "factuur_status", nummer, status: "betaald" });
    meld(t("toast.factuurBetaald", { nummer }));
  }

  function crediteerFactuur(nummer: string) {
    const origineel = state.facturen.find((f) => f.nummer === nummer);
    if (!origineel) return;
    const jaar = Number(nu.slice(0, 4));
    const creditNummer = volgendFactuurnummer(
      state.facturen.flatMap((f) => (f.nummer ? [f.nummer] : [])),
      jaar
    );
    dispatch({ type: "creditnota", factuur: maakCreditnota(origineel, creditNummer, nu) });
    meld(t("toast.creditnota", { nummer: creditNummer, origineel: nummer }));
  }

  /** Een gefaalde uitgaande aanroep opnieuw aanbieden. */
  function herstartWachtrij(itemId: string) {
    const item = state.wachtrij.find((w) => w.id === itemId);
    if (!item) return;
    dispatch({ type: "wachtrij_opgelost", itemId, nuIso: nu });
    dispatch({ type: "koppeling_log", regel: {
      id: crypto.randomUUID(), koppelingId: item.koppelingId, richting: "uit",
      omschrijving: t("wachtrij.herstartRegel", { actie: item.actie }),
      tijdstip: nu, status: "geslaagd",
    }});
    meld(t("toast.wachtrijHerstart"));
  }

  function vraagKoppelingAan(koppeling: KoppelingDef) {
    meld(t("toast.koppelingAanvraag", { naam: koppeling.naam }));
  }

  function verstuurBericht(voorstel: BerichtVoorstel) {
    leverKlantbericht(voorstel, "planner");
    meld(t("toast.bericht", { klant: voorstel.klant }));
  }

  // Eén inbox: een ETA-bericht wordt gelogd voor de driftbewaking, afgeleverd
  // als mail in het gesprek met die klant, en zichtbaar in het koppelingslog.
  function leverKlantbericht(voorstel: BerichtVoorstel, wie: "automaat" | "planner") {
    dispatch({ type: "klantbericht", bericht: {
      ...voorstel, id: crypto.randomUUID(), tijdstip: nu, wie,
    }});
    const afzender = wie === "automaat" ? t("mail.afzenderAutomaat") : t("mail.afzender");
    const bestaand = state.mailThreads.find(
      (thread) => thread.zendingId === voorstel.zendingId && thread.tegenpartij === voorstel.klant
    );
    if (bestaand) {
      dispatch({ type: "mail_bericht", threadId: bestaand.id, bericht: {
        id: crypto.randomUUID(), richting: "uit", tekst: voorstel.tekst, tijdstip: nu, wie: afzender,
      }});
    } else {
      dispatch({ type: "mail_nieuw", thread: {
        id: crypto.randomUUID(),
        tegenpartij: voorstel.klant,
        email: state.klanten[voorstel.klant]?.email ?? "",
        onderwerp: t("mail.etaOnderwerp", { zending: voorstel.zendingId }),
        zendingId: voorstel.zendingId,
        berichten: [{ id: crypto.randomUUID(), richting: "uit", tekst: voorstel.tekst, tijdstip: nu, wie: afzender }],
      }});
    }
    logMail(t("koppeling.mailUit", { aan: voorstel.klant }));
  }

  function logMail(omschrijving: string) {
    dispatch({ type: "koppeling_log", regel: {
      id: crypto.randomUUID(), koppelingId: "email", richting: "uit",
      omschrijving, tijdstip: nu, status: "geslaagd",
    }});
  }

  function accepteerAutoPlan(voorstellen: PlanVoorstel[]) {
    for (const voorstel of voorstellen) {
      const zending = state.zendingen[voorstel.opdrachtId];
      if (!zending) continue;
      const taak: Taak = {
        id: crypto.randomUUID(),
        tenantId: TENANT,
        ritId: voorstel.ritId,
        soort: "lossen",
        adres: zending.naar,
        zendingId: zending.id,
        geplandVan: voorstel.aankomstIso,
        geplandTot: new Date(Date.parse(voorstel.aankomstIso) + 30 * 60_000).toISOString(),
      };
      dispatch({ type: "plan_zending", zendingId: zending.id, taak, event: {
        id: crypto.randomUUID(),
        tenantId: TENANT,
        taakId: taak.id,
        type: "taak_aangemaakt",
        tijdstip: nu,
        wie: "autoplanner",
        apparaat: "tms-web",
      }});
    }
    setAutoPlanResultaat(null);
    meld(t("toast.autoplan", { aantal: voorstellen.length }));
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

      <div className={`werkblad${rol === "bedrijf" ? "" : " zonder-zijbalk"}`}>
        {rol === "bedrijf" && (
          <Zijbalk
            modules={tabModules}
            actief={effectieveTab}
            ingeklapt={zijbalkIn}
            aantalMeldingen={aantalMeldingen}
            ongelezenBerichten={state.mailThreads.filter((mt) => mt.ongelezen).length}
            onKies={setTab}
            onKlapIn={() => setZijbalkIn(!zijbalkIn)}
          />
        )}
        <main className="werkblad-inhoud">
      {rol === "bedrijf" && effectieveTab === "planbord" && (
        <BedrijfView
          state={state}
          nu={nu}
          onPlanZending={planZending}
          onSelecteerTaak={setGeselecteerdeTaak}
          onAutoPlan={startAutoPlan}
          onVerplaatsStop={verplaatsStopInRit}
          planDatum={planDatum}
          onZetPlanDatum={setPlanDatum}
        />
      )}
      {rol === "bedrijf" && effectieveTab === "operatie" && (
        <OperatieView
          state={state}
          nu={nu}
          onHerstel={voerHerstelUit}
          onZetBeleid={zetBeleid}
          onVerstuurBericht={verstuurBericht}
          onUitval={meldUitval}
        />
      )}
      {rol === "bedrijf" && effectieveTab === "klanten" && (
        <KlantenView state={state} onNieuweKlant={nieuweKlant} onMail={mailNaarKlant} />
      )}
      {rol === "bedrijf" && effectieveTab === "berichten" && (
        <BerichtenView
          key={mailConcept ? `c-${mailConcept.tegenpartij}` : "std"}
          state={state}
          concept={mailConcept}
          onNieuwThread={verstuurNieuweMail}
          onAntwoord={verstuurMailAntwoord}
          onGelezen={(threadId) => dispatch({ type: "mail_gelezen", threadId })}
        />
      )}
      {rol === "bedrijf" && effectieveTab === "koppelingen" && (
        <KoppelingenView state={state} nu={nu} onReplay={replayKoppeling} onAanvragen={vraagKoppelingAan} onHerstart={herstartWachtrij} />
      )}
      {rol === "bedrijf" && effectieveTab === "kaart" && <KaartView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "uren" && <UrenView state={state} nu={nu} />}
      {rol === "bedrijf" && effectieveTab === "facturen" && (
        <FacturenView
          state={state}
          nu={nu}
          onZetTarief={zetTarief}
          onMaakFactuur={maakFactuur}
          onVerstuurFactuur={verstuurFactuur}
          onMarkeerBetaald={markeerBetaald}
          onCrediteer={crediteerFactuur}
        />
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
          taal={huidigeTaal}
          onZetTaal={(nieuw) => { zetTaal(nieuw); setHuidigeTaal(nieuw); }}
        />
      )}

      {rol === "dock" && <DockView state={state} onDockEvent={dockEvent} />}
        </main>
      </div>

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
          onMailAdres={mailNaarAdres}
          onVoegFotoToe={(sleutel, foto: AdresFoto) => {
            dispatch({ type: "adres_foto", sleutel, foto });
            meld(t("toast.fotoToegevoegd"));
          }}
        />
      )}

      {uitval && (
        <VervangingView
          chauffeur={uitval.chauffeur}
          ritId={uitval.ritId}
          resultaat={uitval.resultaat}
          onSluit={() => setUitval(null)}
          onKies={kiesVervanger}
        />
      )}

      {autoPlanResultaat && (
        <AutoPlanView
          state={state}
          resultaat={autoPlanResultaat}
          onSluit={() => setAutoPlanResultaat(null)}
          onAccepteer={accepteerAutoPlan}
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
