import {
  emballageStand, formatteerGeld, langOpenstaand,
  type EmballageSoort, type EmballageTransactie, type KlantStand,
} from "@sharzi/domain";
import { useMemo, useState } from "react";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { datumKort, tijd } from "../utils";
import { Icoon } from "./Icoon";

// Emballage is geen registratie maar een openstaande post: pallets die er
// maanden staan zijn geld dat vaststaat. Het scherm laat daarom niet alleen
// het saldo zien, maar ook hoe oud het is en wat het waard is.
//
// Saldi worden altijd afgeleid uit de transacties (CLAUDE.md §5.2). Boeken en
// corrigeren voegen een transactie toe; er wordt nooit een saldo bijgewerkt.

const SOORTEN: EmballageSoort[] = ["europallet", "rolcontainer", "fust", "kist"];

/** Boven deze ouderdom kleurt een saldo op: tijd om te bellen of te factureren. */
const LET_OP_DAGEN = 30;

interface Props {
  state: AppState;
  nu: string;
  onBoek: (invoer: {
    klant: string; soort: EmballageSoort; geleverd: number; retour: number;
  }) => void;
  onCorrigeer: (transactieId: string) => void;
}

export function EmballageView({ state, nu, onBoek, onCorrigeer }: Props) {
  const standen = useMemo(() => emballageStand(state.emballage, nu), [state.emballage, nu]);
  const teLang = langOpenstaand(standen, LET_OP_DAGEN);
  const totaleWaarde = standen.reduce((som, s) => som + s.waarde.bedragCenten, 0);

  return (
    <div className="uren-main emballage">
      <div className="emb-tegels">
        <div className="dash-tegel held">
          <span className="dash-label">{t("emballage.waardeTotaal")}</span>
          <b>{formatteerGeld({ bedragCenten: totaleWaarde, valuta: "EUR" })}</b>
          <span className="dash-sub">{t("emballage.waardeSub")}</span>
        </div>
        <div className="dash-tegel">
          <span className="dash-label">{t("emballage.klantenMetSaldo")}</span>
          <b>{standen.filter((s) => s.totaalOpenstaand > 0).length}</b>
          <span className="dash-sub">{t("emballage.vanTotaal", { n: standen.length })}</span>
        </div>
        <div className={`dash-tegel${teLang.length ? " let" : ""}`}>
          <span className="dash-label">{t("emballage.teLang", { dagen: LET_OP_DAGEN })}</span>
          <b>{teLang.length}</b>
          <span className="dash-sub">
            {teLang.length ? teLang.map((s) => s.klant).join(" · ") : t("emballage.allesRecent")}
          </span>
        </div>
      </div>

      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("emballage.titel")}</h3>
        <p className="uren-noot">{t("emballage.noot")}</p>
        <div className="rap-tabelwrap">
          <table className="rap-tabel">
            <thead>
              <tr>
                <th>{t("emballage.klant")}</th>
                {SOORTEN.map((soort) => (
                  <th key={soort} className="num">{t(`emballage.soort.${soort}`)}</th>
                ))}
                <th className="num">{t("emballage.ouderdom")}</th>
                <th className="num">{t("emballage.waarde")}</th>
                <th className="num">{t("emballage.laatsteBeweging")}</th>
              </tr>
            </thead>
            <tbody>
              {standen.map((stand) => (
                <KlantRij key={stand.klant} stand={stand} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="uren-noot saldo-uitleg">{t("emballage.uitleg")}</p>
      </div>

      <div className="emb-onder">
        <BoekKaart state={state} onBoek={onBoek} />
        <TransactieKaart state={state} onCorrigeer={onCorrigeer} />
      </div>
    </div>
  );
}

function KlantRij({ stand }: { stand: KlantStand }) {
  const perSoort = new Map(stand.standen.map((s) => [s.soort, s]));
  const oud = stand.langstOpenstaandDagen !== null && stand.langstOpenstaandDagen >= LET_OP_DAGEN;

  return (
    <tr>
      <td>{stand.klant}</td>
      {SOORTEN.map((soort) => {
        const s = perSoort.get(soort);
        const saldo = s?.saldo ?? 0;
        return (
          <td
            key={soort}
            className={`num ${saldo > 0 ? "saldo-plus" : saldo < 0 ? "saldo-min" : "saldo-nul"}`}
            title={s?.oudsteOpenstaand ? t("emballage.sinds", { datum: datumKort(s.oudsteOpenstaand) }) : undefined}
          >
            {saldo > 0 ? `+${saldo}` : saldo}
          </td>
        );
      })}
      <td className={`num${oud ? " let" : ""}`}>
        {stand.langstOpenstaandDagen === null
          ? "—"
          : t("emballage.dagen", { n: stand.langstOpenstaandDagen })}
      </td>
      <td className="num">{formatteerGeld(stand.waarde)}</td>
      <td className="num">{stand.laatsteBeweging ? datumKort(stand.laatsteBeweging) : "—"}</td>
    </tr>
  );
}

/** Handmatig boeken: het depot telt na en corrigeert wat de chauffeur miste. */
function BoekKaart({ state, onBoek }: {
  state: AppState;
  onBoek: Props["onBoek"];
}) {
  const klanten = [...new Set(state.emballage.map((e) => e.klant))].sort();
  const [klant, setKlant] = useState(klanten[0] ?? "");
  const [soort, setSoort] = useState<EmballageSoort>("europallet");
  const [geleverd, setGeleverd] = useState("0");
  const [retour, setRetour] = useState("0");

  const heel = (waarde: string) => Number.isInteger(Number(waarde)) && Number(waarde) >= 0;
  const geldig = klant !== "" && heel(geleverd) && heel(retour)
    && (Number(geleverd) > 0 || Number(retour) > 0);

  return (
    <div className="ph-card">
      <h3 className="zij-kop">{t("emballage.boekTitel")}</h3>
      <p className="rap-uitleg">{t("emballage.boekUitleg")}</p>
      <div className="order-form">
        <label>{t("emballage.klant")}
          <select value={klant} onChange={(e) => setKlant(e.target.value)}>
            {klanten.map((naam) => <option key={naam}>{naam}</option>)}
          </select>
        </label>
        <label>{t("emballage.soortKop")}
          <select value={soort} onChange={(e) => setSoort(e.target.value as EmballageSoort)}>
            {SOORTEN.map((s) => (
              <option key={s} value={s}>{t(`emballage.soort.${s}`)}</option>
            ))}
          </select>
        </label>
        <div className="order-rij">
          <label>{t("emballage.geleverd")}
            <input type="number" min="0" step="1" value={geleverd}
              onChange={(e) => setGeleverd(e.target.value)} />
          </label>
          <label>{t("emballage.retour")}
            <input type="number" min="0" step="1" value={retour}
              onChange={(e) => setRetour(e.target.value)} />
          </label>
        </div>
        <button
          className="btn primary emb-boek"
          disabled={!geldig}
          onClick={() => {
            onBoek({ klant, soort, geleverd: Number(geleverd), retour: Number(retour) });
            setGeleverd("0");
            setRetour("0");
          }}
        >
          {t("emballage.boekKnop")}
        </button>
      </div>
    </div>
  );
}

function TransactieKaart({ state, onCorrigeer }: {
  state: AppState;
  onCorrigeer: (transactieId: string) => void;
}) {
  const recente = [...state.emballage]
    .sort((a, b) => Date.parse(b.tijdstip) - Date.parse(a.tijdstip))
    .slice(0, 14);

  return (
    <div className="ph-card">
      <h3 className="zij-kop">{t("emballage.transacties")}</h3>
      <p className="rap-uitleg">{t("emballage.correctieUitleg")}</p>
      <div className="rap-tabelwrap">
        <table className="rap-tabel">
          <thead>
            <tr>
              <th>{t("emballage.tijd")}</th>
              <th>{t("emballage.klant")}</th>
              <th>{t("emballage.soortKop")}</th>
              <th className="num">{t("emballage.geleverd")}</th>
              <th className="num">{t("emballage.retour")}</th>
              <th>{t("emballage.bron")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {recente.map((transactie) => (
              <tr key={transactie.id}>
                <td>{wanneer(transactie)}</td>
                <td>{transactie.klant}</td>
                <td>{t(`emballage.soort.${transactie.soort}`)}</td>
                <td className="num">{transactie.geleverd || "—"}</td>
                <td className="num">{transactie.retour || "—"}</td>
                <td>{transactie.ritId ?? t("emballage.depot")}</td>
                <td>
                  <button
                    className="btn emb-corrigeer"
                    onClick={() => onCorrigeer(transactie.id)}
                    title={t("emballage.corrigeerTitel")}
                  >
                    <Icoon naam="pen" maat={12} /> {t("emballage.corrigeer")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Vandaag alleen de klok, ouder de datum — anders lijkt alles van vanochtend. */
function wanneer(transactie: EmballageTransactie): string {
  return `${datumKort(transactie.tijdstip)} ${tijd(transactie.tijdstip)}`;
}
