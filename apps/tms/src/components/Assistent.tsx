import { useRef, useState } from "react";
import { DemoAssistent, type AiBron } from "../ai/bron";
import type { AppState } from "../data/state";
import { t } from "../i18n";

const bron: AiBron = new DemoAssistent();

interface Bericht {
  van: "gebruiker" | "assistent";
  tekst: string;
}

export function Assistent({ state, nu }: { state: AppState; nu: string }) {
  const [open, setOpen] = useState(false);
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  const [invoer, setInvoer] = useState("");
  const lijstRef = useRef<HTMLDivElement>(null);

  async function verstuur() {
    const vraag = invoer.trim();
    if (!vraag) return;
    setInvoer("");
    setBerichten((b) => [...b, { van: "gebruiker", tekst: vraag }]);
    const antwoord = await bron.beantwoord(vraag, { state, nu });
    setBerichten((b) => [...b, { van: "assistent", tekst: antwoord }]);
    requestAnimationFrame(() => {
      lijstRef.current?.scrollTo({ top: lijstRef.current.scrollHeight });
    });
  }

  return (
    <>
      <button
        className={`assistent-knop${open ? " open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        ✨ {t("assistent.knop")}
      </button>
      {open && (
        <div className="assistent-paneel">
          <div className="assistent-kop">
            <b>{t("assistent.titel")}</b>
            <span className="assistent-demo">{t("assistent.demo")}</span>
            <button className="btn" onClick={() => setOpen(false)} aria-label={t("detail.sluiten")}>✕</button>
          </div>
          <div className="assistent-berichten" ref={lijstRef}>
            {berichten.length === 0 && (
              <div className="bericht assistent">{t("assistent.welkom")}</div>
            )}
            {berichten.map((bericht, i) => (
              <div key={i} className={`bericht ${bericht.van}`}>{bericht.tekst}</div>
            ))}
          </div>
          <div className="assistent-invoer">
            <input
              value={invoer}
              onChange={(e) => setInvoer(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") verstuur(); }}
              placeholder={t("assistent.placeholder")}
            />
            <button className="btn primary" onClick={verstuur}>{t("assistent.verstuur")}</button>
          </div>
        </div>
      )}
    </>
  );
}
