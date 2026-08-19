import { useState } from "react";
import type { MailThread } from "../data/bron";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { tijd } from "../utils";
import { Icoon } from "./Icoon";

export interface MailConcept {
  tegenpartij: string;
  email: string;
  zendingId?: string;
}

interface Props {
  state: AppState;
  concept: MailConcept | null;
  onNieuwThread: (
    tegenpartij: string,
    email: string,
    onderwerp: string,
    tekst: string,
    zendingId?: string
  ) => void;
  onAntwoord: (threadId: string, tekst: string) => void;
  onGelezen: (threadId: string) => void;
}

export function BerichtenView({ state, concept, onNieuwThread, onAntwoord, onGelezen }: Props) {
  const threads = [...state.mailThreads].sort((a, b) => {
    const la = a.berichten.at(-1)?.tijdstip ?? "";
    const lb = b.berichten.at(-1)?.tijdstip ?? "";
    return lb.localeCompare(la);
  });
  const [actiefId, setActiefId] = useState<string | null>(concept ? null : threads[0]?.id ?? null);
  const [nieuwOpen, setNieuwOpen] = useState(concept !== null);
  const actief = threads.find((thread) => thread.id === actiefId) ?? null;

  const kies = (thread: MailThread) => {
    setActiefId(thread.id);
    setNieuwOpen(false);
    if (thread.ongelezen) onGelezen(thread.id);
  };

  return (
    <div className="berichten-main">
      <aside className="ph-card berichten-lijst">
        <div className="operatie-kop">
          <h3 className="zij-kop">{t("mail.threads")}</h3>
          <button
            className="btn primary knop-met-icoon"
            onClick={() => { setNieuwOpen(true); setActiefId(null); }}
          >
            <Icoon naam="plus" maat={13} /> {t("mail.nieuw")}
          </button>
        </div>
        <p className="uren-noot">{t("mail.noot")}</p>
        <ul className="thread-lijst">
          {threads.map((thread) => {
            const laatste = thread.berichten.at(-1);
            return (
              <li key={thread.id}>
                <button
                  className={`thread${thread.id === actiefId ? " actief" : ""}`}
                  onClick={() => kies(thread)}
                >
                  <div className="thread-kop">
                    {thread.ongelezen && <span className="thread-dot" />}
                    <b>{thread.tegenpartij}</b>
                    <span className="thread-tijd">{laatste ? tijd(laatste.tijdstip) : ""}</span>
                  </div>
                  <div className="thread-onderwerp">{thread.onderwerp}</div>
                  {laatste && <div className="thread-preview">{laatste.tekst}</div>}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="ph-card berichten-gesprek">
        {nieuwOpen ? (
          <NieuwBericht
            state={state}
            concept={concept}
            onVerstuur={(tegenpartij, email, onderwerp, tekst, zendingId) => {
              onNieuwThread(tegenpartij, email, onderwerp, tekst, zendingId);
              setNieuwOpen(false);
            }}
          />
        ) : actief ? (
          <Gesprek thread={actief} onAntwoord={onAntwoord} />
        ) : (
          <p className="kaart-kies">{t("mail.kies")}</p>
        )}
      </div>
    </div>
  );
}

function Gesprek({ thread, onAntwoord }: {
  thread: MailThread;
  onAntwoord: (threadId: string, tekst: string) => void;
}) {
  const [tekst, setTekst] = useState("");
  return (
    <>
      <div className="gesprek-kop">
        <h3>{thread.onderwerp}</h3>
        <span className="uren-noot">
          {thread.tegenpartij} · <span className="mono">{thread.email}</span>
          {thread.zendingId && <> · <span className="mono">{thread.zendingId}</span></>}
        </span>
      </div>
      <div className="gesprek-berichten">
        {thread.berichten.map((bericht) => (
          <div key={bericht.id} className={`mail-bubbel r-${bericht.richting}`}>
            <div className="mail-tekst">{bericht.tekst}</div>
            <div className="mail-meta">{bericht.wie} · {tijd(bericht.tijdstip)}</div>
          </div>
        ))}
      </div>
      <div className="gesprek-antwoord">
        <textarea
          value={tekst}
          placeholder={t("mail.antwoordPlaceholder")}
          onChange={(e) => setTekst(e.target.value)}
        />
        <button
          className="btn primary knop-met-icoon"
          disabled={tekst.trim() === ""}
          onClick={() => { onAntwoord(thread.id, tekst.trim()); setTekst(""); }}
        >
          <Icoon naam="mail" maat={14} /> {t("mail.verstuur")}
        </button>
      </div>
    </>
  );
}

function NieuwBericht({ state, concept, onVerstuur }: {
  state: AppState;
  concept: MailConcept | null;
  onVerstuur: (tegenpartij: string, email: string, onderwerp: string, tekst: string, zendingId?: string) => void;
}) {
  const klantNamen = Object.keys(state.klanten);
  // Een ontvanger die geen bestaande klant is (bv. een losadres uit een stop)
  // komt binnen als vrij adres, met naam en e-mail alvast ingevuld.
  const conceptIsKlant = concept ? klantNamen.includes(concept.tegenpartij) : false;
  const [keuze, setKeuze] = useState(
    concept ? (conceptIsKlant ? concept.tegenpartij : "__ander__") : klantNamen[0] ?? ""
  );
  const [anderNaam, setAnderNaam] = useState(conceptIsKlant ? "" : concept?.tegenpartij ?? "");
  const [anderEmail, setAnderEmail] = useState(conceptIsKlant ? "" : concept?.email ?? "");
  const [onderwerp, setOnderwerp] = useState("");
  const [tekst, setTekst] = useState("");

  const ander = keuze === "__ander__";
  const tegenpartij = ander ? anderNaam : keuze;
  const email = ander
    ? anderEmail
    : concept && concept.tegenpartij === keuze
      ? concept.email
      : state.klanten[keuze]?.email ?? "";
  const geldig = tegenpartij.trim() !== "" && email.trim() !== "" &&
    onderwerp.trim() !== "" && tekst.trim() !== "";

  return (
    <>
      <div className="gesprek-kop"><h3>{t("mail.nieuwTitel")}</h3></div>
      <div className="mail-form">
        <label>
          {t("mail.aan")}
          <select value={keuze} onChange={(e) => setKeuze(e.target.value)}>
            {klantNamen.map((naam) => <option key={naam} value={naam}>{naam}</option>)}
            <option value="__ander__">{t("mail.anderAdres")}</option>
          </select>
        </label>
        {ander ? (
          <div className="mail-ander">
            <input
              placeholder={t("mail.naamPlaceholder")}
              value={anderNaam}
              onChange={(e) => setAnderNaam(e.target.value)}
            />
            <input
              placeholder={t("mail.emailPlaceholder")}
              value={anderEmail}
              onChange={(e) => setAnderEmail(e.target.value)}
            />
          </div>
        ) : (
          <span className="uren-noot mono">{email}</span>
        )}
        <label>
          {t("mail.onderwerp")}
          <input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} />
        </label>
        <label>
          {t("mail.bericht")}
          <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} />
        </label>
        <button
          className="btn primary knop-met-icoon"
          disabled={!geldig}
          onClick={() => onVerstuur(tegenpartij.trim(), email.trim(), onderwerp.trim(), tekst.trim(), concept?.zendingId)}
        >
          <Icoon naam="mail" maat={14} /> {t("mail.verstuur")}
        </button>
      </div>
    </>
  );
}
