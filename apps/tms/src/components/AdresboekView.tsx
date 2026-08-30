import type { Adres } from "@sharzi/domain";
import { useMemo, useState, type ChangeEvent } from "react";
import { adresSleutel, type AdresFoto } from "../data/bron";
import { adresInfoVan, type AppState } from "../data/state";
import { t } from "../i18n";
import { Icoon } from "./Icoon";

// Het adresboek: alle plekken waar wij komen, met de kennis die anders alleen
// in het hoofd van de vaste chauffeur zit. Waar je moet melden, welke poort,
// welke hoogte, waar de heftruck staat.
//
// De chauffeur ziet dezelfde instructies en foto's op zijn stop; hier worden ze
// onderhouden. De sleutel is naam + plaats (zie adresSleutel), dus een adres
// dat op meerdere ritten voorkomt heeft één set instructies.

type Soort = "depot" | "laden" | "lossen" | "beide";

interface AdresRegel {
  sleutel: string;
  adres: Adres;
  soort: Soort;
  /** Hoe vaak wij hier dit jaar geweest zijn of nog komen. */
  stops: number;
  instructies: string;
  fotos: AdresFoto[];
}

export function AdresboekView({ state, onZetInstructies, onVoegFotoToe }: {
  state: AppState;
  onZetInstructies: (sleutel: string, instructies: string) => void;
  onVoegFotoToe: (sleutel: string, foto: AdresFoto) => void;
}) {
  const [zoek, setZoek] = useState("");
  const [alleenZonder, setAlleenZonder] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const regels = useMemo(() => verzamelAdressen(state), [state]);
  const term = zoek.trim().toLowerCase();
  const zichtbaar = regels.filter((r) => {
    if (alleenZonder && r.instructies.trim() !== "") return false;
    if (!term) return true;
    return `${r.adres.naam} ${r.adres.plaats}`.toLowerCase().includes(term);
  });
  const zonderInstructies = regels.filter((r) => r.instructies.trim() === "").length;

  return (
    <div className="uren-main adresboek">
      <div className="ph-card uren-kaart">
        <h3 className="zij-kop">{t("adresboek.titel")}</h3>
        <p className="uren-noot">{t("adresboek.noot")}</p>

        <div className="doc-balk">
          <input
            className="doc-zoek"
            type="search"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t("adresboek.zoek")}
          />
          <label className="doc-filter">
            <input
              type="checkbox"
              checked={alleenZonder}
              onChange={(e) => setAlleenZonder(e.target.checked)}
            />
            {t("adresboek.alleenZonder", { n: zonderInstructies })}
          </label>
          <span className="doc-telling">{t("adresboek.telling", { n: zichtbaar.length })}</span>
        </div>

        <div className="ab-lijst">
          {zichtbaar.length === 0 && <p className="kaart-kies">{t("adresboek.geenResultaat")}</p>}
          {zichtbaar.map((regel) => (
            <AdresKaart
              key={regel.sleutel}
              regel={regel}
              open={open === regel.sleutel}
              onToggle={() => setOpen(open === regel.sleutel ? null : regel.sleutel)}
              onZetInstructies={onZetInstructies}
              onVoegFotoToe={onVoegFotoToe}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Alle adressen die in de data voorkomen: depots, laadadressen en losadressen,
 * ontdubbeld op naam + plaats. Zo staat er niets in het adresboek waar wij niet
 * werkelijk komen.
 */
function verzamelAdressen(state: AppState): AdresRegel[] {
  const per = new Map<string, { adres: Adres; laden: boolean; lossen: boolean; stops: number }>();

  const voegToe = (adres: Adres, soort: "laden" | "lossen", telMee: boolean) => {
    const sleutel = adresSleutel(adres);
    const bestaand = per.get(sleutel);
    if (bestaand) {
      bestaand.laden ||= soort === "laden";
      bestaand.lossen ||= soort === "lossen";
      if (telMee) bestaand.stops += 1;
      // Een tijdvenster hoort bij de taak, niet bij het adresboek.
      return;
    }
    per.set(sleutel, {
      adres: { naam: adres.naam, plaats: adres.plaats, land: adres.land },
      laden: soort === "laden",
      lossen: soort === "lossen",
      stops: telMee ? 1 : 0,
    });
  };

  for (const zending of Object.values(state.zendingen)) {
    voegToe(zending.van, "laden", false);
    voegToe(zending.naar, "lossen", false);
  }
  for (const taak of state.taken) {
    voegToe(taak.adres, taak.soort === "laden" ? "laden" : "lossen", true);
  }

  return [...per.entries()]
    .map(([sleutel, { adres, laden, lossen, stops }]) => {
      const info = adresInfoVan(state, adres);
      return {
        sleutel,
        adres,
        soort: soortVan(adres, laden, lossen),
        stops,
        instructies: info?.instructies ?? "",
        fotos: info?.fotos ?? [],
      };
    })
    .sort((a, b) => b.stops - a.stops || a.adres.naam.localeCompare(b.adres.naam));
}

function soortVan(adres: Adres, laden: boolean, lossen: boolean): Soort {
  if (/depot/i.test(adres.naam)) return "depot";
  if (laden && lossen) return "beide";
  return laden ? "laden" : "lossen";
}

function AdresKaart({ regel, open, onToggle, onZetInstructies, onVoegFotoToe }: {
  regel: AdresRegel;
  open: boolean;
  onToggle: () => void;
  onZetInstructies: (sleutel: string, instructies: string) => void;
  onVoegFotoToe: (sleutel: string, foto: AdresFoto) => void;
}) {
  const [concept, setConcept] = useState(regel.instructies);
  const gewijzigd = concept !== regel.instructies;

  function fotoGekozen(e: ChangeEvent<HTMLInputElement>) {
    const bestand = e.target.files?.[0];
    if (!bestand) return;
    const lezer = new FileReader();
    lezer.onload = () => {
      onVoegFotoToe(regel.sleutel, {
        id: crypto.randomUUID(),
        label: bestand.name,
        dataUrl: String(lezer.result),
      });
    };
    lezer.readAsDataURL(bestand);
    e.target.value = "";
  }

  return (
    <div className={`ab-kaart${open ? " open" : ""}`}>
      <button className="ab-kop" onClick={onToggle} aria-expanded={open}>
        <span className="ab-naam">
          <b>{regel.adres.naam}</b>
          <span className="ab-plaats">{regel.adres.plaats}, {regel.adres.land}</span>
        </span>
        <span className={`ab-soort s-${regel.soort}`}>{t(`adresboek.soort.${regel.soort}`)}</span>
        <span className="ab-meta">
          {regel.fotos.length > 0 && (
            <span className="ab-fotos"><Icoon naam="camera" maat={12} /> {regel.fotos.length}</span>
          )}
          {regel.instructies.trim()
            ? <span className="ab-heeft"><Icoon naam="check" maat={12} /> {t("adresboek.heeftInstructies")}</span>
            : <span className="ab-mist">{t("adresboek.geenInstructies")}</span>}
        </span>
        <Icoon naam={open ? "chevron-links" : "chevron-rechts"} maat={14} />
      </button>

      {open && (
        <div className="ab-body">
          <p className="events-note">{t("adresboek.uitleg")}</p>
          <textarea
            className="adres-instructies"
            value={concept}
            placeholder={t("adresboek.placeholder")}
            onChange={(e) => setConcept(e.target.value)}
          />
          <div className="adres-acties">
            <button
              className="btn primary ab-opslaan"
              disabled={!gewijzigd}
              onClick={() => onZetInstructies(regel.sleutel, concept)}
            >
              {t("adres.opslaan")}
            </button>
            <label className="btn adres-upload knop-met-icoon">
              <Icoon naam="camera" maat={14} /> {t("adres.fotoToevoegen")}
              <input type="file" accept="image/*" onChange={fotoGekozen} hidden />
            </label>
          </div>

          {regel.fotos.length > 0 && (
            <ul className="ab-fotolijst">
              {regel.fotos.map((foto) => (
                <li key={foto.id}>
                  <img src={foto.dataUrl} alt={foto.label} />
                  <span>{foto.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
