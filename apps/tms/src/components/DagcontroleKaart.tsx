import {
  beoordeelControle, CONTROLEPUNTEN, legeStanden,
  type ControlePunt, type PuntStand, type Voertuigcontrole,
} from "@sharzi/domain";
import { useState } from "react";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { tijd } from "../utils";
import { Icoon } from "./Icoon";

// De daglijst: de rondgang om de auto vóór vertrek. Drie knoppen per punt —
// akkoord, gebrek, overslaan — want met handschoenen aan op een donker terrein
// moet het in tien tikken klaar zijn.
//
// Wat wordt afgekeurd gaat als melding naar de garage. De controle zelf blijft
// staan als bewijs van wat de chauffeur zag (§5.1).

interface Props {
  state: AppState;
  nu: string;
  chauffeur: string;
  ritId?: string;
  kenteken: string;
  trailerKenteken?: string;
  onControle: (controle: Voertuigcontrole) => void;
  onLosseMelding: (kenteken: string, omschrijving: string, kritisch: boolean) => void;
}

export function DagcontroleKaart({
  state, nu, chauffeur, ritId, kenteken, trailerKenteken, onControle, onLosseMelding,
}: Props) {
  const vandaag = nu.slice(0, 10);
  const gedaan = state.controles.find(
    (c) => c.chauffeur === chauffeur && c.tijdstip.slice(0, 10) === vandaag
  );

  const [open, setOpen] = useState(false);
  const [standen, setStanden] = useState<Record<ControlePunt, PuntStand>>(legeStanden);
  const [toelichting, setToelichting] = useState<Partial<Record<ControlePunt, string>>>({});
  const [kmStand, setKmStand] = useState("");
  const [losseMelding, setLosseMelding] = useState("");
  const [losKritisch, setLosKritisch] = useState(false);

  if (gedaan) {
    return <Afgerond controle={gedaan} onLosseMelding={onLosseMelding} kenteken={kenteken}
      melding={losseMelding} setMelding={setLosseMelding}
      kritisch={losKritisch} setKritisch={setLosKritisch} />;
  }

  const concept: Voertuigcontrole = {
    id: "concept", tenantId: "blex", kentekenGenormaliseerd: kenteken,
    trailerKenteken, chauffeur, ritId, tijdstip: nu,
    kilometerstand: Number(kmStand) || undefined,
    standen, toelichting,
  };
  const oordeel = beoordeelControle(concept);
  const beantwoord = CONTROLEPUNTEN.length - oordeel.nietGecontroleerd.length;
  const compleet = oordeel.nietGecontroleerd.length === 0;

  return (
    <div className="ph-card dagcontrole">
      <button className="dc-kop" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="dc-titel">
          <Icoon naam="check" maat={14} /> {t("dagcontrole.titel")}
        </span>
        <span className="dc-voortgang">{beantwoord}/{CONTROLEPUNTEN.length}</span>
      </button>

      {!open && <p className="dc-uitleg">{t("dagcontrole.uitlegKort")}</p>}

      {open && (
        <div className="dc-body">
          <p className="dc-uitleg">{t("dagcontrole.uitleg")}</p>
          <ul className="dc-punten">
            {CONTROLEPUNTEN.map(({ punt, kritisch }) => (
              <li key={punt} className={`dc-punt st-${standen[punt]}`}>
                <span className="dc-naam">
                  {t(`dagcontrole.punt.${punt}`)}
                  {kritisch && <span className="dc-kritisch">{t("dagcontrole.veiligheid")}</span>}
                </span>
                <span className="dc-knoppen">
                  {(["in_orde", "gebrek", "niet_gecontroleerd"] as PuntStand[]).map((stand) => (
                    <button
                      key={stand}
                      className={`dc-keuze k-${stand}${standen[punt] === stand ? " actief" : ""}`}
                      onClick={() => setStanden({ ...standen, [punt]: stand })}
                      aria-pressed={standen[punt] === stand}
                    >
                      {t(`dagcontrole.stand.${stand}`)}
                    </button>
                  ))}
                </span>
                {standen[punt] === "gebrek" && (
                  <input
                    className="dc-toelichting"
                    value={toelichting[punt] ?? ""}
                    placeholder={t("dagcontrole.watIsErMis")}
                    onChange={(e) => setToelichting({ ...toelichting, [punt]: e.target.value })}
                  />
                )}
              </li>
            ))}
          </ul>

          <label className="dc-km">
            {t("dagcontrole.kmStand")}
            <input
              type="number" min="0" step="1" value={kmStand}
              onChange={(e) => setKmStand(e.target.value)}
              placeholder={t("dagcontrole.kmPlaceholder")}
            />
          </label>

          {oordeel.gebreken.length > 0 && (
            <div className={`dc-oordeel${oordeel.blokkeertPlanning ? " blokkeert" : ""}`}>
              <b>
                <Icoon naam="waarschuwing" maat={13} />{" "}
                {t("dagcontrole.gebrekenGevonden", { n: oordeel.gebreken.length })}
              </b>
              <p>
                {oordeel.blokkeertPlanning
                  ? t("dagcontrole.kritiekUitleg")
                  : t("dagcontrole.gewoonUitleg")}
              </p>
            </div>
          )}

          <button
            className="btn big primary dc-afronden"
            disabled={!compleet}
            onClick={() => onControle({ ...concept, id: crypto.randomUUID() })}
          >
            {compleet
              ? t("dagcontrole.afronden")
              : t("dagcontrole.nogTeDoen", { n: oordeel.nietGecontroleerd.length })}
          </button>
        </div>
      )}
    </div>
  );
}

/** Na afronden: de uitslag plus de mogelijkheid onderweg alsnog iets te melden. */
function Afgerond({ controle, kenteken, onLosseMelding, melding, setMelding, kritisch, setKritisch }: {
  controle: Voertuigcontrole;
  kenteken: string;
  onLosseMelding: (kenteken: string, omschrijving: string, kritisch: boolean) => void;
  melding: string;
  setMelding: (waarde: string) => void;
  kritisch: boolean;
  setKritisch: (waarde: boolean) => void;
}) {
  const oordeel = beoordeelControle(controle);
  const [meldenOpen, setMeldenOpen] = useState(false);

  return (
    <div className="ph-card dagcontrole gedaan">
      <div className="dc-kop-vast">
        <span className="dc-titel">
          <Icoon naam="check" maat={14} /> {t("dagcontrole.titel")}
        </span>
        <span className={`dc-uitslag${oordeel.gebreken.length ? " met-gebrek" : ""}`}>
          {oordeel.gebreken.length === 0
            ? t("dagcontrole.alsInOrde", { tijd: tijd(controle.tijdstip) })
            : t("dagcontrole.metGebreken", { n: oordeel.gebreken.length, tijd: tijd(controle.tijdstip) })}
        </span>
      </div>

      {oordeel.gebreken.length > 0 && (
        <ul className="dc-gemeld">
          {oordeel.gebreken.map((punt) => (
            <li key={punt}>
              <b>{t(`dagcontrole.punt.${punt}`)}</b>
              <span>{controle.toelichting[punt] || t("dagcontrole.geenToelichting")}</span>
            </li>
          ))}
        </ul>
      )}

      {!meldenOpen ? (
        <button className="btn knop-met-icoon dc-melden-open" onClick={() => setMeldenOpen(true)}>
          <Icoon naam="waarschuwing" maat={14} /> {t("garage.meldOnderweg")}
        </button>
      ) : (
        <div className="dc-melden">
          <p className="dc-uitleg">{t("garage.meldUitleg")}</p>
          <textarea
            value={melding}
            placeholder={t("garage.meldPlaceholder")}
            onChange={(e) => setMelding(e.target.value)}
          />
          <label className="dc-kritisch-keuze">
            <input type="checkbox" checked={kritisch} onChange={(e) => setKritisch(e.target.checked)} />
            {t("garage.kritischVinkje")}
          </label>
          <div className="dc-melden-acties">
            <button
              className="btn primary dc-verstuur"
              disabled={melding.trim() === ""}
              onClick={() => {
                onLosseMelding(kenteken, melding.trim(), kritisch);
                setMelding("");
                setKritisch(false);
                setMeldenOpen(false);
              }}
            >
              {t("garage.versturen")}
            </button>
            <button className="btn" onClick={() => setMeldenOpen(false)}>{t("garage.annuleren")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
