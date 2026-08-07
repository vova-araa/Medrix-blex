import type {
  Adres, DockEvent, DockEventType, EmballageTransactie, Order, Rit, Taak, TaakEvent, TaakEventType,
  WerktijdEvent, WerktijdEventType, Zending,
} from "@sharzi/domain";
import type { AdresInfo, DagSnapshot, DataBron, Klant, Tarief, WagenparkItem } from "./bron";

// Demodag voor Blex: 2026-08-07. Alle tijden staan in UTC (CLAUDE.md §5.3);
// Europe/Amsterdam is die dag UTC+2, dus 06:30 lokaal = 04:30Z.

const TENANT = "blex";
const dag = (tijd: string) => `2026-08-07T${tijd}:00Z`;

const depot: Adres = { naam: "Depot Venlo", plaats: "Venlo", land: "NL" };

let evTeller = 0;
const ev = (
  taakId: string,
  type: TaakEventType,
  tijd: string,
  wie: string,
  apparaat = "mobile"
): TaakEvent => ({
  id: `E-${String(++evTeller).padStart(3, "0")}`,
  tenantId: TENANT,
  taakId,
  type,
  tijdstip: dag(tijd),
  wie,
  apparaat,
});

const zendingen: Record<string, Zending> = {
  "SHZ-114-002": {
    id: "SHZ-114-002", tenantId: TENANT, orderId: "O-1001", barcode: "SHZ-114-002",
    laadmeters: 4.8, gewichtKg: 3900, omschrijving: "6 pallets droge kruidenierswaren",
    van: depot, naar: { naam: "DC Jumbo", plaats: "Veghel", land: "NL", tijdvenster: { van: dag("06:00"), tot: dag("07:00") } },
  },
  "SHZ-114-007": {
    id: "SHZ-114-007", tenantId: TENANT, orderId: "O-1002", barcode: "SHZ-114-007",
    laadmeters: 3.1, gewichtKg: 2100, omschrijving: "4 pallets veevoer",
    van: depot, naar: { naam: "Van Dijk Agro", plaats: "Helmond", land: "NL", tijdvenster: { van: dag("08:00"), tot: dag("09:00") } },
  },
  "SHZ-114-011": {
    id: "SHZ-114-011", tenantId: TENANT, orderId: "O-1003", barcode: "SHZ-114-011",
    laadmeters: 5.2, gewichtKg: 6400, omschrijving: "8 pallets fusten",
    van: depot, naar: { naam: "Brouwerij De Kroon", plaats: "Lieshout", land: "NL", tijdvenster: { van: dag("06:30"), tot: dag("08:00") } },
  },
  "SHZ-114-015": {
    id: "SHZ-114-015", tenantId: TENANT, orderId: "O-1004", barcode: "SHZ-114-015",
    laadmeters: 12.0, gewichtKg: 8800, omschrijving: "Deense karren snijbloemen (geconditioneerd)",
    van: { naam: "Kwekerij Maasbree", plaats: "Maasbree", land: "NL" },
    naar: { naam: "Veiling Aalsmeer", plaats: "Aalsmeer", land: "NL", tijdvenster: { van: dag("04:00"), tot: dag("08:00") } },
  },
  "SHZ-114-019": {
    id: "SHZ-114-019", tenantId: TENANT, orderId: "O-1005", barcode: "SHZ-114-019",
    laadmeters: 3.4, gewichtKg: 2900, omschrijving: "Bouwmaterialen op 5 pallets",
    van: depot, naar: { naam: "Bouwmarkt Roermond", plaats: "Roermond", land: "NL", tijdvenster: { van: dag("07:30"), tot: dag("10:00") } },
  },
  "SHZ-114-021": {
    id: "SHZ-114-021", tenantId: TENANT, orderId: "O-1006", barcode: "SHZ-114-021",
    laadmeters: 2.4, gewichtKg: 1860, omschrijving: "4 pallets · 1.860 kg",
    van: depot, naar: { naam: "DC Plus", plaats: "Haaksbergen", land: "NL", tijdvenster: { van: dag("11:00"), tot: dag("13:00") } },
  },
  "SHZ-114-022": {
    id: "SHZ-114-022", tenantId: TENANT, orderId: "O-1007", barcode: "SHZ-114-022",
    laadmeters: 6.0, gewichtKg: 9200, omschrijving: "8 pallets · 9.200 kg",
    van: { naam: "Steenfabriek Panningen", plaats: "Panningen", land: "NL" },
    naar: { naam: "Bouwplaats Waalfront", plaats: "Nijmegen", land: "NL", tijdvenster: { van: dag("04:00"), tot: dag("14:00") } },
  },
  "SHZ-114-023": {
    id: "SHZ-114-023", tenantId: TENANT, orderId: "O-1008", barcode: "SHZ-114-023",
    laadmeters: 3.1, gewichtKg: 950, omschrijving: "12 rolcontainers",
    van: depot, naar: { naam: "Van Dijk Agro", plaats: "Helmond", land: "NL", tijdvenster: { van: dag("12:00"), tot: dag("15:00") } },
  },
  "SHZ-114-024": {
    id: "SHZ-114-024", tenantId: TENANT, orderId: "O-1009", barcode: "SHZ-114-024",
    laadmeters: 2.5, gewichtKg: 700, omschrijving: "Retour: 26 europallets",
    van: { naam: "DC Jumbo", plaats: "Veghel", land: "NL", tijdvenster: { van: dag("10:00"), tot: dag("16:00") } },
    naar: depot,
  },
};

const ritten: Rit[] = [
  {
    id: "R-260807-01", tenantId: TENANT, datum: "2026-08-07", chauffeur: "J. Peeters", charter: false,
    voertuig: { kentekenGenormaliseerd: "43BKL7", landcode: "NL", omschrijving: "Trekker + city-trailer", capaciteitLaadmeters: 13.6 },
  },
  {
    id: "R-260807-02", tenantId: TENANT, datum: "2026-08-07", chauffeur: "M. Kowalski", charter: false,
    voertuig: { kentekenGenormaliseerd: "87TDF3", landcode: "NL", omschrijving: "Bakwagen", capaciteitLaadmeters: 8.0 },
  },
  {
    id: "R-260807-03", tenantId: TENANT, datum: "2026-08-07", chauffeur: "A. Ionescu", charter: true,
    voertuig: { kentekenGenormaliseerd: "B112XYZ", landcode: "RO", omschrijving: "Trekker + koeltrailer", capaciteitLaadmeters: 13.6 },
  },
  {
    id: "R-260807-04", tenantId: TENANT, datum: "2026-08-07", chauffeur: "S. de Boer", charter: false,
    voertuig: { kentekenGenormaliseerd: "12PGH9", landcode: "NL", omschrijving: "Bakwagen met laadklep", capaciteitLaadmeters: 8.0 },
  },
  {
    id: "R-260807-05", tenantId: TENANT, datum: "2026-08-07", chauffeur: "", charter: false,
    voertuig: { kentekenGenormaliseerd: "66KLM2", landcode: "NL", omschrijving: "Bakwagen", capaciteitLaadmeters: 8.0 },
  },
];

const taak = (
  id: string, ritId: string, soort: Taak["soort"], adres: Adres,
  van: string, tot: string, zendingId?: string
): Taak => ({
  id, tenantId: TENANT, ritId, soort, adres,
  geplandVan: dag(van), geplandTot: dag(tot), zendingId,
});

const taken: Taak[] = [
  taak("T-01", "R-260807-01", "laden", depot, "04:30", "05:00", "SHZ-114-002"),
  taak("T-02", "R-260807-01", "lossen", zendingen["SHZ-114-002"].naar, "06:00", "07:00", "SHZ-114-002"),
  taak("T-03", "R-260807-01", "lossen", zendingen["SHZ-114-007"].naar, "08:00", "08:45", "SHZ-114-007"),
  taak("T-04", "R-260807-01", "emballage_retour", depot, "10:00", "10:30"),
  taak("T-05", "R-260807-02", "laden", depot, "04:45", "05:15", "SHZ-114-011"),
  taak("T-06", "R-260807-02", "lossen", zendingen["SHZ-114-011"].naar, "06:45", "07:30", "SHZ-114-011"),
  taak("T-07", "R-260807-02", "laden", { naam: "Fustenloods", plaats: "Lieshout", land: "NL" }, "07:45", "08:15"),
  taak("T-08", "R-260807-03", "laden", zendingen["SHZ-114-015"].van, "04:00", "04:40", "SHZ-114-015"),
  taak("T-09", "R-260807-03", "lossen", zendingen["SHZ-114-015"].naar, "06:30", "07:30", "SHZ-114-015"),
  taak("T-10", "R-260807-04", "laden", depot, "06:00", "06:30", "SHZ-114-019"),
  taak("T-11", "R-260807-04", "lossen", zendingen["SHZ-114-019"].naar, "07:30", "08:10", "SHZ-114-019"),
];

const events: TaakEvent[] = [
  ev("T-01", "taak_aangemaakt", "03:55", "planning", "tms-web"),
  ev("T-02", "taak_aangemaakt", "03:55", "planning", "tms-web"),
  ev("T-03", "taak_aangemaakt", "03:55", "planning", "tms-web"),
  ev("T-04", "taak_aangemaakt", "03:55", "planning", "tms-web"),
  ev("T-05", "taak_aangemaakt", "03:56", "planning", "tms-web"),
  ev("T-06", "taak_aangemaakt", "03:56", "planning", "tms-web"),
  ev("T-07", "taak_aangemaakt", "03:56", "planning", "tms-web"),
  ev("T-08", "taak_aangemaakt", "03:57", "planning", "tms-web"),
  ev("T-09", "taak_aangemaakt", "03:57", "planning", "tms-web"),
  ev("T-10", "taak_aangemaakt", "03:58", "planning", "tms-web"),
  ev("T-11", "taak_aangemaakt", "03:58", "planning", "tms-web"),

  ev("T-01", "aangekomen", "04:28", "J. Peeters"),
  ev("T-01", "geladen", "04:57", "J. Peeters"),
  ev("T-02", "vertrokken", "05:01", "J. Peeters"),
  ev("T-02", "aangekomen", "05:56", "J. Peeters"),
  ev("T-02", "gelost", "06:54", "J. Peeters"),
  ev("T-03", "vertrokken", "07:01", "J. Peeters"),
  ev("T-03", "aangekomen", "07:57", "J. Peeters"),

  ev("T-05", "aangekomen", "04:42", "M. Kowalski"),
  ev("T-05", "geladen", "05:11", "M. Kowalski"),
  ev("T-06", "vertrokken", "05:16", "M. Kowalski"),
  ev("T-06", "aangekomen", "06:42", "M. Kowalski"),
  ev("T-06", "probleem_gemeld", "07:08", "M. Kowalski"),

  ev("T-08", "aangekomen", "03:58", "A. Ionescu"),
  ev("T-08", "geladen", "04:37", "A. Ionescu"),
  ev("T-09", "vertrokken", "04:42", "A. Ionescu"),
];

const orders: Record<string, Order> = {
  "O-1001": { id: "O-1001", tenantId: TENANT, opdrachtgever: "Jumbo Supermarkten BV", referentie: "JMB-88412" },
  "O-1002": { id: "O-1002", tenantId: TENANT, opdrachtgever: "Van Dijk Agro BV", referentie: "VDA-2231" },
  "O-1003": { id: "O-1003", tenantId: TENANT, opdrachtgever: "Brouwerij De Kroon", referentie: "KRN-0907" },
  "O-1004": { id: "O-1004", tenantId: TENANT, opdrachtgever: "Kwekerij Maasbree", referentie: "KWM-4410" },
  "O-1005": { id: "O-1005", tenantId: TENANT, opdrachtgever: "Bouwgroep Limburg BV", referentie: "BGL-7738" },
  "O-1006": { id: "O-1006", tenantId: TENANT, opdrachtgever: "Plus Retail", referentie: "PLS-1204" },
  "O-1007": { id: "O-1007", tenantId: TENANT, opdrachtgever: "Bouwgroep Limburg BV", referentie: "BGL-7801" },
  "O-1008": { id: "O-1008", tenantId: TENANT, opdrachtgever: "Van Dijk Agro BV", referentie: "VDA-2240" },
  "O-1009": { id: "O-1009", tenantId: TENANT, opdrachtgever: "Jumbo Supermarkten BV", referentie: "JMB-88430" },
};

// Voorbeeldfoto als inline SVG — echte uploads komen via de adresbibliotheek.
const voorbeeldFoto = (tekst: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">` +
    `<rect width="320" height="200" fill="#5c6674"/>` +
    `<rect x="30" y="70" width="200" height="90" fill="#8a93a1"/>` +
    `<rect x="240" y="90" width="50" height="70" fill="#464f5e"/>` +
    `<text x="16" y="34" fill="#fff" font-family="sans-serif" font-size="16">${tekst}</text></svg>`
  );

const adresInfo: Record<string, AdresInfo> = {
  "DC Jumbo|Veghel": {
    instructies:
      "Melden bij portier, dock 12–18. Max. hoogte 4,0 m op het terrein. " +
      "Pallets via dock, emballage retour direct meenemen. Wachttijd na 20 min melden.",
    fotos: [{ id: "F-001", label: "Ingang dock 12–18", dataUrl: voorbeeldFoto("DC Jumbo — dock 12-18") }],
  },
  "Brouwerij De Kroon|Lieshout": {
    instructies:
      "Achterom via de Sluisweg, poort 3. Fusten alleen met heftruck van de brouwerij lossen. " +
      "Niet parkeren voor de expeditie-deur.",
    fotos: [{ id: "F-002", label: "Poort 3, Sluisweg", dataUrl: voorbeeldFoto("De Kroon — poort 3") }],
  },
};

let wtTeller = 0;
const wt = (chauffeur: string, type: WerktijdEventType, tijd: string): WerktijdEvent => ({
  id: `W-${String(++wtTeller).padStart(3, "0")}`,
  tenantId: TENANT,
  chauffeur,
  type,
  tijdstip: dag(tijd),
});

const werktijden: WerktijdEvent[] = [
  wt("J. Peeters", "ingeklokt", "03:40"),
  wt("J. Peeters", "rijden_gestart", "03:50"),
  wt("J. Peeters", "werk_gestart", "04:28"),
  wt("J. Peeters", "rijden_gestart", "05:01"),
  wt("J. Peeters", "werk_gestart", "05:56"),
  wt("J. Peeters", "rijden_gestart", "07:01"),
  wt("J. Peeters", "werk_gestart", "07:57"),

  wt("M. Kowalski", "ingeklokt", "03:50"),
  wt("M. Kowalski", "werk_gestart", "04:42"),
  wt("M. Kowalski", "rijden_gestart", "05:16"),
  wt("M. Kowalski", "werk_gestart", "06:42"),
  wt("M. Kowalski", "pauze_gestart", "07:30"),

  wt("A. Ionescu", "ingeklokt", "03:30"),
  wt("A. Ionescu", "rijden_gestart", "03:40"),
  wt("A. Ionescu", "werk_gestart", "03:58"),
  wt("A. Ionescu", "rijden_gestart", "04:42"),

  wt("S. de Boer", "ingeklokt", "05:40"),
  wt("S. de Boer", "werk_gestart", "06:00"),
];

let etTeller = 0;
const et = (
  klant: string, soort: EmballageTransactie["soort"],
  geleverd: number, retour: number, tijd: string, ritId?: string
): EmballageTransactie => ({
  id: `ET-${String(++etTeller).padStart(3, "0")}`,
  tenantId: TENANT,
  klant, soort, geleverd, retour,
  tijdstip: dag(tijd),
  ritId,
  wie: ritId ? "chauffeur" : "depot",
});

const emballage: EmballageTransactie[] = [
  et("Jumbo Supermarkten BV", "europallet", 26, 0, "06:54", "R-260807-01"),
  et("Jumbo Supermarkten BV", "europallet", 0, 20, "06:55", "R-260807-01"),
  et("Jumbo Supermarkten BV", "rolcontainer", 12, 8, "06:55", "R-260807-01"),
  et("Brouwerij De Kroon", "fust", 96, 40, "05:30"),
  et("Van Dijk Agro BV", "europallet", 8, 8, "04:10"),
  et("Van Dijk Agro BV", "kist", 40, 0, "04:10"),
  et("Plus Retail", "rolcontainer", 18, 12, "05:00"),
];

// Mock-tarieven per opdrachtgever; via Facturen-tab aan te passen.
const tarieven: Record<string, Tarief> = {
  "Jumbo Supermarkten BV": { basisCenten: 4900, perLaadmeterCenten: 1750 },
  "Van Dijk Agro BV": { basisCenten: 4200, perLaadmeterCenten: 1900 },
  "Brouwerij De Kroon": { basisCenten: 4500, perLaadmeterCenten: 1850 },
  "Kwekerij Maasbree": { basisCenten: 5200, perLaadmeterCenten: 2100 },
  "Bouwgroep Limburg BV": { basisCenten: 4700, perLaadmeterCenten: 1950 },
  "Plus Retail": { basisCenten: 4800, perLaadmeterCenten: 1800 },
};

const wagenpark: WagenparkItem[] = [
  { kenteken: "43BKL7", landcode: "NL", omschrijving: "Trekker + city-trailer", kmStand: 412_680, apkTot: "2026-09-02", volgendeOnderhoudKm: 420_000, verbruikL100: 27.4, kostenPerMaandCenten: 312_500 },
  { kenteken: "87TDF3", landcode: "NL", omschrijving: "Bakwagen", kmStand: 188_240, apkTot: "2027-03-15", volgendeOnderhoudKm: 195_000, verbruikL100: 21.1, kostenPerMaandCenten: 218_000 },
  { kenteken: "12PGH9", landcode: "NL", omschrijving: "Bakwagen met laadklep", kmStand: 96_410, apkTot: "2026-08-21", volgendeOnderhoudKm: 100_000, verbruikL100: 22.8, kostenPerMaandCenten: 224_500 },
  { kenteken: "66KLM2", landcode: "NL", omschrijving: "Bakwagen", kmStand: 240_155, apkTot: "2026-11-30", volgendeOnderhoudKm: 245_000, verbruikL100: 21.9, kostenPerMaandCenten: 209_000 },
];

const klanten: Record<string, Klant> = {
  "Jumbo Supermarkten BV": { naam: "Jumbo Supermarkten BV", contactpersoon: "R. van den Berg", email: "transport@jumbo.example", telefoon: "088 001 1201" },
  "Van Dijk Agro BV": { naam: "Van Dijk Agro BV", contactpersoon: "K. van Dijk", email: "planning@vandijkagro.example", telefoon: "0492 33 41 20" },
  "Brouwerij De Kroon": { naam: "Brouwerij De Kroon", contactpersoon: "S. Vermeulen", email: "expeditie@dekroon.example", telefoon: "0499 42 18 07" },
  "Kwekerij Maasbree": { naam: "Kwekerij Maasbree", contactpersoon: "T. Peeters", email: "logistiek@kwekerijmaasbree.example", telefoon: "077 465 22 90" },
  "Bouwgroep Limburg BV": { naam: "Bouwgroep Limburg BV", contactpersoon: "M. Habets", email: "inkoop@bouwgroeplimburg.example", telefoon: "046 411 78 33" },
  "Plus Retail": { naam: "Plus Retail", contactpersoon: "D. Smits", email: "dc@plusretail.example", telefoon: "030 851 66 40" },
};

let dkTeller = 0;
const dk = (
  zendingId: string, type: DockEventType, tijd: string, locatie?: string
): DockEvent => ({
  id: `D-${String(++dkTeller).padStart(3, "0")}`,
  tenantId: TENANT,
  zendingId, type, locatie,
  tijdstip: dag(tijd),
  wie: "F. Janssen",
  apparaat: "dock-scanner",
});

const dockEvents: DockEvent[] = [
  dk("SHZ-114-021", "aangemeld", "03:50"),
  dk("SHZ-114-021", "ingescand", "05:12", "A2"),
  dk("SHZ-114-022", "aangemeld", "03:50"),
  dk("SHZ-114-023", "aangemeld", "03:50"),
  dk("SHZ-114-023", "ingescand", "05:40", "B1"),
  dk("SHZ-114-023", "schade_gemeld", "06:05"),
];

export class MockDataBron implements DataBron {
  laadDag(_datum: string): Promise<DagSnapshot> {
    return Promise.resolve({
      ritten,
      taken,
      events,
      zendingen,
      orders,
      ongepland: ["SHZ-114-021", "SHZ-114-022", "SHZ-114-023", "SHZ-114-024"],
      adresInfo,
      werktijden,
      emballage,
      tarieven,
      wagenpark,
      klanten,
      dockEvents,
    });
  }
}
