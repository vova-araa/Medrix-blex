import { formatteerGeld } from "@sharzi/domain";
import { useState } from "react";
import type { Klant, Tarief } from "../data/bron";
import { conceptFacturen } from "../data/facturen";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { initialen } from "../utils";
import { Icoon } from "./Icoon";

interface Props {
  state: AppState;
  onNieuweKlant: (klant: Klant, tarief: Tarief) => void;
  onMail: (klant: Klant) => void;
}

export function KlantenView({ state, onNieuweKlant, onMail }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [contactpersoon, setContactpersoon] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [adres, setAdres] = useState("");
  const [postcodePlaats, setPostcodePlaats] = useState("");
  const [basis, setBasis] = useState("45.00");
  const [perLm, setPerLm] = useState("18.50");

  const facturen = conceptFacturen(state);
  const omzetVan = (klantNaam: string) =>
    facturen.find((f) => f.opdrachtgever === klantNaam)?.totalen.subtotaal;

  const namen = [
    ...new Set([
      ...Object.keys(state.klanten),
      ...Object.values(state.orders).map((o) => o.opdrachtgever),
    ]),
  ].sort();

  const geldig = naam.trim().length > 1 && !state.klanten[naam.trim()];

  function opslaan() {
    if (!geldig) return;
    onNieuweKlant(
      {
        naam: naam.trim(),
        contactpersoon: contactpersoon.trim(),
        email: email.trim(),
        telefoon: telefoon.trim(),
        adres: adres.trim(),
        postcodePlaats: postcodePlaats.trim(),
      },
      {
        basisCenten: Math.round(Number(basis) * 100) || 4500,
        perLaadmeterCenten: Math.round(Number(perLm) * 100) || 1850,
      }
    );
    setNaam(""); setContactpersoon(""); setEmail(""); setTelefoon("");
    setAdres(""); setPostcodePlaats("");
    setFormOpen(false);
  }

  return (
    <div className="uren-main">
      <div className="ph-card uren-kaart">
        <div className="operatie-kop">
          <h3 className="zij-kop">{t("klanten.titel")}</h3>
          <button className="btn primary knop-met-icoon" onClick={() => setFormOpen(!formOpen)}>
            <Icoon naam="plus" maat={14} /> {t("klanten.nieuw")}
          </button>
        </div>
        <p className="uren-noot">{t("klanten.noot")}</p>

        {formOpen && (
          <div className="klant-form order-form">
            <div className="order-rij">
              <label>{t("klanten.naam")}
                <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder={t("klanten.naamVoorbeeld")} />
              </label>
              <label>{t("klanten.contactpersoon")}
                <input value={contactpersoon} onChange={(e) => setContactpersoon(e.target.value)} />
              </label>
            </div>
            <div className="order-rij">
              <label>{t("klanten.email")}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>{t("klanten.telefoon")}
                <input value={telefoon} onChange={(e) => setTelefoon(e.target.value)} />
              </label>
            </div>
            <div className="order-rij">
              <label>{t("klanten.adres")}
                <input value={adres} onChange={(e) => setAdres(e.target.value)} placeholder={t("klanten.adresVoorbeeld")} />
              </label>
              <label>{t("klanten.postcodePlaats")}
                <input value={postcodePlaats} onChange={(e) => setPostcodePlaats(e.target.value)} placeholder={t("klanten.postcodeVoorbeeld")} />
              </label>
            </div>
            <p className="uren-noot">{t("klanten.adresNoot")}</p>
            <div className="order-rij">
              <label>{t("tarieven.basis")}
                <input type="number" min="0" step="0.50" value={basis} onChange={(e) => setBasis(e.target.value)} />
              </label>
              <label>{t("tarieven.perLm")}
                <input type="number" min="0" step="0.25" value={perLm} onChange={(e) => setPerLm(e.target.value)} />
              </label>
            </div>
            <div className="adres-acties">
              <button className="btn" onClick={() => setFormOpen(false)}>{t("klanten.annuleer")}</button>
              <button className="btn primary" disabled={!geldig} onClick={opslaan}>
                {t("klanten.opslaan")}
              </button>
            </div>
          </div>
        )}

        <div className="table-scroll">
          <table className="uren-tabel">
            <thead>
              <tr>
                <th>{t("klanten.klant")}</th>
                <th>{t("klanten.contact")}</th>
                <th>{t("tarieven.basis")}</th>
                <th>{t("tarieven.perLm")}</th>
                <th>{t("klanten.omzetVandaag")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {namen.map((klantNaam) => {
                const klant = state.klanten[klantNaam];
                const tarief = state.tarieven[klantNaam];
                const omzet = omzetVan(klantNaam);
                return (
                  <tr key={klantNaam}>
                    <td>
                      <span className="avatar avatar-klein">{initialen(klantNaam)}</span> {klantNaam}
                    </td>
                    <td>
                      {klant ? (
                        <div className="klant-contact">
                          <span>{klant.contactpersoon}</span>
                          <span className="klant-sub">{klant.email} · {klant.telefoon}</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td>{tarief ? formatteerGeld({ bedragCenten: tarief.basisCenten, valuta: "EUR" }) : "—"}</td>
                    <td>{tarief ? formatteerGeld({ bedragCenten: tarief.perLaadmeterCenten, valuta: "EUR" }) : "—"}</td>
                    <td>{omzet ? <b>{formatteerGeld(omzet)}</b> : "—"}</td>
                    <td>
                      {klant && (
                        <button className="btn knop-met-icoon" onClick={() => onMail(klant)}>
                          <Icoon naam="mail" maat={12} /> {t("klanten.mail")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
