// Mailsjablonen: vaste teksten met variabelen, zodat de administratie niet
// elke keer hetzelfde typt en de toon consequent blijft. De sjablonen zelf
// zijn tekst; alle UI-teksten blijven vertaalbaar (§7.5).
//
// Een ontbrekende variabele wordt nooit stil als lege tekst ingevuld — dan
// gaat er een mail de deur uit met "Beste ," erin. Die fout willen we zien.

export type SjabloonId =
  | "factuur_versturen"
  | "betalingsherinnering"
  | "levering_aankondiging"
  | "vertraging_melden"
  | "wachturen_toelichten"
  | "emballage_saldo";

export interface Sjabloon {
  id: SjabloonId;
  onderwerp: string;
  tekst: string;
  /** Variabelen die ingevuld moeten zijn voordat de mail verstuurd mag worden. */
  variabelen: string[];
}

export const SJABLONEN: Sjabloon[] = [
  {
    id: "factuur_versturen",
    onderwerp: "Factuur {factuurnummer} van {ons}",
    tekst:
      "Beste {contactpersoon},\n\n" +
      "Bijgaand factuur {factuurnummer} van {datum} voor de uitgevoerde transporten, " +
      "voor een totaalbedrag van {totaal}.\n\n" +
      "Wij verzoeken u het bedrag vóór {vervaldatum} over te maken onder vermelding " +
      "van het factuurnummer.\n\n" +
      "Met vriendelijke groet,\n{ons}",
    variabelen: ["contactpersoon", "factuurnummer", "datum", "totaal", "vervaldatum", "ons"],
  },
  {
    id: "betalingsherinnering",
    onderwerp: "Herinnering: factuur {factuurnummer} is vervallen",
    tekst:
      "Beste {contactpersoon},\n\n" +
      "Factuur {factuurnummer} van {datum} met een bedrag van {totaal} is op " +
      "{vervaldatum} vervallen en staat nog {dagenTeLaat} dagen open.\n\n" +
      "Mocht de betaling inmiddels onderweg zijn, dan kunt u dit bericht als niet " +
      "verzonden beschouwen. Is er iets onduidelijk aan de factuur, laat het ons weten.\n\n" +
      "Met vriendelijke groet,\n{ons}",
    variabelen: ["contactpersoon", "factuurnummer", "datum", "totaal", "vervaldatum", "dagenTeLaat", "ons"],
  },
  {
    id: "levering_aankondiging",
    onderwerp: "Levering {zending} op {datum}",
    tekst:
      "Beste {contactpersoon},\n\n" +
      "Wij leveren zending {zending} op {datum} tussen {vensterVan} en {vensterTot} " +
      "af op {adres}.\n\n" +
      "Wilt u ervoor zorgen dat er iemand aanwezig is om te tekenen? Wijzigingen " +
      "horen wij graag uiterlijk de dag ervoor.\n\n" +
      "Met vriendelijke groet,\n{ons}",
    variabelen: ["contactpersoon", "zending", "datum", "vensterVan", "vensterTot", "adres", "ons"],
  },
  {
    id: "vertraging_melden",
    onderwerp: "Gewijzigde aankomsttijd zending {zending}",
    tekst:
      "Beste {contactpersoon},\n\n" +
      "Onze chauffeur loopt vertraging op. Zending {zending} komt naar verwachting " +
      "om {eta} aan in plaats van het afgesproken venster.\n\n" +
      "Onze excuses voor het ongemak. Zodra er iets verandert, laten wij het weten.\n\n" +
      "Met vriendelijke groet,\n{ons}",
    variabelen: ["contactpersoon", "zending", "eta", "ons"],
  },
  {
    id: "wachturen_toelichten",
    onderwerp: "Toelichting wachturen {adres}",
    tekst:
      "Beste {contactpersoon},\n\n" +
      "Op factuur {factuurnummer} staan wachturen voor {adres}. Onze chauffeur is " +
      "daar om {aankomst} aangekomen en om {vertrek} vertrokken; dat is {wachtMinuten} " +
      "minuten boven de afgesproken vrije wachttijd van 30 minuten.\n\n" +
      "De tijden komen uit de registratie van de chauffeur en zijn op verzoek in te zien.\n\n" +
      "Met vriendelijke groet,\n{ons}",
    variabelen: ["contactpersoon", "factuurnummer", "adres", "aankomst", "vertrek", "wachtMinuten", "ons"],
  },
  {
    id: "emballage_saldo",
    onderwerp: "Emballagesaldo per {datum}",
    tekst:
      "Beste {contactpersoon},\n\n" +
      "Hierbij het emballagesaldo per {datum}:\n\n{saldoregels}\n\n" +
      "Het saldo is berekend uit alle geregistreerde transacties. Wijkt dit af van " +
      "uw eigen administratie, dan zoeken we het graag samen uit.\n\n" +
      "Met vriendelijke groet,\n{ons}",
    variabelen: ["contactpersoon", "datum", "saldoregels", "ons"],
  },
];

export interface IngevuldSjabloon {
  onderwerp: string;
  tekst: string;
  /** Variabelen waarvoor geen waarde is aangeleverd. */
  ontbrekend: string[];
}

const VARIABELE = /\{(\w+)\}/g;

/**
 * Vult een sjabloon in. Ontbrekende variabelen blijven zichtbaar staan als
 * `{naam}` en worden apart teruggegeven — beter een zichtbaar gat dan een
 * mail met "Beste ," erin.
 */
export function vulSjabloon(
  sjabloon: Sjabloon,
  waarden: Record<string, string | number | undefined>
): IngevuldSjabloon {
  const ontbrekend = new Set<string>();
  const vervang = (tekst: string) =>
    tekst.replace(VARIABELE, (heel, naam: string) => {
      const waarde = waarden[naam];
      if (waarde === undefined || waarde === null || String(waarde).trim() === "") {
        ontbrekend.add(naam);
        return heel;
      }
      return String(waarde);
    });

  return {
    onderwerp: vervang(sjabloon.onderwerp),
    tekst: vervang(sjabloon.tekst),
    ontbrekend: [...ontbrekend],
  };
}

export function sjabloonVan(id: SjabloonId): Sjabloon {
  const gevonden = SJABLONEN.find((s) => s.id === id);
  if (!gevonden) throw new Error(`Onbekend mailsjabloon: ${id}`);
  return gevonden;
}
