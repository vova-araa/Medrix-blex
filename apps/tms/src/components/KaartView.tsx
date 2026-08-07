import { formatteerKenteken } from "@sharzi/domain";
import { useState } from "react";
import { statusVanRit, takenVanRit, type AppState } from "../data/state";
import { statusLabel, t } from "../i18n";
import { PLAATS_COORDS, project } from "../kaart/coords";
import {
  kmVandaag,
  ritEta,
  VERKEER,
  verkeersSegmenten,
  voertuigPositie,
} from "../kaart/simulatie";
import { initialen, tijd } from "../utils";

const BREEDTE = 920;
const HOOGTE = 560;

const px = (plaats: string): [number, number] => {
  const c = PLAATS_COORDS[plaats] ?? PLAATS_COORDS.Venlo;
  return project(c[0], c[1], BREEDTE, HOOGTE);
};

interface Props {
  state: AppState;
  nu: string;
}

export function KaartView({ state, nu }: Props) {
  const [geselecteerdeRit, setGeselecteerdeRit] = useState<string | null>(null);

  const rittenMetTaken = state.ritten.filter((r) => takenVanRit(state, r.id).length > 0);
  const segmenten = verkeersSegmenten();
  const geselecteerd = rittenMetTaken.find((r) => r.id === geselecteerdeRit);

  return (
    <div className="kaart-main">
      <div className="kaart-vlak">
        <div className="kaart-kop">
          <span className="live-dot" /> {t("kaart.live")}
          <span className="kaart-noot">{t("kaart.gesimuleerd")}</span>
        </div>
        <svg viewBox={`0 0 ${BREEDTE} ${HOOGTE}`} className="kaart-svg" role="img" aria-label={t("kaart.titel")}>
          {/* raster */}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`v${i}`} className="kaart-raster" x1={(i * BREEDTE) / 12} y1={0} x2={(i * BREEDTE) / 12} y2={HOOGTE} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`h${i}`} className="kaart-raster" x1={0} y1={(i * HOOGTE) / 8} x2={BREEDTE} y2={(i * HOOGTE) / 8} />
          ))}

          {/* routes per rit */}
          {rittenMetTaken.map((rit) => {
            const plaatsen = ["Venlo", ...takenVanRit(state, rit.id).map((tk) => tk.adres.plaats)];
            const punten = plaatsen.map((p) => px(p).join(",")).join(" ");
            return <polyline key={rit.id} className="kaart-route" points={punten} />;
          })}

          {/* verkeersmeldingen op hun segment */}
          {segmenten.map(({ melding, van, naar }) => {
            const [x1, y1] = px(van);
            const [x2, y2] = px(naar);
            return (
              <g key={melding.id}>
                <line className="kaart-file" x1={x1} y1={y1} x2={x2} y2={y2} />
                <text className="kaart-file-label" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}>
                  {melding.weg} +{melding.vertragingMin} min
                </text>
              </g>
            );
          })}

          {/* plaatsen */}
          {Object.keys(PLAATS_COORDS).map((plaats) => {
            const [x, y] = px(plaats);
            return (
              <g key={plaats}>
                <circle className="kaart-plaats" cx={x} cy={y} r={5} />
                <text className="kaart-plaats-label" x={x + 8} y={y + 4}>{plaats}</text>
              </g>
            );
          })}

          {/* voertuigen */}
          {rittenMetTaken.map((rit) => {
            const pos = voertuigPositie(state, rit, nu);
            const [x, y] = project(pos.lat, pos.lon, BREEDTE, HOOGTE);
            const rs = statusVanRit(state, rit.id);
            return (
              <g
                key={rit.id}
                className={`kaart-voertuig vs-${rs}${rit.id === geselecteerdeRit ? " geselecteerd" : ""}`}
                transform={`translate(${x},${y})`}
                onClick={() => setGeselecteerdeRit(rit.id === geselecteerdeRit ? null : rit.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setGeselecteerdeRit(rit.id); }}
              >
                <circle className="kv-ring" r={16} />
                <circle className="kv-kern" r={12} />
                <text className="kv-tekst" y={4}>{initialen(rit.chauffeur || "•")}</text>
                <text className="kv-kenteken" y={30}>
                  {formatteerKenteken({ landcode: rit.voertuig.landcode, kenteken: rit.voertuig.kentekenGenormaliseerd })}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="kaart-legenda">
          {(["onderweg", "probleem", "afgerond", "gepland"] as const).map((s) => (
            <span key={s} className="legenda-item"><i className={`vs-${s}`} /> {statusLabel(s)}</span>
          ))}
          <span className="legenda-item"><i className="legenda-file" /> {t("kaart.fileLegenda")}</span>
        </div>
      </div>

      <aside className="kaart-zij">
        {geselecteerd ? (
          <RitInfoKaart state={state} nu={nu} ritId={geselecteerd.id} />
        ) : (
          <div className="ph-card"><p className="kaart-kies">{t("kaart.kiesVoertuig")}</p></div>
        )}
        <div className="ph-card">
          <h4 className="zij-kop">{t("kaart.meldingen")}</h4>
          <ul className="verkeer-lijst">
            {VERKEER.map((v) => (
              <li key={v.id}>
                <span className="weg-schild">{v.weg}</span>
                <div>
                  <div className="vk-omschrijving">{v.omschrijving}</div>
                  <div className="vk-vertraging">+{v.vertragingMin} min</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function RitInfoKaart({ state, nu, ritId }: { state: AppState; nu: string; ritId: string }) {
  const rit = state.ritten.find((r) => r.id === ritId);
  if (!rit) return null;
  const rs = statusVanRit(state, ritId);
  const pos = voertuigPositie(state, rit, nu);
  const eta = ritEta(state, ritId, nu);
  const doelTaak = eta ? state.taken.find((tk) => tk.id === eta.taakId) : undefined;

  return (
    <div className="ph-card">
      <div className="rc-head">
        <span className="avatar">{initialen(rit.chauffeur || "•")}</span>
        <div className="rc-who">
          <div className="naam">{rit.chauffeur || t("vloot.beschikbaar")}</div>
          <div className="ritnr">{rit.id}</div>
        </div>
        <span className={`status-chip s-${rs}`}>{statusLabel(rs)}</span>
      </div>
      <dl className="kv">
        <dt>{t("kaart.positie")}</dt>
        <dd>
          {pos.onderweg && pos.naarPlaats
            ? t("kaart.tussen", { van: pos.vanPlaats, naar: pos.naarPlaats })
            : pos.vanPlaats}
        </dd>
        {eta && doelTaak && (
          <>
            <dt>{t("kaart.eta")}</dt>
            <dd className={eta.naVenster ? "eta-te-laat" : undefined}>
              {doelTaak.adres.plaats} · {tijd(eta.aankomstIso)}
              {eta.vertragingMin > 0 && ` (+${eta.vertragingMin} min)`}
              {eta.naVenster && ` — ${t("kaart.naVenster")}`}
            </dd>
          </>
        )}
        <dt>{t("kaart.kmVandaag")}</dt>
        <dd>{kmVandaag(state, ritId)} km</dd>
      </dl>
    </div>
  );
}
