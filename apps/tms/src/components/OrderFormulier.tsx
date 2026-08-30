import {
  controleerAanvraag, naarOrderEnZending,
  type AanvraagCode, type Order, type Orderaanvraag, type Zending,
} from "@sharzi/domain";
import { useState } from "react";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { PLAATS_COORDS } from "../kaart/coords";
import { Icoon } from "./Icoon";

// Eén formulier voor twee kanten van de balie: de planner voert een order in,
// de opdrachtgever meldt hem zelf aan in het portaal. Beide lopen door dezelfde
// domeincontrole, zodat een zelfaanmelding niet lichter gecontroleerd is.

const TENANT = "blex";
const PLAATSEN = Object.keys(PLAATS_COORDS).sort();

interface Props {
  state: AppState;
  nu: string;
  /** Standaarddatum, meestal de dag die op het planbord staat. */
  standaardDatum: string;
  /** In het portaal staat de opdrachtgever vast: je meldt aan namens jezelf. */
  vasteOpdrachtgever?: string;
  knopLabel: string;
  onAanmaken: (order: Order, zending: Zending) => void;
}

export function OrderFormulier({
  state, nu, standaardDatum, vasteOpdrachtgever, knopLabel, onAanmaken,
}: Props) {
  const opdrachtgevers = [
    ...new Set([
      ...Object.keys(state.klanten),
      ...Object.values(state.orders).map((o) => o.opdrachtgever),
    ]),
  ].sort();

  const [aanvraag, zet] = useState<Orderaanvraag>({
    opdrachtgever: vasteOpdrachtgever ?? opdrachtgevers[0] ?? "",
    klantreferentie: "",
    vanNaam: "Depot Venlo", vanPlaats: "Venlo",
    naarNaam: "", naarPlaats: "Helmond",
    omschrijving: "",
    laadmeters: 2, gewichtKg: 1000,
    datum: standaardDatum,
    vensterVan: "13:00", vensterTot: "17:00",
  });
  const [geprobeerd, setGeprobeerd] = useState(false);

  const veld = <K extends keyof Orderaanvraag>(sleutel: K) => (waarde: Orderaanvraag[K]) =>
    zet((vorig) => ({ ...vorig, [sleutel]: waarde }));

  // Een vaste opdrachtgever kan tijdens het invullen wisselen (het portaal laat
  // je van klant wisselen). De prop wint dan van de eigen state, anders zou de
  // order onder de vorige klant belanden.
  const definitief: Orderaanvraag = vasteOpdrachtgever
    ? { ...aanvraag, opdrachtgever: vasteOpdrachtgever }
    : aanvraag;
  const oordeel = controleerAanvraag(definitief, nu);

  function aanmaken() {
    setGeprobeerd(true);
    if (!oordeel.mag) return;
    const nummer = String(Object.keys(state.zendingen).length + 25).padStart(3, "0");
    const { order, zending } = naarOrderEnZending(definitief, {
      tenantId: TENANT,
      orderId: crypto.randomUUID(),
      zendingId: `SHZ-114-${nummer}`,
      referentie: `ORD-${nummer}`,
      barcode: `SHZ-114-${nummer}`,
    });
    onAanmaken(order, zending);
  }

  return (
    <div className="order-form">
      <label>{t("order.opdrachtgever")}
        {vasteOpdrachtgever ? (
          <input value={vasteOpdrachtgever} readOnly className="vast" />
        ) : (
          <>
            <input
              list="opdrachtgevers"
              value={aanvraag.opdrachtgever}
              onChange={(e) => veld("opdrachtgever")(e.target.value)}
            />
            <datalist id="opdrachtgevers">
              {opdrachtgevers.map((naam) => <option key={naam} value={naam} />)}
            </datalist>
          </>
        )}
      </label>
      <label>{t("order.klantreferentie")}
        <input
          value={aanvraag.klantreferentie}
          onChange={(e) => veld("klantreferentie")(e.target.value)}
          placeholder={t("order.klantreferentieVoorbeeld")}
        />
      </label>
      <div className="order-rij">
        <label>{t("order.vanNaam")}
          <input value={aanvraag.vanNaam} onChange={(e) => veld("vanNaam")(e.target.value)} />
        </label>
        <label>{t("order.plaats")}
          <select value={aanvraag.vanPlaats} onChange={(e) => veld("vanPlaats")(e.target.value)}>
            {PLAATSEN.map((plaats) => <option key={plaats}>{plaats}</option>)}
          </select>
        </label>
      </div>
      <div className="order-rij">
        <label>{t("order.naarNaam")}
          <input
            value={aanvraag.naarNaam}
            onChange={(e) => veld("naarNaam")(e.target.value)}
            placeholder={t("order.naarVoorbeeld")}
          />
        </label>
        <label>{t("order.plaats")}
          <select value={aanvraag.naarPlaats} onChange={(e) => veld("naarPlaats")(e.target.value)}>
            {PLAATSEN.map((plaats) => <option key={plaats}>{plaats}</option>)}
          </select>
        </label>
      </div>
      <label>{t("order.omschrijving")}
        <input
          value={aanvraag.omschrijving}
          onChange={(e) => veld("omschrijving")(e.target.value)}
          placeholder={t("order.omschrijvingVoorbeeld")}
        />
      </label>
      <div className="order-rij">
        <label>{t("order.laadmeters")}
          <input
            type="number" min="0.1" step="0.1" value={aanvraag.laadmeters}
            onChange={(e) => veld("laadmeters")(Number(e.target.value))}
          />
        </label>
        <label>{t("order.gewicht")}
          <input
            type="number" min="0" step="10" value={aanvraag.gewichtKg}
            onChange={(e) => veld("gewichtKg")(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="order-rij">
        <label>{t("order.datum")}
          <input type="date" value={aanvraag.datum} onChange={(e) => veld("datum")(e.target.value)} />
        </label>
        <label>{t("order.vensterVan")}
          <input type="time" value={aanvraag.vensterVan} onChange={(e) => veld("vensterVan")(e.target.value)} />
        </label>
        <label>{t("order.vensterTot")}
          <input type="time" value={aanvraag.vensterTot} onChange={(e) => veld("vensterTot")(e.target.value)} />
        </label>
      </div>

      <Meldingen codes={oordeel.fouten} soort="fout" toon={geprobeerd} />
      <Meldingen codes={oordeel.waarschuwingen} soort="waarschuwing" toon />

      <button className="btn primary" onClick={aanmaken} disabled={geprobeerd && !oordeel.mag}>
        {knopLabel}
      </button>
      <p className="uren-noot">{t("order.noot")}</p>
    </div>
  );
}

/**
 * Fouten verschijnen pas na de eerste poging — een leeg formulier volschrijven
 * met rode regels leest als een verwijt. Waarschuwingen staan er wel meteen,
 * want daar kun je nog iets aan veranderen voor je verstuurt.
 */
function Meldingen({ codes, soort, toon }: {
  codes: readonly AanvraagCode[];
  soort: "fout" | "waarschuwing";
  toon: boolean;
}) {
  if (!toon || codes.length === 0) return null;
  return (
    <ul className={`order-meldingen ${soort}`}>
      {codes.map((code) => (
        <li key={code}>
          <Icoon naam={soort === "fout" ? "kruis" : "waarschuwing"} maat={12} />
          {t(`order.melding.${code}`)}
        </li>
      ))}
    </ul>
  );
}
