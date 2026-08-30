import { useMemo, useState } from "react";
import { INSTRUCTIES, type Instructie, type InstructieId } from "../data/instructies";
import { t } from "../i18n";
import { Icoon } from "./Icoon";

// Het instructieboek. Twee plekken, één component: de chauffeur opent het op
// zijn telefoon, het kantoor leest mee via de tab Instructies. Zo staat er geen
// tweede versie van de werkwijze die uit de pas gaat lopen.
//
// De teksten komen uit het woordenboek, dus het boek volgt de taalkeuze van de
// lezer (§7.5).

export function InstructieBoek({ compact = false }: { compact?: boolean }) {
  const [zoek, setZoek] = useState("");
  const [open, setOpen] = useState<InstructieId[]>([]);

  const term = zoek.trim().toLowerCase();
  const treffers = useMemo(() => {
    if (!term) return INSTRUCTIES;
    // Zoeken door de vertaalde tekst, niet door de sleutels: een Poolse
    // chauffeur zoekt op een Pools woord.
    return INSTRUCTIES.filter((instructie) => tekstVan(instructie).toLowerCase().includes(term));
  }, [term]);

  const allesOpen = treffers.length > 0 && treffers.every((i) => open.includes(i.id));

  return (
    <div className={`instructieboek${compact ? " compact" : ""}`}>
      <div className="ib-balk">
        <input
          className="doc-zoek"
          type="search"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder={t("instructie.zoek")}
        />
        <button
          className="btn ib-klap"
          onClick={() => setOpen(allesOpen ? [] : treffers.map((i) => i.id))}
        >
          {allesOpen ? t("instructie.alleInklappen") : t("instructie.alleUitklappen")}
        </button>
        <span className="doc-telling">{t("instructie.telling", { n: treffers.length })}</span>
      </div>

      {treffers.length === 0 && <p className="kaart-kies">{t("instructie.geenResultaat")}</p>}

      <div className="ib-lijst">
        {treffers.map((instructie) => (
          <InstructieKaart
            key={instructie.id}
            instructie={instructie}
            open={open.includes(instructie.id)}
            onToggle={() =>
              setOpen(open.includes(instructie.id)
                ? open.filter((id) => id !== instructie.id)
                : [...open, instructie.id])}
          />
        ))}
      </div>
    </div>
  );
}

/** Alle tekst van één onderwerp, voor het zoeken. */
function tekstVan(instructie: Instructie): string {
  return [
    t(instructie.titel),
    t(instructie.intro),
    ...instructie.stappen.map((sleutel) => t(sleutel)),
    instructie.letOp ? t(instructie.letOp) : "",
  ].join(" ");
}

function InstructieKaart({ instructie, open, onToggle }: {
  instructie: Instructie;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`ib-kaart${open ? " open" : ""}`}>
      <button className="ib-kop" onClick={onToggle} aria-expanded={open}>
        <span className="ib-ico"><Icoon naam={instructie.icoon} maat={16} /></span>
        <span className="ib-titel">{t(instructie.titel)}</span>
        <Icoon naam={open ? "chevron-links" : "chevron-rechts"} maat={14} />
      </button>

      {open && (
        <div className="ib-body">
          <p className="ib-intro">{t(instructie.intro)}</p>
          <ol className="ib-stappen">
            {instructie.stappen.map((sleutel) => (
              <li key={sleutel}>{t(sleutel)}</li>
            ))}
          </ol>
          {instructie.letOp && (
            <div className="ib-let">
              <b><Icoon naam="waarschuwing" maat={13} /> {t("instructie.letOp")}</b>
              <p>{t(instructie.letOp)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Kantoorweergave: hetzelfde boek, in een kaart met kop en toelichting. */
export function InstructiesView() {
  return (
    <div className="uren-main">
      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("instructie.titel")}</h3>
        <p className="uren-noot">{t("instructie.noot")}</p>
        <InstructieBoek />
      </div>
    </div>
  );
}
