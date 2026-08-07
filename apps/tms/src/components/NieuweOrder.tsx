import type { Order, Zending } from "@sharzi/domain";
import { useState } from "react";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { PLAATS_COORDS } from "../kaart/coords";
import { Icoon } from "./Icoon";

const TENANT = "blex";
const PLAATSEN = Object.keys(PLAATS_COORDS).sort();

// Demodag is 2026-08-07; invoer is lokale tijd (Europe/Amsterdam, UTC+2).
const naarUtc = (lokaal: string) => new Date(`2026-08-07T${lokaal}:00+02:00`).toISOString();

interface Props {
  state: AppState;
  onSluit: () => void;
  onAanmaken: (order: Order, zending: Zending) => void;
}

export function NieuweOrder({ state, onSluit, onAanmaken }: Props) {
  const opdrachtgevers = [
    ...new Set([
      ...Object.keys(state.klanten),
      ...Object.values(state.orders).map((o) => o.opdrachtgever),
    ]),
  ].sort();
  const [opdrachtgever, setOpdrachtgever] = useState(opdrachtgevers[0] ?? "");
  const [vanNaam, setVanNaam] = useState("Depot Venlo");
  const [vanPlaats, setVanPlaats] = useState("Venlo");
  const [naarNaam, setNaarNaam] = useState("");
  const [naarPlaats, setNaarPlaats] = useState("Helmond");
  const [omschrijving, setOmschrijving] = useState("");
  const [lm, setLm] = useState("2.0");
  const [gewicht, setGewicht] = useState("1000");
  const [vensterVan, setVensterVan] = useState("13:00");
  const [vensterTot, setVensterTot] = useState("17:00");

  const geldig = opdrachtgever.trim() && naarNaam.trim() && Number(lm) > 0;

  function aanmaken() {
    if (!geldig) return;
    const nummer = String(Object.keys(state.zendingen).length + 25).padStart(3, "0");
    const order: Order = {
      id: crypto.randomUUID(),
      tenantId: TENANT,
      opdrachtgever: opdrachtgever.trim(),
      referentie: `ORD-${nummer}`,
    };
    const zending: Zending = {
      id: `SHZ-114-${nummer}`,
      tenantId: TENANT,
      orderId: order.id,
      barcode: `SHZ-114-${nummer}`,
      laadmeters: Number(lm),
      gewichtKg: Number(gewicht) || 0,
      omschrijving: omschrijving.trim() || t("order.standaardOmschrijving"),
      van: { naam: vanNaam.trim() || vanPlaats, plaats: vanPlaats, land: "NL" },
      naar: {
        naam: naarNaam.trim(),
        plaats: naarPlaats,
        land: "NL",
        tijdvenster: { van: naarUtc(vensterVan), tot: naarUtc(vensterTot) },
      },
    };
    onAanmaken(order, zending);
  }

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
          <div className="eyebrow">{t("order.eyebrow")}</div>
          <h3>{t("order.titel")}</h3>
        </div>
        <div className="detail-body order-form">
          <label>{t("order.opdrachtgever")}
            <input list="opdrachtgevers" value={opdrachtgever} onChange={(e) => setOpdrachtgever(e.target.value)} />
            <datalist id="opdrachtgevers">
              {opdrachtgevers.map((naam) => <option key={naam} value={naam} />)}
            </datalist>
          </label>
          <div className="order-rij">
            <label>{t("order.vanNaam")}
              <input value={vanNaam} onChange={(e) => setVanNaam(e.target.value)} />
            </label>
            <label>{t("order.plaats")}
              <select value={vanPlaats} onChange={(e) => setVanPlaats(e.target.value)}>
                {PLAATSEN.map((plaats) => <option key={plaats}>{plaats}</option>)}
              </select>
            </label>
          </div>
          <div className="order-rij">
            <label>{t("order.naarNaam")}
              <input value={naarNaam} onChange={(e) => setNaarNaam(e.target.value)} placeholder={t("order.naarVoorbeeld")} />
            </label>
            <label>{t("order.plaats")}
              <select value={naarPlaats} onChange={(e) => setNaarPlaats(e.target.value)}>
                {PLAATSEN.map((plaats) => <option key={plaats}>{plaats}</option>)}
              </select>
            </label>
          </div>
          <label>{t("order.omschrijving")}
            <input value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} placeholder={t("order.omschrijvingVoorbeeld")} />
          </label>
          <div className="order-rij">
            <label>{t("order.laadmeters")}
              <input type="number" min="0.1" step="0.1" value={lm} onChange={(e) => setLm(e.target.value)} />
            </label>
            <label>{t("order.gewicht")}
              <input type="number" min="0" step="10" value={gewicht} onChange={(e) => setGewicht(e.target.value)} />
            </label>
          </div>
          <div className="order-rij">
            <label>{t("order.vensterVan")}
              <input type="time" value={vensterVan} onChange={(e) => setVensterVan(e.target.value)} />
            </label>
            <label>{t("order.vensterTot")}
              <input type="time" value={vensterTot} onChange={(e) => setVensterTot(e.target.value)} />
            </label>
          </div>
          <button className="btn primary" disabled={!geldig} onClick={aanmaken}>
            {t("order.aanmaken")}
          </button>
          <p className="uren-noot">{t("order.noot")}</p>
        </div>
      </aside>
    </div>
  );
}
