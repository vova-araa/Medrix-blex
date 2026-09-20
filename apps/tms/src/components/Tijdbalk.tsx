import {
  balkVenster, bouwTijdbalk, formatteerKenteken, vrijeGaten,
  type Knelpunt, type Segment, type TijdbalkRij,
} from "@sharzi/domain";
import { useMemo, useState } from "react";
import { eventsVanTaak, takenVanRit, werktijdenVan, type AppState } from "../data/state";
import { t } from "../i18n";
import { geschatteRijMinuten } from "../kaart/simulatie";
import { initialen } from "../utils";
import { Icoon } from "./Icoon";

// Het grafische planbord: auto's onder elkaar, tijd van links naar rechts.
// Dit is hoe een planner naar zijn dag kijkt — als bezetting, niet als lijst.
//
// De breedte van een blok is echte tijd, dus een halfuur is overal even breed.
// Alles wat de planner moet zien staat in de balk zelf: waar het te krap is,
// waar een venster niet gehaald wordt, en waar nog een gat zit.

/** Pixels per minuut. Bij 1,1 past een dag van 16 uur op een breed scherm. */
const PX_PER_MINUUT = 1.1;

interface Props {
  state: AppState;
  nu: string;
  datum: string;
  onSelecteerTaak: (taakId: string) => void;
  onOpenDossier: (ritId: string) => void;
}

export function Tijdbalk({ state, nu, datum, onSelecteerTaak, onOpenDossier }: Props) {
  const [toonGaten, setToonGaten] = useState(true);

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
  const breedte = (venster.totMinuut - venster.vanMinuut) * PX_PER_MINUUT;
  const links = (minuut: number) => (minuut - venster.vanMinuut) * PX_PER_MINUUT;

  const uren: number[] = [];
  for (let m = venster.vanMinuut; m <= venster.totMinuut; m += 60) uren.push(m);

  const totaalKnelpunten = rijen.reduce((som, r) => som + r.knelpunten.length, 0);

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
          {totaalKnelpunten > 0 && (
            <span className="tb-leg let">
              <Icoon naam="waarschuwing" maat={12} /> {t("tijdbalk.knelpunten", { n: totaalKnelpunten })}
            </span>
          )}
        </div>
        <label className="doc-filter tb-gaten-knop">
          <input type="checkbox" checked={toonGaten} onChange={(e) => setToonGaten(e.target.checked)} />
          {t("tijdbalk.toonGaten", { n: gaten.length })}
        </label>
      </div>

      <div className="tb-scroll">
        <div className="tb-raster" style={{ width: `${breedte}px` }}>
          <div className="tb-uren">
            {uren.map((m) => (
              <span key={m} className="tb-uur" style={{ left: `${links(m)}px` }}>
                {String(Math.floor(m / 60) % 24).padStart(2, "0")}
              </span>
            ))}
          </div>

          {rijen.map((rij) => (
            <BalkRij
              key={rij.ritId}
              rij={rij}
              links={links}
              toonGaten={toonGaten}
              onSelecteerTaak={onSelecteerTaak}
              onOpenDossier={onOpenDossier}
            />
          ))}
        </div>
      </div>

      {toonGaten && gaten.length > 0 && (
        <p className="tb-gaten-noot">
          {t("tijdbalk.gatenNoot", {
            n: gaten.length,
            grootste: Math.round(gaten[0].minuten / 6) / 10,
            chauffeur: gaten[0].chauffeur,
          })}
        </p>
      )}
    </div>
  );
}

function BalkRij({ rij, links, toonGaten, onSelecteerTaak, onOpenDossier }: {
  rij: TijdbalkRij;
  links: (minuut: number) => number;
  toonGaten: boolean;
  onSelecteerTaak: (taakId: string) => void;
  onOpenDossier: (ritId: string) => void;
}) {
  const breedte = (van: number, tot: number) => Math.max(2, (tot - van) * PX_PER_MINUUT);
  const bezetting = Math.round(
    (rij.bezetteMinuten / Math.max(1, rij.bezetteMinuten + rij.wachtMinuten)) * 100
  );

  return (
    <div className="tb-rij">
      <div className="tb-naam">
        <span className="avatar">{initialen(rij.chauffeur || "—")}</span>
        <div>
          <button className="tb-dossier" onClick={() => onOpenDossier(rij.ritId)} title={t("dossier.open")}>
            {rij.chauffeur || t("vloot.beschikbaar")}
          </button>
          <span className="mono">
            {formatteerKenteken({ landcode: rij.landcode, kenteken: rij.kentekenGenormaliseerd })}
          </span>
          <span className="tb-bezetting">{t("tijdbalk.bezetting", { pct: bezetting })}</span>
        </div>
      </div>

      <div className="tb-baan">
        {rij.markers.map((marker, i) => (
          <span
            key={`${marker.soort}-${i}`}
            className={`tb-marker m-${marker.soort}`}
            style={{ left: `${links(marker.minuut)}px` }}
            title={t(`tijdbalk.marker.${marker.soort}`)}
          />
        ))}

        {rij.segmenten.map((segment, i) => (
          <SegmentBlok
            key={i}
            segment={segment}
            links={links(segment.vanMinuut)}
            breedte={breedte(segment.vanMinuut, segment.totMinuut)}
            toonGaten={toonGaten}
            onSelecteerTaak={onSelecteerTaak}
          />
        ))}

        {rij.knelpunten.map((knelpunt, i) => (
          <span
            key={`k-${i}`}
            className={`tb-knelpunt k-${knelpunt.soort}`}
            style={{ left: `${links(knelpunt.minuut)}px` }}
            title={knelpuntTekst(knelpunt)}
          >
            <Icoon naam="waarschuwing" maat={11} />
          </span>
        ))}
      </div>
    </div>
  );
}

function SegmentBlok({ segment, links, breedte, toonGaten, onSelecteerTaak }: {
  segment: Segment;
  links: number;
  breedte: number;
  toonGaten: boolean;
  onSelecteerTaak: (taakId: string) => void;
}) {
  const klassen = [
    "tb-blok",
    `s-${segment.soort}`,
    segment.werkelijk ? "werkelijk" : "",
    segment.status ? `st-${segment.status}` : "",
    segment.buitenVenster ? "buiten-venster" : "",
    segment.soort === "wachten" && toonGaten && breedte > 60 ? "gat" : "",
  ].filter(Boolean).join(" ");

  const label = segment.taakId
    ? `${t(`tijdbalk.soort.${segment.soort}`)} · ${segment.plaats ?? ""}`
    : t(`tijdbalk.soort.${segment.soort}`);

  // Een blok van een halfuur is ongeveer 33 pixels; daaronder past geen tekst
  // meer en laat de tooltip het werk doen.
  const inhoud = breedte > 46 ? <span className="tb-blok-label">{segment.plaats ?? label}</span> : null;

  if (!segment.taakId) {
    return (
      <div className={klassen} style={{ left: `${links}px`, width: `${breedte}px` }} title={label}>
        {inhoud}
      </div>
    );
  }

  return (
    <button
      className={klassen}
      style={{ left: `${links}px`, width: `${breedte}px` }}
      title={label}
      onClick={() => onSelecteerTaak(segment.taakId!)}
    >
      {inhoud}
    </button>
  );
}

function knelpuntTekst(knelpunt: Knelpunt): string {
  return t(`tijdbalk.knelpunt.${knelpunt.soort}`, { n: knelpunt.minuten });
}
