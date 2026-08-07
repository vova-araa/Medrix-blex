// Eigen icoonsysteem: stroke-iconen op een 24×24-raster, getekend voor Sharzi.
// Kleur loopt mee via currentColor zodat elk icoon de tekst- of statuskleur
// van zijn context volgt. Geen emoji, geen externe iconenset.

export type IcoonNaam =
  | "bedrijf" | "truck" | "planbord" | "operatie" | "kaart" | "klok"
  | "factuur" | "klanten" | "emballage" | "portaal" | "wagenpark"
  | "rapportage" | "assistent" | "dock" | "edi" | "document" | "boek"
  | "modules" | "check" | "waarschuwing" | "pakket" | "pijl" | "locatie"
  | "pen" | "speel" | "stopblok" | "koffie" | "stuur" | "camera" | "maan"
  | "vlag" | "plus" | "kruis" | "timer" | "info";

const PADEN: Record<IcoonNaam, JSX.Element> = {
  bedrijf: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 9h5a1 1 0 0 1 1 1v11M3 21h18" />
      <path d="M7.5 8h3M7.5 12h3M7.5 16h3M17 13h.5M17 17h.5" />
    </>
  ),
  truck: (
    <>
      <path d="M2 16.5V7.5a.5.5 0 0 1 .5-.5H13v9.5" />
      <path d="M13 10.5h3.6l2.9 3v3h-2" />
      <path d="M2 16.5h1.7M8.3 16.5H13" />
      <circle cx="5.5" cy="17.5" r="1.9" />
      <circle cx="15.6" cy="17.5" r="1.9" />
    </>
  ),
  planbord: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.5h17M8 5V3M16 5V3" />
      <path d="M7 13h4M7 16.5h4M14 13h3" />
    </>
  ),
  operatie: (
    <>
      <path d="M3 12h4l2.5-6 4 12L16 12h5" />
    </>
  ),
  kaart: (
    <>
      <path d="M12 21s-6.3-5.4-6.3-9.7a6.3 6.3 0 0 1 12.6 0C18.3 15.6 12 21 12 21z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  klok: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.4 2" />
    </>
  ),
  factuur: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14.5 3.5V8H19" />
      <path d="M9 12.5h6M9 16h4" />
    </>
  ),
  klanten: (
    <>
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 5.7a3.3 3.3 0 0 1 0 5.6M17.5 14.8a5.5 5.5 0 0 1 3 5.2" />
    </>
  ),
  emballage: (
    <>
      <path d="M5 12h6v4.5H5zM13 12h6v4.5h-6zM9 7h6v5H9z" />
      <path d="M3.5 19.5h17M5.5 19.5v1.5M18.5 19.5v1.5M12 19.5v1.5" />
    </>
  ),
  portaal: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.6 15.6 20.5 20.5" />
      <path d="M8.5 11a2.5 2.5 0 0 1 2.5-2.5" />
    </>
  ),
  wagenpark: (
    <>
      <path d="M4.5 19a8.5 8.5 0 1 1 15 0" />
      <path d="M12 13.5 15.2 10" />
      <circle cx="12" cy="14" r="1.2" />
    </>
  ),
  rapportage: (
    <>
      <path d="M5 20v-7M10 20V5.5M15 20v-9.5M20 20V9" />
      <path d="M3 20h18" />
    </>
  ),
  assistent: (
    <>
      <path d="M11 4l1.6 4.6L17.2 10l-4.6 1.6L11 16l-1.6-4.4L4.8 10l4.6-1.4z" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
    </>
  ),
  dock: (
    <>
      <path d="M3.5 20V9L12 4l8.5 5v11" />
      <path d="M7.5 20v-5.5h9V20M7.5 17.5h9" />
    </>
  ),
  edi: (
    <>
      <path d="M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5L16 16.5" />
      <path d="M13.2 6 10.8 18" />
    </>
  ),
  document: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14.5 3.5V8H19" />
    </>
  ),
  boek: (
    <>
      <path d="M4.5 19.5V5.5A2 2 0 0 1 6.5 3.5H19.5v14H6.5a2 2 0 0 0-2 2zM4.5 19.5a2 2 0 0 0 2 2H19.5v-4" />
      <path d="M9 7.5h6" />
    </>
  ),
  modules: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <path d="M16.75 13.5v6.5M13.5 16.75H20" />
    </>
  ),
  check: <path d="M5 13l4.2 4.2L19 7" />,
  waarschuwing: (
    <>
      <path d="M12 4.2 2.8 19.8h18.4z" />
      <path d="M12 10v4.2M12 17.2v.2" />
    </>
  ),
  pakket: (
    <>
      <path d="M4 7.6 12 3.5l8 4.1v8.8l-8 4.1-8-4.1z" />
      <path d="M4 7.6l8 4.1 8-4.1M12 11.7v8.8" />
    </>
  ),
  pijl: <path d="M4.5 12H19M13.5 6l6 6-6 6" />,
  locatie: (
    <>
      <path d="M12 21s-6.3-5.4-6.3-9.7a6.3 6.3 0 0 1 12.6 0C18.3 15.6 12 21 12 21z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  pen: (
    <>
      <path d="M4.5 19.5l.9-3.6L16.7 4.6a1.6 1.6 0 0 1 2.3 0l.4.4a1.6 1.6 0 0 1 0 2.3L8.1 18.6z" />
      <path d="M14.8 6.5l2.7 2.7M4 21h16" />
    </>
  ),
  speel: <path d="M8.5 5.5v13l10-6.5z" />,
  stopblok: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />,
  koffie: (
    <>
      <path d="M5 10h11v4.5a5 5 0 0 1-5.5 5h0A5 5 0 0 1 5 14.5z" />
      <path d="M16 11h1.8a2.2 2.2 0 0 1 0 4.4H16" />
      <path d="M8 4.5c0 1.2.7 1.3.7 2.5M11.5 4.5c0 1.2.7 1.3.7 2.5" />
    </>
  ),
  stuur: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 14.4V20.5M4 10.5l5.7.9M20 10.5l-5.7.9" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5h3.4L9.2 6h5.6l1.8 2.5H20V19H4z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </>
  ),
  maan: <path d="M19.5 14.8A8.2 8.2 0 1 1 9.2 4.5a6.6 6.6 0 0 0 10.3 10.3z" />,
  vlag: (
    <>
      <path d="M5.5 21V4" />
      <path d="M5.5 5h11.5l-2.3 3.3L17 11.5H5.5" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  kruis: <path d="M6 6l12 12M18 6 6 18" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.6 1.6M9.5 3.5h5M12 3.5v2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.2" />
    </>
  ),
};

interface Props {
  naam: IcoonNaam;
  maat?: number;
  /** Extra class voor kleur of uitlijning. */
  className?: string;
}

export function Icoon({ naam, maat = 16, className }: Props) {
  const dicht = naam === "speel";
  return (
    <svg
      className={`icoon${className ? ` ${className}` : ""}`}
      width={maat}
      height={maat}
      viewBox="0 0 24 24"
      fill={dicht ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PADEN[naam]}
    </svg>
  );
}
