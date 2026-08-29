import {
  rijtijdStatus,
  ritStatus,
  weekStartMs,
  taakStatus,
  voegEventToe,
  type Adres,
  type DockEvent,
  type EmballageTransactie,
  type Order,
  type Rit,
  type RitStatus,
  type Taak,
  type TaakEvent,
  type RijtijdStatus,
  type TaakStatus,
  type WerktijdEvent,
  type Zending,
  type Factuur,
  type FactuurStatus,
} from "@sharzi/domain";
import {
  adresSleutel,
  type AdresFoto, type AdresInfo, type CmrRegistratie, type DagSnapshot, type Klant,
  type KoppelingLogRegel, type MailBericht, type MailThread, type Tarief,
} from "./bron";
import { STANDAARD_ACTIEF, type ModuleId } from "./modules";

// Beleid per actiesoort (stap 3 van de automatiseringsladder): de planner
// bepaalt per soort ingreep of de automaat zelf handelt, alleen voorstelt,
// of uit staat.
export type BeleidActie = "klantbericht" | "herplannen" | "wachturen";
export type BeleidStand = "automatisch" | "voorstel" | "uit";

export interface KlantBericht {
  id: string;
  klant: string;
  ritId: string;
  zendingId: string;
  etaIso: string;
  vertragingMin: number;
  tekst: string;
  tijdstip: string;
  wie: "automaat" | "planner";
}

export interface AppState extends DagSnapshot {
  offline: boolean;
  outbox: number;
  actieveModules: ModuleId[];
  beleid: Record<BeleidActie, BeleidStand>;
  berichten: KlantBericht[];
}

export type Actie =
  | { type: "dag_geladen"; snapshot: DagSnapshot }
  | { type: "plan_zending"; zendingId: string; taak: Taak; event: TaakEvent }
  | { type: "registreer"; event: TaakEvent }
  | { type: "zet_offline"; offline: boolean }
  | { type: "werktijd_event"; event: WerktijdEvent }
  | { type: "adres_instructies"; sleutel: string; instructies: string }
  | { type: "adres_foto"; sleutel: string; foto: AdresFoto }
  | { type: "nieuwe_order"; order: Order; zending: Zending }
  | { type: "zet_tarief"; opdrachtgever: string; tarief: Tarief }
  | { type: "zet_module"; module: ModuleId; actief: boolean }
  | { type: "emballage_transactie"; transactie: EmballageTransactie }
  | { type: "nieuwe_klant"; klant: Klant; tarief: Tarief }
  | { type: "dock_event"; event: DockEvent }
  | { type: "cmr_registreer"; cmr: CmrRegistratie }
  | { type: "zet_trailer"; ritId: string; kenteken: string }
  | { type: "rit_km"; ritId: string; veld: "start" | "eind"; waarde: number }
  | { type: "zet_beleid"; actie: BeleidActie; stand: BeleidStand }
  | { type: "klantbericht"; bericht: KlantBericht }
  | { type: "mail_nieuw"; thread: MailThread }
  | { type: "mail_bericht"; threadId: string; bericht: MailBericht }
  | { type: "mail_gelezen"; threadId: string }
  | { type: "koppeling_replay"; logId: string; regel: KoppelingLogRegel }
  | { type: "koppeling_log"; regel: KoppelingLogRegel }
  | { type: "wachtrij_opgelost"; itemId: string; nuIso: string }
  | { type: "factuur_opgemaakt"; factuur: Factuur }
  | { type: "factuur_status"; nummer: string; status: FactuurStatus }
  | { type: "creditnota"; factuur: Factuur };

export const leegState: AppState = {
  ritten: [], taken: [], events: [], zendingen: {}, orders: {}, ongepland: [],
  adresInfo: {}, werktijden: [], emballage: [], tarieven: {}, wagenpark: [],
  klanten: {}, dockEvents: [], trailers: [], trailerVanRit: {}, cmrs: [], ritKm: {},
  weekRijMinuten: {}, vorigeWeekRijMinuten: {}, weekArbeidMinuten: {},
  wagenparkSync: "", mailThreads: [], koppelingLog: [],
  tachoUitlezingen: [], tachoToestemmingen: [], tachoBron: {}, tachoSync: "",
  referenties: [], wachtrij: [], facturen: [],
  uitgever: { naam: "", adres: "", postcodePlaats: "", kvkNummer: "", btwNummer: "" },
  offline: false, outbox: 0,
  actieveModules: STANDAARD_ACTIEF,
  beleid: { klantbericht: "automatisch", herplannen: "voorstel", wachturen: "automatisch" },
  berichten: [],
};

export function reducer(state: AppState, actie: Actie): AppState {
  switch (actie.type) {
    case "dag_geladen":
      return { ...state, ...actie.snapshot };
    case "plan_zending":
      return {
        ...state,
        taken: [...state.taken, actie.taak],
        events: voegEventToe(state.events, actie.event),
        ongepland: state.ongepland.filter((id) => id !== actie.zendingId),
      };
    case "registreer":
      return {
        ...state,
        events: voegEventToe(state.events, actie.event),
        outbox: state.offline ? state.outbox + 1 : state.outbox,
      };
    case "zet_offline":
      return { ...state, offline: actie.offline, outbox: actie.offline ? state.outbox : 0 };
    case "werktijd_event":
      return { ...state, werktijden: [...state.werktijden, actie.event] };
    case "adres_instructies": {
      const bestaand = state.adresInfo[actie.sleutel] ?? { instructies: "", fotos: [] };
      return {
        ...state,
        adresInfo: {
          ...state.adresInfo,
          [actie.sleutel]: { ...bestaand, instructies: actie.instructies },
        },
      };
    }
    case "adres_foto": {
      const bestaand = state.adresInfo[actie.sleutel] ?? { instructies: "", fotos: [] };
      return {
        ...state,
        adresInfo: {
          ...state.adresInfo,
          [actie.sleutel]: { ...bestaand, fotos: [...bestaand.fotos, actie.foto] },
        },
      };
    }
    case "nieuwe_order":
      return {
        ...state,
        orders: { ...state.orders, [actie.order.id]: actie.order },
        zendingen: { ...state.zendingen, [actie.zending.id]: actie.zending },
        ongepland: [...state.ongepland, actie.zending.id],
      };
    case "zet_tarief":
      return { ...state, tarieven: { ...state.tarieven, [actie.opdrachtgever]: actie.tarief } };
    case "zet_module":
      return {
        ...state,
        actieveModules: actie.actief
          ? [...new Set([...state.actieveModules, actie.module])]
          : state.actieveModules.filter((m) => m !== actie.module),
      };
    case "emballage_transactie":
      return { ...state, emballage: [...state.emballage, actie.transactie] };
    case "nieuwe_klant":
      return {
        ...state,
        klanten: { ...state.klanten, [actie.klant.naam]: actie.klant },
        tarieven: { ...state.tarieven, [actie.klant.naam]: actie.tarief },
      };
    case "dock_event":
      return { ...state, dockEvents: [...state.dockEvents, actie.event] };
    case "cmr_registreer":
      return { ...state, cmrs: [...state.cmrs, actie.cmr] };
    case "zet_trailer":
      return { ...state, trailerVanRit: { ...state.trailerVanRit, [actie.ritId]: actie.kenteken } };
    case "rit_km": {
      const huidig = state.ritKm[actie.ritId] ?? {};
      return {
        ...state,
        ritKm: { ...state.ritKm, [actie.ritId]: { ...huidig, [actie.veld]: actie.waarde } },
      };
    }
    case "zet_beleid":
      return { ...state, beleid: { ...state.beleid, [actie.actie]: actie.stand } };
    case "klantbericht":
      return { ...state, berichten: [...state.berichten, actie.bericht] };
    case "mail_nieuw":
      return { ...state, mailThreads: [...state.mailThreads, actie.thread] };
    case "mail_bericht":
      return {
        ...state,
        mailThreads: state.mailThreads.map((thread) =>
          thread.id === actie.threadId
            ? {
                ...thread,
                berichten: [...thread.berichten, actie.bericht],
                ongelezen: actie.bericht.richting === "in" ? true : thread.ongelezen,
              }
            : thread
        ),
      };
    case "mail_gelezen":
      return {
        ...state,
        mailThreads: state.mailThreads.map((thread) =>
          thread.id === actie.threadId ? { ...thread, ongelezen: false } : thread
        ),
      };
    case "factuur_opgemaakt":
      return { ...state, facturen: [...state.facturen, actie.factuur] };
    case "factuur_status":
      return {
        ...state,
        facturen: state.facturen.map((f) =>
          f.nummer === actie.nummer ? { ...f, status: actie.status } : f
        ),
      };
    case "creditnota":
      // Het origineel blijft staan; alleen de status wijzigt naar gecrediteerd.
      return {
        ...state,
        facturen: [
          ...state.facturen.map((f) =>
            f.nummer === actie.factuur.crediteertNummer
              ? { ...f, status: "gecrediteerd" as FactuurStatus }
              : f
          ),
          actie.factuur,
        ],
      };
    case "wachtrij_opgelost":
      return {
        ...state,
        wachtrij: state.wachtrij.map((item) =>
          item.id === actie.itemId ? { ...item, opgelostIso: actie.nuIso } : item
        ),
      };
    case "koppeling_log":
      return { ...state, koppelingLog: [...state.koppelingLog, actie.regel] };
    case "koppeling_replay":
      return {
        ...state,
        koppelingLog: [
          ...state.koppelingLog.map((regel) =>
            regel.id === actie.logId ? { ...regel, opnieuwAfgespeeld: true } : regel
          ),
          actie.regel,
        ],
      };
  }
}

// ── Selectors: alles afgeleid, niets dubbel opgeslagen ──────────────────────

export function takenVanRit(state: AppState, ritId: string): Taak[] {
  return state.taken
    .filter((t) => t.ritId === ritId)
    .sort((a, b) => a.geplandVan.localeCompare(b.geplandVan));
}

export function eventsVanTaak(state: AppState, taakId: string): TaakEvent[] {
  return state.events.filter((e) => e.taakId === taakId);
}

export function statusVanTaak(state: AppState, taakId: string): TaakStatus {
  return taakStatus(eventsVanTaak(state, taakId));
}

export function statusVanRit(state: AppState, ritId: string): RitStatus {
  return ritStatus(takenVanRit(state, ritId).map((t) => statusVanTaak(state, t.id)));
}

export function gebruikteLaadmeters(state: AppState, ritId: string): number {
  const zendingIds = new Set(
    takenVanRit(state, ritId).flatMap((t) => (t.zendingId ? [t.zendingId] : []))
  );
  let som = 0;
  for (const id of zendingIds) som += state.zendingen[id]?.laadmeters ?? 0;
  return Math.round(som * 10) / 10;
}

/** Actieve taken: vervallen taken (0-CMR) doen niet meer mee in de route. */
export function actieveTakenVanRit(state: AppState, ritId: string): Taak[] {
  return takenVanRit(state, ritId).filter((t) => statusVanTaak(state, t.id) !== "vervallen");
}

export function huidigeTaak(state: AppState, ritId: string): Taak | undefined {
  return actieveTakenVanRit(state, ritId).find(
    (t) => statusVanTaak(state, t.id) !== "afgerond"
  );
}

export function ritVanChauffeur(state: AppState, chauffeur: string): Rit | undefined {
  return state.ritten.find((r) => r.chauffeur === chauffeur);
}

export function zendingVan(state: AppState, taak: Taak): Zending | undefined {
  return taak.zendingId ? state.zendingen[taak.zendingId] : undefined;
}

export function werktijdenVan(state: AppState, chauffeur: string): WerktijdEvent[] {
  return state.werktijden.filter((e) => e.chauffeur === chauffeur);
}

export function adresInfoVan(state: AppState, adres: Adres): AdresInfo | undefined {
  return state.adresInfo[adresSleutel(adres)];
}

export function dockEventsVanZending(state: AppState, zendingId: string): DockEvent[] {
  return state.dockEvents.filter((e) => e.zendingId === zendingId);
}

export function cmrsVanTaak(state: AppState, taakId: string): CmrRegistratie[] {
  return state.cmrs.filter((c) => c.taakId === taakId);
}

export function rijtijdVan(state: AppState, chauffeur: string, nu: string): RijtijdStatus {
  // De rijtijd eerder deze week (vóór de event-log) hoort bij de lopende week;
  // de motor rekent per weekstart, dus die sleutel bepalen we hier.
  const dezeWeek = weekStartMs(Date.parse(nu));
  const vorigeWeek = weekStartMs(dezeWeek - 86_400_000);
  return rijtijdStatus({
    events: werktijdenVan(state, chauffeur),
    nu,
    eerdereRijMinutenPerWeek: {
      [dezeWeek]: state.weekRijMinuten[chauffeur] ?? 0,
      [vorigeWeek]: state.vorigeWeekRijMinuten?.[chauffeur] ?? 0,
    },
    eerdereArbeidMinutenPerWeek: {
      [dezeWeek]: state.weekArbeidMinuten?.[chauffeur] ?? 0,
    },
  });
}
