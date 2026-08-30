import { useEffect, useRef, useState } from "react";
import { TALEN, t, type Taal } from "../i18n";
import { TAALCODE, Vlag } from "./Vlag";

// Taalkeuze in de kopbalk: één vlag zichtbaar, klik en je kiest een andere.
// In de kantoorapp is het geen dagelijkse handeling, dus hij mag klein zijn —
// maar hij moet er wel staan, want ook de administratie is niet overal
// Nederlandstalig.

export function TaalKnop({ taal, onZetTaal }: {
  taal: Taal;
  onZetTaal: (taal: Taal) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", buiten);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", buiten);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="taalknop" ref={wrapper}>
      <button
        className="btn taalknop-huidig"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t("taal.kies")}
      >
        <Vlag taal={taal} maat={20} />
        <span>{TAALCODE[taal]}</span>
      </button>

      {open && (
        <div className="taalknop-menu" role="menu">
          {TALEN.map((optie) => (
            <button
              key={optie.code}
              role="menuitemradio"
              aria-checked={optie.code === taal}
              className={optie.code === taal ? "actief" : ""}
              onClick={() => { onZetTaal(optie.code); setOpen(false); }}
            >
              <Vlag taal={optie.code} maat={22} />
              {optie.naam}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
