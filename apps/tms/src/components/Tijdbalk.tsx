import {
  balkSamenvatting, balkTijd, balkVenster, bouwTijdbalk, formatteerKenteken, knelpuntenLijst,
  lokaalTijdstipMs, vrijeGaten,
  type Gat, type HerplanUitkomst, type KnelpuntRegel, type Segment, type TijdbalkRij,
} from "@sharzi/domain";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { eventsVanTaak, takenVanRit, werktijdenVan, type AppState } from "../data/state";
import { t } from "../i18n";
import { geschatteRijMinuten } from "../kaart/simulatie";
import { herplanReden, initialen } from "../utils";
import { Icoon } from "./Icoon";

// Het grafische planbord: auto's onder elkaar, tijd van links naar rechts.
// Dit is hoe een planner naar zijn dag kijkt — als bezetting, niet als lijst.
//
// De breedte van een blok is echte tijd, dus een halfuur is overal even breed.
// Kleur alleen is niet genoeg om op te sturen: elk blok draagt zijn eigen
// tijden en volgnummer, elke streep zegt waar hij voor staat, en wat er misgaat
// staat als leesbare lijst ónder het bord — niet verstopt in een tooltip.

type ZoomStand = "passend" | "normaal" | "breed";

/**
 * Pixels per minuut. "Passend" rekent de schaal uit zodat de hele dag in beeld
 * staat — een planner die moet scrollen om te zien of er nog een gat is, heeft
 * niets aan een planbord. Inzoomen kan als het druk wordt.
 */
const ZOOM: Record<Exclude<ZoomStand, "passend">, number> = { normaal: 1.2, breed: 2.4 };
const ZOOMSTANDEN: ZoomStand[] = ["passend", "normaal", "breed"];

/** Breedte van de vaste naamkolom links, gelijk aan de padding in de CSS. */
const NAAMKOLOM_PX = 204;

/** Het laatste uurlabel staat gecentreerd op de eindstreep en steekt uit. */
const UURLABEL_MARGE = 28;

/** Onder deze breedte past er geen tekst meer in een blok. */
const LABEL_VANAF_PX = 54;
const TIJD_VANAF_PX = 96;

/** Slepen gaat in stappen van vijf minuten; fijner plannen doet niemand. */
const SNAP_MINUTEN = 5;

/** Pas na deze verplaatsing is het slepen en niet klikken. */
const SLEEP_DREMPEL_PX = 4;

interface Props {
  state: AppState;
  nu: string;
  datum: string;
  onSelecteerTaak: (taakId: string) => void;
  onOpenDossier: (ritId: string) => void;
  /** Beoordeelt een sleep zonder hem uit te voeren, voor de terugkoppeling. */
  onBeoordeelSleep: (taakId: string, ritId: string, startIso: string) => HerplanUitkomst | null;
  /** Voert de sleep uit; weigert het domein, dan komt daar de melding vandaan. */
  onSleep: (taakId: string, ritId: string, startIso: string) => void;
}

/** Een sleep die bezig is: wat waarheen, en wat het domein ervan vindt. */
interface Sleep {
  taakId: string;
  bronRitId: string;
  duurMinuten: number;
  /** Waar in het blok de planner het vastpakte, zodat het niet verspringt. */
  grijpOffset: number;
  doelRitId: string;
  startMinuut: number;
  /** Waar de muis begon, om een klik van een sleep te onderscheiden. */
  vanafX: number;
  uitkomst: HerplanUitkomst | null;
}

/** Waar de aandacht van de planner op staat nadat hij een knelpunt aanklikt. */
interface Markering {
  ritId: string;
  taakId?: string;
  minuut: number;
}

interface Zweefkaart {
  rij: TijdbalkRij;
  segment: Segment;
  nummer: number | null;
  links: number;
  top: number;
}

export function Tijdbalk({
  state, nu, datum, onSelecteerTaak, onOpenDossier, onBeoordeelSleep, onSleep,
}: Props) {
  const [toonGaten, setToonGaten] = useState(true);
  const [zoom, setZoom] = useState<ZoomStand>("passend");
  const [markering, setMarkering] = useState<Markering | null>(null);
  const [zweef, setZweef] = useState<Zweefkaart | null>(null);
  const [bakBreedte, setBakBreedte] = useState(0);
  const [sleep, setSleep] = useState<Sleep | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Na een echte sleep mag de klik die erop volgt de stop niet openen.
  const netGesleept = useRef(false);

  useLayoutEffect(() => {
    const bak = scrollRef.current;
    if (!bak) return;
    const meet = () => setBakBreedte(bak.clientWidth);
    meet();
    const waarnemer = new ResizeObserver(meet);
    waarnemer.observe(bak);
    return () => waarnemer.disconnect();
  }, []);

  const rijen = useMemo(
    () => bouwTijdbalk({
      datum,
      ritten: state.ritten.filter((r) => r.datum === datum),
      takenVanRit: (ritId) => takenVanRit(state, ritId),
      eventsVanTaak: (taakId) => eventsVanTaak(state, taakId),
      reistijdMinuten: geschatteRijMinuten,
      nu,
      // De dienst begint bij het eerste werktijd-event van de dag; zonder
      // inklokken weten we het niet en tekenen we geen einde-dienststreep.
      dienstStart: (chauffeur) => werktijdenVan(state, chauffeur)[0]?.tijdstip,
    }),
    [state, nu, datum]
  );

  const venster = useMemo(() => balkVenster(rijen), [rijen]);
  const gaten = useMemo(() => vrijeGaten(rijen, 60), [rijen]);
  const samenvatting = useMemo(() => balkSamenvatting(rijen, 60), [rijen]);
  // De ruimte na de laatste stop is per rit hooguit één gat; die tekenen we
  // op het bord zelf, want dat is waar een spoedorder heen kan.
  const vrijNa = useMemo(
    () => new Map(gaten.filter((g) => g.soort === "na").map((g) => [g.ritId, g])),
    [gaten]
  );
  const knelpunten = useMemo(() => knelpuntenLijst(rijen), [rijen]);

  const spanMinuten = Math.max(1, venster.totMinuut - venster.vanMinuut);
  const pxPerMinuut = zoom === "passend"
    ? Math.max(0.3, (Math.max(bakBreedte, 720) - NAAMKOLOM_PX - UURLABEL_MARGE) / spanMinuten)
    : ZOOM[zoom];
  const breedte = spanMinuten * pxPerMinuut;
  const links = (minuut: number) => (minuut - venster.vanMinuut) * pxPerMinuut;

  const uren: number[] = [];
  for (let m = venster.vanMinuut; m <= venster.totMinuut; m += 60) uren.push(m);

  // ── Slepen ────────────────────────────────────────────────────────────────
  // De balk rekent in minuten sinds middernacht; het domein in ISO-tijden.
  const middernacht = lokaalTijdstipMs(datum);
  const isoVan = (minuut: number) => new Date(middernacht + minuut * 60_000).toISOString();

  /** Onder welke auto en op welke minuut hangt de muis nu? */
  const onderDeMuis = (x: number, y: number): { ritId: string; minuut: number } | null => {
    const baan = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-rit]");
    if (!baan) return null;
    const vak = baan.getBoundingClientRect();
    return {
      ritId: baan.dataset.rit!,
      minuut: venster.vanMinuut + (x - vak.left) / pxPerMinuut,
    };
  };

  const startSleep = (segment: Segment, rij: TijdbalkRij, x: number, y: number) => {
    const plek = onderDeMuis(x, y);
    if (!plek || !segment.taakId) return;
    setSleep({
      taakId: segment.taakId,
      bronRitId: rij.ritId,
      duurMinuten: segment.totMinuut - segment.vanMinuut,
      grijpOffset: plek.minuut - segment.vanMinuut,
      doelRitId: rij.ritId,
      startMinuut: segment.vanMinuut,
      vanafX: x,
      uitkomst: null,
    });
  };

  useEffect(() => {
    if (!sleep) return;

    const beweeg = (e: PointerEvent) => {
      const plek = onderDeMuis(e.clientX, e.clientY);
      if (!plek) return;
      // Een trillende hand is geen sleep; pas na een paar pixels of een andere
      // baan telt het als verplaatsen in plaats van klikken.
      const verschoven = Math.abs(e.clientX - sleep.vanafX) > SLEEP_DREMPEL_PX
        || plek.ritId !== sleep.bronRitId;
      if (!verschoven) return;
      const rauw = plek.minuut - sleep.grijpOffset;
      const startMinuut = Math.round(rauw / SNAP_MINUTEN) * SNAP_MINUTEN;
      if (startMinuut === sleep.startMinuut && plek.ritId === sleep.doelRitId) return;
      netGesleept.current = true;
      setSleep({
        ...sleep,
        doelRitId: plek.ritId,
        startMinuut,
        uitkomst: onBeoordeelSleep(sleep.taakId, plek.ritId, isoVan(startMinuut)),
      });
    };

    const los = () => {
      if (netGesleept.current) onSleep(sleep.taakId, sleep.doelRitId, isoVan(sleep.startMinuut));
      setSleep(null);
      // De klik komt direct na pointerup; die moet nog weten dat er gesleept is.
      setTimeout(() => { netGesleept.current = false; }, 0);
    };

    window.addEventListener("pointermove", beweeg);
    window.addEventListener("pointerup", los);
    return () => {
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerup", los);
    };
  });

  // Een knelpunt aanklikken schuift het bord naar dat moment en zet het blok
  // in de aandacht. Zonder dat blijft een lijst met meldingen een lijst.
  const springNaar = (regel: KnelpuntRegel) => {
    setMarkering({ ritId: regel.ritId, taakId: regel.taakId, minuut: regel.minuut });
    const bak = scrollRef.current;
    if (bak) {
      bak.scrollTo({ left: Math.max(0, links(regel.minuut) - bak.clientWidth / 3), behavior: "smooth" });
    }
  };

  if (rijen.length === 0) {
    return <div className="ph-card tb-leeg">{t("tijdbalk.geenRitten")}</div>;
  }

  return (
    <div className="ph-card tijdbalk">
      <div className="tb-kop">
        <h3 className="zij-kop">{t("tijdbalk.titel")}</h3>
        <div className="tb-legenda">
          {(["laden", "lossen", "rijden", "wachten"] as const).map((soort) => (
            <span key={soort} className="tb-leg">
              <i className={`tb-staal s-${soort}`} /> {t(`tijdbalk.soort.${soort}`)}
            </span>
          ))}
        </div>
        <div className="tb-knoppen">
          <label className="doc-filter">
            <input type="checkbox" checked={toonGaten} onChange={(e) => setToonGaten(e.target.checked)} />
            {t("tijdbalk.toonGaten", { n: gaten.length })}
          </label>
          <div className="tb-zoom" role="group" aria-label={t("tijdbalk.zoom")}>
            {ZOOMSTANDEN.map((stand) => (
              <button
                key={stand}
                className={`tb-zoomknop${zoom === stand ? " actief" : ""}`}
                onClick={() => setZoom(stand)}
                aria-pressed={zoom === stand}
              >
                {t(`tijdbalk.zoom.${stand}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Samenvatting samenvatting={samenvatting} />
      <p className="tb-sleephint">
        <Icoon naam="pijl" maat={12} /> {t("herplan.sleepHint")}
      </p>

      <div className="tb-scroll" ref={scrollRef}>
        <div className="tb-raster" style={{ width: `${breedte}px` }}>
          <div className="tb-uren">
            {uren.map((m) => (
              <span key={m} className="tb-uur" style={{ left: `${links(m)}px` }}>
                {balkTijd(m)}
              </span>
            ))}
          </div>

          {rijen.map((rij, i) => (
            <BalkRij
              key={rij.ritId}
              rij={rij}
              links={links}
              totaleBreedte={breedte}
              vrijNa={vrijNa.get(rij.ritId)}
              sleep={sleep?.doelRitId === rij.ritId ? sleep : null}
              sleeptHier={sleep?.bronRitId === rij.ritId ? sleep.taakId : null}
              onStartSleep={startSleep}
              netGesleept={netGesleept}
              pxPerMinuut={pxPerMinuut}
              toonGaten={toonGaten}
              markering={markering?.ritId === rij.ritId ? markering : null}
              toonNuLabel={i === 0}
              onSelecteerTaak={onSelecteerTaak}
              onOpenDossier={onOpenDossier}
              onZweef={setZweef}
            />
          ))}
        </div>
      </div>

      {zweef && <Detailkaart kaart={zweef} />}

      {toonGaten && gaten.length > 0 && (
        <p className="tb-gaten-noot">
          {t("tijdbalk.gatenNoot", {
            n: gaten.length,
            grootste: Math.round(gaten[0].minuten / 6) / 10,
            chauffeur: gaten[0].chauffeur,
          })}
        </p>
      )}

      <Knelpuntenlijst
        knelpunten={knelpunten}
        gekozenMinuut={markering?.minuut ?? null}
        onKies={springNaar}
      />
    </div>
  );
}

type SamenSleutel =
  "ritten" | "stops" | "bezetting" | "rijuren" | "stilstand" | "vrij" | "knelpunten";

function Samenvatting({ samenvatting }: { samenvatting: ReturnType<typeof balkSamenvatting> }) {
  const uur = (minuten: number) => Math.round(minuten / 6) / 10;
  const cijfers: { sleutel: SamenSleutel; waarde: string; let?: boolean }[] = [
    { sleutel: "ritten", waarde: String(samenvatting.ritten) },
    { sleutel: "stops", waarde: String(samenvatting.stops) },
    { sleutel: "bezetting", waarde: `${samenvatting.bezettingPct}%` },
    { sleutel: "rijuren", waarde: t("tijdbalk.uurKort", { n: uur(samenvatting.bezetteMinuten) }) },
    { sleutel: "stilstand", waarde: t("tijdbalk.uurKort", { n: uur(samenvatting.wachtMinuten) }) },
    {
      sleutel: "vrij",
      waarde: t("tijdbalk.vrijWaarde", {
        uur: uur(samenvatting.vrijeMinuten), n: samenvatting.vrijeGaten,
      }),
    },
    {
      sleutel: "knelpunten",
      waarde: String(samenvatting.knelpunten),
      let: samenvatting.knelpunten > 0,
    },
  ];

  return (
    <div className="tb-samenvatting">
      {cijfers.map((cijfer) => (
        <div key={cijfer.sleutel} className={`tb-cijfer${cijfer.let ? " let" : ""}`}>
          <span className="tb-cijfer-waarde">{cijfer.waarde}</span>
          <span className="tb-cijfer-naam">{t(`tijdbalk.samen.${cijfer.sleutel}`)}</span>
        </div>
      ))}
      <div className="tb-venstertijd">
        {t("tijdbalk.dagvenster", {
          van: balkTijd(samenvatting.vroegsteMinuut),
          tot: balkTijd(samenvatting.laatsteMinuut),
        })}
      </div>
    </div>
  );
}

function BalkRij({
  rij, links, totaleBreedte, vrijNa, sleep, sleeptHier, pxPerMinuut, toonGaten,
  markering, toonNuLabel, onSelecteerTaak, onOpenDossier, onZweef, onStartSleep, netGesleept,
}: {
  rij: TijdbalkRij;
  links: (minuut: number) => number;
  totaleBreedte: number;
  vrijNa: Gat | undefined;
  /** Een sleep die op déze baan is neergelegd. */
  sleep: Sleep | null;
  /** De stop die van deze baan wordt weggesleept, als die er is. */
  sleeptHier: string | null;
  onStartSleep: (segment: Segment, rij: TijdbalkRij, x: number, y: number) => void;
  netGesleept: React.MutableRefObject<boolean>;
  pxPerMinuut: number;
  toonGaten: boolean;
  markering: Markering | null;
  toonNuLabel: boolean;
  onSelecteerTaak: (taakId: string) => void;
  onOpenDossier: (ritId: string) => void;
  onZweef: (kaart: Zweefkaart | null) => void;
}) {
  const breedte = (van: number, tot: number) => Math.max(3, (tot - van) * pxPerMinuut);
  const bezetting = Math.round(
    (rij.bezetteMinuten / Math.max(1, rij.bezetteMinuten + rij.wachtMinuten)) * 100
  );

  // Stops krijgen een volgnummer in rijvolgorde: dat is hoe de planner en de
  // chauffeur het over dezelfde stop hebben.
  let teller = 0;
  const nummers = rij.segmenten.map((s) => (s.taakId ? ++teller : null));

  return (
    <div className={`tb-rij${markering ? " gemarkeerd" : ""}`}>
      <div className="tb-naam">
        <span className="avatar">{initialen(rij.chauffeur || "—")}</span>
        <div>
          <button className="tb-dossier" onClick={() => onOpenDossier(rij.ritId)} title={t("dossier.open")}>
            {rij.chauffeur || t("vloot.beschikbaar")}
          </button>
          <span className="mono">
            {formatteerKenteken({ landcode: rij.landcode, kenteken: rij.kentekenGenormaliseerd })}
          </span>
          <span className="tb-bezetting">
            {balkTijd(rij.vanMinuut)}–{balkTijd(rij.totMinuut)} ·{" "}
            {t("tijdbalk.bezetting", { pct: bezetting })}
            {rij.knelpunten.length > 0 && (
              <span className="tb-rij-let">
                <Icoon naam="waarschuwing" maat={10} /> {rij.knelpunten.length}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="tb-baan" data-rit={rij.ritId}>
        {sleep && <Sleepspook sleep={sleep} links={links} pxPerMinuut={pxPerMinuut} />}

        {rij.markers.map((marker, i) => (
          <span
            key={`${marker.soort}-${i}`}
            className={`tb-marker m-${marker.soort}${
              links(marker.minuut) > totaleBreedte - 130 ? " naar-links" : ""}`}
            style={{ left: `${links(marker.minuut)}px` }}
          >
            {(marker.soort !== "nu" || toonNuLabel) && (
              <span className="tb-marker-label">
                {t(`tijdbalk.markerKort.${marker.soort}`)} {balkTijd(marker.minuut)}
              </span>
            )}
          </span>
        ))}

        {toonGaten && vrijNa && (
          <div
            className="tb-vrij"
            style={{
              left: `${links(vrijNa.vanMinuut)}px`,
              width: `${breedte(vrijNa.vanMinuut, vrijNa.totMinuut)}px`,
            }}
          >
            {t("tijdbalk.vrijNa", {
              tot: balkTijd(vrijNa.totMinuut),
              uur: Math.round(vrijNa.minuten / 6) / 10,
            })}
          </div>
        )}

        {rij.segmenten.map((segment, i) => (
          <SegmentBlok
            key={i}
            segment={segment}
            rij={rij}
            nummer={nummers[i]}
            links={links(segment.vanMinuut)}
            breedte={breedte(segment.vanMinuut, segment.totMinuut)}
            toonGaten={toonGaten}
            sleept={sleeptHier === segment.taakId}
            onStartSleep={(x, y) => onStartSleep(segment, rij, x, y)}
            netGesleept={netGesleept}
            gemarkeerd={
              markering !== null &&
              (markering.taakId
                ? segment.taakId === markering.taakId
                : segment.vanMinuut <= markering.minuut && segment.totMinuut >= markering.minuut)
            }
            onSelecteerTaak={onSelecteerTaak}
            onZweef={onZweef}
          />
        ))}
      </div>
    </div>
  );
}

function SegmentBlok({
  segment, rij, nummer, links, breedte, toonGaten, gemarkeerd, sleept,
  onSelecteerTaak, onZweef, onStartSleep, netGesleept,
}: {
  segment: Segment;
  rij: TijdbalkRij;
  nummer: number | null;
  links: number;
  breedte: number;
  toonGaten: boolean;
  gemarkeerd: boolean;
  sleept: boolean;
  onStartSleep: (x: number, y: number) => void;
  netGesleept: React.MutableRefObject<boolean>;
  onSelecteerTaak: (taakId: string) => void;
  onZweef: (kaart: Zweefkaart | null) => void;
}) {
  const klassen = [
    "tb-blok",
    `s-${segment.soort}`,
    segment.werkelijk ? "werkelijk" : "",
    segment.status ? `st-${segment.status}` : "",
    segment.buitenVenster ? "buiten-venster" : "",
    gemarkeerd ? "gemarkeerd" : "",
    sleept ? "sleept" : "",
    segment.soort === "wachten" && toonGaten && breedte > 60 ? "gat" : "",
  ].filter(Boolean).join(" ");

  const tijden = `${balkTijd(segment.vanMinuut)}–${balkTijd(segment.totMinuut)}`;
  const naam = segment.plaats ?? t(`tijdbalk.soort.${segment.soort}`);
  const titel = `${t(`tijdbalk.soort.${segment.soort}`)} ${naam} · ${tijden}`;

  const inhoud = breedte > LABEL_VANAF_PX ? (
    <span className="tb-blok-tekst">
      {nummer !== null && <span className="tb-nummer">{nummer}</span>}
      <span className="tb-blok-label">{naam}</span>
      {breedte > TIJD_VANAF_PX && <span className="tb-blok-tijd">{tijden}</span>}
    </span>
  ) : nummer !== null && breedte > 18 ? (
    <span className="tb-nummer solo">{nummer}</span>
  ) : null;

  // De zweefkaart hangt onder het blok; bij de rechterrand schuift hij mee naar
  // binnen zodat hij niet buiten beeld valt.
  const toon = (el: HTMLElement) => {
    const vak = el.getBoundingClientRect();
    onZweef({
      rij, segment, nummer,
      links: Math.max(12, Math.min(vak.left, window.innerWidth - 312)),
      top: vak.bottom + 8,
    });
  };

  const zweefHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => toon(e.currentTarget),
    onMouseLeave: () => onZweef(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => toon(e.currentTarget),
    onBlur: () => onZweef(null),
  };

  if (!segment.taakId) {
    return (
      <div
        className={klassen}
        style={{ left: `${links}px`, width: `${breedte}px` }}
        title={titel}
        {...zweefHandlers}
      >
        {inhoud}
      </div>
    );
  }

  return (
    <button
      className={klassen}
      style={{ left: `${links}px`, width: `${breedte}px` }}
      title={titel}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onStartSleep(e.clientX, e.clientY);
      }}
      onClick={() => {
        // Wie net gesleept heeft wil de stop niet ook nog geopend zien.
        if (netGesleept.current) return;
        onSelecteerTaak(segment.taakId!);
      }}
      {...zweefHandlers}
    >
      {inhoud}
    </button>
  );
}

/**
 * Waar de stop terechtkomt als de planner nu loslaat, met het oordeel van het
 * domein erbij: groen met de nieuwe tijd, of rood met de reden waarom niet.
 */
function Sleepspook({ sleep, links, pxPerMinuut }: {
  sleep: Sleep;
  links: (minuut: number) => number;
  pxPerMinuut: number;
}) {
  const mag = sleep.uitkomst?.toegestaan ?? true;
  const waarschuwing = sleep.uitkomst?.waarschuwingen[0];
  const fout = sleep.uitkomst?.fouten[0];
  const reden = mag ? null : herplanReden(fout);
  // Zit het knelpunt bij de stop die meeverhuist, dan is dat verwarrend: de
  // planner sleept het lossen en krijgt een melding over het laden.
  const bijPartner = !mag && fout?.taakId !== undefined && fout.taakId !== sleep.taakId;

  return (
    <div
      className={`tb-spook${mag ? "" : " fout"}`}
      style={{
        left: `${links(sleep.startMinuut)}px`,
        width: `${Math.max(3, sleep.duurMinuten * pxPerMinuut)}px`,
      }}
    >
      <span className="tb-spook-kaart">
        <b>{balkTijd(sleep.startMinuut)}–{balkTijd(sleep.startMinuut + sleep.duurMinuten)}</b>
        {reden
          ? (
              <span className="tb-spook-fout">
                {reden}
                {bijPartner && <span className="tb-spook-paar"> {t("herplan.bijPaar")}</span>}
              </span>
            )
          : waarschuwing && (
              <span className="tb-spook-let">
                {t(waarschuwing.minuten < 0 ? "herplan.vensterVroeg" : "herplan.venster", {
                  n: Math.abs(waarschuwing.minuten),
                })}
              </span>
            )}
        {(sleep.uitkomst?.meeverhuisd.length ?? 0) > 0 && (
          <span className="tb-spook-paar">{t("herplan.paar")}</span>
        )}
      </span>
    </div>
  );
}

/** Alles wat niet in het blok past, zodra de planner er met de muis op staat. */
function Detailkaart({ kaart }: { kaart: Zweefkaart }) {
  const { segment, rij, nummer } = kaart;
  const duur = segment.totMinuut - segment.vanMinuut;

  return (
    <div className="tb-zweef" style={{ left: `${kaart.links}px`, top: `${kaart.top}px` }}>
      <div className="tb-zweef-kop">
        {nummer !== null && <span className="tb-nummer">{nummer}</span>}
        <b>{t(`tijdbalk.soort.${segment.soort}`)}</b>
        {segment.plaats && <span className="tb-zweef-plaats">{segment.plaats}</span>}
      </div>
      <dl className="tb-zweef-lijst">
        <div>
          <dt>{segment.werkelijk ? t("tijdbalk.detail.werkelijk") : t("tijdbalk.detail.gepland")}</dt>
          <dd>
            {balkTijd(segment.vanMinuut)}–{balkTijd(segment.totMinuut)}{" "}
            <span className="doc-geen">({t("tijdbalk.detail.duur", { n: duur })})</span>
          </dd>
        </div>
        <div>
          <dt>{t("tijdbalk.detail.venster")}</dt>
          <dd>
            {segment.venster
              ? <>
                  {balkTijd(segment.venster.vanMinuut)}–{balkTijd(segment.venster.totMinuut)}{" "}
                  <VensterOordeel segment={segment} venster={segment.venster} />
                </>
              : <span className="doc-geen">{t("tijdbalk.detail.geenVenster")}</span>}
          </dd>
        </div>
        {segment.status && (
          <div>
            <dt>{t("tijdbalk.detail.status")}</dt>
            <dd>{t(`status.${segment.status}`)}</dd>
          </div>
        )}
        <div>
          <dt>{t("tijdbalk.detail.rit")}</dt>
          <dd>
            {rij.chauffeur || t("vloot.beschikbaar")} ·{" "}
            <span className="mono">
              {formatteerKenteken({ landcode: rij.landcode, kenteken: rij.kentekenGenormaliseerd })}
            </span>
          </dd>
        </div>
      </dl>
      {segment.taakId && <p className="tb-zweef-hint">{t("tijdbalk.detail.klik")}</p>}
    </div>
  );
}

/**
 * Te vroeg en te laat zijn niet hetzelfde: te laat is een gemiste afspraak, te
 * vroeg betekent dat de chauffeur voor de poort staat te wachten. Allebei het
 * vermelden waard, maar niet met dezelfde kleur.
 */
function VensterOordeel({ segment, venster }: {
  segment: Segment;
  venster: { vanMinuut: number; totMinuut: number };
}) {
  if (segment.totMinuut > venster.totMinuut) {
    return (
      <span className="tb-mis">
        {t("tijdbalk.detail.teLaat", { n: segment.totMinuut - venster.totMinuut })}
      </span>
    );
  }
  if (segment.vanMinuut < venster.vanMinuut) {
    return (
      <span className="tb-vroeg">
        {t("tijdbalk.detail.teVroeg", { n: venster.vanMinuut - segment.vanMinuut })}
      </span>
    );
  }
  return <span className="tb-raak">{t("tijdbalk.detail.binnen")}</span>;
}

/**
 * Wat er misgaat, leesbaar en aanklikbaar. Een waarschuwingsdriehoekje op de
 * balk ziet niemand; deze lijst is wat de planner afwerkt.
 */
function Knelpuntenlijst({ knelpunten, gekozenMinuut, onKies }: {
  knelpunten: KnelpuntRegel[];
  gekozenMinuut: number | null;
  onKies: (regel: KnelpuntRegel) => void;
}) {
  if (knelpunten.length === 0) {
    return (
      <p className="tb-schoon">
        <Icoon naam="check" maat={13} /> {t("tijdbalk.geenKnelpunten")}
      </p>
    );
  }

  return (
    <div className="tb-knelpunten">
      <h4 className="zij-kop">{t("tijdbalk.knelpunten", { n: knelpunten.length })}</h4>
      <ul>
        {knelpunten.map((regel, i) => (
          <li key={`${regel.ritId}-${regel.soort}-${i}`}>
            <button
              className={`tb-knelregel k-${regel.soort}${
                gekozenMinuut === regel.minuut ? " actief" : ""}`}
              onClick={() => onKies(regel)}
            >
              <span className="tb-kneltijd mono">{balkTijd(regel.minuut)}</span>
              <span className="tb-knelsoort">{t(`tijdbalk.knelpunt.kort.${regel.soort}`)}</span>
              <span className="tb-kneltekst">
                {t(`tijdbalk.knelpunt.${regel.soort}`, { n: regel.minuten })}
              </span>
              <span className="tb-knelwie">
                {regel.chauffeur || regel.ritId}
                {regel.plaats && ` · ${regel.plaats}`}
              </span>
              <span className="tb-knelspring">{t("tijdbalk.toonOpBord")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
