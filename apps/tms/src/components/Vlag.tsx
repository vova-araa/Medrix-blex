import type { Taal } from "../i18n";

// Vlaggen als SVG, niet als emoji: emoji-vlaggen worden op Windows niet als
// vlag getekend maar als twee letters, en juist daar draait de kantoorapp.
// Eenvoudige vormen, herkenbaar op 24 pixels breed.

const VLAGGEN: Record<Taal, JSX.Element> = {
  nl: (
    <>
      <rect width="24" height="6" fill="#AE1C28" />
      <rect y="6" width="24" height="6" fill="#FFFFFF" />
      <rect y="12" width="24" height="6" fill="#21468B" />
    </>
  ),
  en: (
    <>
      <rect width="24" height="18" fill="#012169" />
      {/* Diagonalen: eerst wit, dan de rode banen erbovenop. */}
      <path d="M0 0 24 18M24 0 0 18" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M0 0 24 18M24 0 0 18" stroke="#C8102E" strokeWidth="2" />
      {/* Kruis van Sint-Joris. */}
      <path d="M12 0v18M0 9h24" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M12 0v18M0 9h24" stroke="#C8102E" strokeWidth="3.5" />
    </>
  ),
  pl: (
    <>
      <rect width="24" height="9" fill="#FFFFFF" />
      <rect y="9" width="24" height="9" fill="#DC143C" />
    </>
  ),
  ro: (
    <>
      <rect width="8" height="18" fill="#002B7F" />
      <rect x="8" width="8" height="18" fill="#FCD116" />
      <rect x="16" width="8" height="18" fill="#CE1126" />
    </>
  ),
};

/** Landcode bij de taal, voor het label naast de vlag. */
export const TAALCODE: Record<Taal, string> = { nl: "NL", en: "EN", pl: "PL", ro: "RO" };

export function Vlag({ taal, maat = 24 }: { taal: Taal; maat?: number }) {
  return (
    <svg
      className="vlag"
      width={maat}
      height={(maat / 4) * 3}
      viewBox="0 0 24 18"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <g>{VLAGGEN[taal]}</g>
      <rect x="0.5" y="0.5" width="23" height="17" fill="none" stroke="rgba(0,0,0,0.25)" />
    </svg>
  );
}
