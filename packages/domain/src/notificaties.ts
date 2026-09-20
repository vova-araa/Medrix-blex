// Klantcommunicatie per opdrachtgever instelbaar.
//
// De ene klant wil bij elke stap bericht, de andere alleen bij problemen en
// begint te klagen bij meer. Eén instelling voor iedereen is daarom altijd
// fout voor de helft van je klanten. Hier staat per opdrachtgever welke
// gebeurtenis een bericht oplevert, aan wie, en boven welke drempel.
//
// De stand per gebeurtenis volgt dezelfde ladder als de rest van de
// automatisering: automatisch versturen, alleen voorstellen, of uit. Niets
// gaat de deur uit zonder dat het hier is ingesteld.

export type NotificatieGebeurtenis =
  /** De zending is ingepland op een rit en er is een dag en tijdvak. */
  | "ingepland"
  /** De chauffeur is naar het adres vertrokken. */
  | "onderweg"
  /** De verwachte aankomsttijd is verschoven. */
  | "eta_gewijzigd"
  /** De levering haalt het afgesproken tijdvenster niet. */
  | "vertraging"
  /** Geleverd, met de POD erbij. */
  | "afgeleverd"
  /** Er is een probleem gemeld op het adres. */
  | "probleem"
  /** Er zijn wachturen ontstaan die op de factuur komen. */
  | "wachturen";

export const NOTIFICATIE_GEBEURTENISSEN: readonly NotificatieGebeurtenis[] = [
  "ingepland", "onderweg", "eta_gewijzigd", "vertraging", "afgeleverd", "probleem", "wachturen",
];

export type NotificatieStand = "automatisch" | "voorstel" | "uit";

export interface NotificatieRegel {
  gebeurtenis: NotificatieGebeurtenis;
  stand: NotificatieStand;
  /**
   * Drempel in minuten. Alleen zinvol bij `eta_gewijzigd` en `vertraging`:
   * onder deze verschuiving gaat er geen bericht uit. Zonder drempel stuurt
   * een ETA die om de vijf minuten schuift de klant gek.
   */
  drempelMinuten?: number;
}

export interface Notificatievoorkeur {
  opdrachtgever: string;
  /** Adres waar de berichten heen gaan; leeg betekent: niet versturen. */
  email: string;
  /** Ook de ontvanger op het losadres meenemen, als die bekend is. */
  ookOntvanger: boolean;
  regels: NotificatieRegel[];
}

export const STANDAARD_DREMPEL_MINUTEN = 15;

/** Waar een nieuwe klant mee begint: melden wat ertoe doet, de rest uit. */
export function standaardVoorkeur(opdrachtgever: string, email = ""): Notificatievoorkeur {
  return {
    opdrachtgever,
    email,
    ookOntvanger: false,
    regels: NOTIFICATIE_GEBEURTENISSEN.map((gebeurtenis) => ({
      gebeurtenis,
      // Alleen wat de klant echt moet weten staat standaard aan. De rest kan
      // hij zelf aanzetten; ongevraagd mailen kost meer goodwill dan het
      // oplevert.
      stand: gebeurtenis === "vertraging" || gebeurtenis === "afgeleverd"
        ? "automatisch"
        : gebeurtenis === "eta_gewijzigd" || gebeurtenis === "probleem"
          ? "voorstel"
          : "uit",
      ...(gebeurtenis === "eta_gewijzigd" || gebeurtenis === "vertraging"
        ? { drempelMinuten: STANDAARD_DREMPEL_MINUTEN }
        : {}),
    })),
  };
}

export function regelVan(
  voorkeur: Notificatievoorkeur | undefined,
  gebeurtenis: NotificatieGebeurtenis
): NotificatieRegel | undefined {
  return voorkeur?.regels.find((r) => r.gebeurtenis === gebeurtenis);
}

export type OordeelReden =
  | "geen_voorkeur"
  | "uit"
  | "geen_email"
  | "onder_drempel"
  | "al_verstuurd";

export interface NotificatieOordeel {
  /** Mag dit bericht de deur uit zonder dat een mens erop klikt? */
  automatisch: boolean;
  /** Moet het als voorstel aan de planner worden getoond? */
  voorstel: boolean;
  /** Waarom er niets gebeurt; alleen gevuld als er niets gebeurt. */
  reden?: OordeelReden;
  ontvangers: string[];
}

export interface BeoordeelInvoer {
  voorkeur: Notificatievoorkeur | undefined;
  gebeurtenis: NotificatieGebeurtenis;
  /** Verschuiving in minuten; alleen nodig bij ETA en vertraging. */
  verschuivingMinuten?: number;
  /** E-mailadres van de ontvanger op het losadres, als dat bekend is. */
  ontvangerEmail?: string;
  /**
   * Is er voor deze zending en gebeurtenis al een bericht uitgegaan met
   * dezelfde strekking? Dan niet nog eens — dubbel mailen is erger dan niet
   * mailen.
   */
  alVerstuurd?: boolean;
}

/**
 * Beslist of er een bericht uitgaat. Geeft altijd een reden terug als er niets
 * gebeurt, zodat de planner kan zien waaróm een klant niets heeft gehad.
 */
export function beoordeelNotificatie(invoer: BeoordeelInvoer): NotificatieOordeel {
  const stil = (reden: OordeelReden): NotificatieOordeel =>
    ({ automatisch: false, voorstel: false, reden, ontvangers: [] });

  const regel = regelVan(invoer.voorkeur, invoer.gebeurtenis);
  if (!invoer.voorkeur || !regel) return stil("geen_voorkeur");
  if (regel.stand === "uit") return stil("uit");
  if (invoer.alVerstuurd) return stil("al_verstuurd");

  if (regel.drempelMinuten !== undefined) {
    const verschuiving = Math.abs(invoer.verschuivingMinuten ?? 0);
    if (verschuiving < regel.drempelMinuten) return stil("onder_drempel");
  }

  const ontvangers = [
    invoer.voorkeur.email.trim(),
    invoer.voorkeur.ookOntvanger ? (invoer.ontvangerEmail ?? "").trim() : "",
  ].filter((adres) => adres !== "");
  if (ontvangers.length === 0) return stil("geen_email");

  return {
    automatisch: regel.stand === "automatisch",
    voorstel: regel.stand === "voorstel",
    ontvangers: [...new Set(ontvangers)],
  };
}

// ── Logboek ─────────────────────────────────────────────────────────────────

export type NotificatieHerkomst = "automatisch" | "planner";

export interface VerstuurdeNotificatie {
  id: string;
  tenantId: string;
  opdrachtgever: string;
  gebeurtenis: NotificatieGebeurtenis;
  zendingId: string;
  ontvangers: readonly string[];
  onderwerp: string;
  tekst: string;
  tijdstip: string;
  herkomst: NotificatieHerkomst;
  /** Verschuiving die het bericht veroorzaakte, voor de onderbouwing. */
  verschuivingMinuten?: number;
}

/**
 * Is er voor deze zending al een bericht over deze gebeurtenis uitgegaan? Bij
 * een ETA-wijziging telt het alleen als dubbel wanneer de tijd sindsdien niet
 * noemenswaardig verder is verschoven.
 */
export function alGemeld(
  log: readonly VerstuurdeNotificatie[],
  zendingId: string,
  gebeurtenis: NotificatieGebeurtenis,
  nieuweVerschuivingMinuten?: number,
  drempelMinuten = STANDAARD_DREMPEL_MINUTEN
): boolean {
  const eerder = log
    .filter((n) => n.zendingId === zendingId && n.gebeurtenis === gebeurtenis)
    .at(-1);
  if (!eerder) return false;
  if (nieuweVerschuivingMinuten === undefined || eerder.verschuivingMinuten === undefined) {
    return true;
  }
  return Math.abs(nieuweVerschuivingMinuten - eerder.verschuivingMinuten) < drempelMinuten;
}

/** Wat er per opdrachtgever is uitgegaan, nieuwste eerst. */
export function logVanKlant(
  log: readonly VerstuurdeNotificatie[],
  opdrachtgever: string
): VerstuurdeNotificatie[] {
  return log
    .filter((n) => n.opdrachtgever === opdrachtgever)
    .sort((a, b) => Date.parse(b.tijdstip) - Date.parse(a.tijdstip));
}

export interface KlantTelling {
  opdrachtgever: string;
  totaal: number;
  automatisch: number;
  handmatig: number;
  laatste: string | null;
}

/** Hoeveel berichten elke klant heeft gehad — om te zien wie je overvoert. */
export function tellingPerKlant(log: readonly VerstuurdeNotificatie[]): KlantTelling[] {
  const per = new Map<string, KlantTelling>();
  for (const bericht of log) {
    const bestaand = per.get(bericht.opdrachtgever) ?? {
      opdrachtgever: bericht.opdrachtgever,
      totaal: 0, automatisch: 0, handmatig: 0, laatste: null,
    };
    bestaand.totaal += 1;
    if (bericht.herkomst === "automatisch") bestaand.automatisch += 1;
    else bestaand.handmatig += 1;
    if (!bestaand.laatste || Date.parse(bericht.tijdstip) > Date.parse(bestaand.laatste)) {
      bestaand.laatste = bericht.tijdstip;
    }
    per.set(bericht.opdrachtgever, bestaand);
  }
  return [...per.values()].sort((a, b) => b.totaal - a.totaal);
}
