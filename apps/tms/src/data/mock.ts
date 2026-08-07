import type { Adres, Rit, Taak, TaakEvent, TaakEventType, Zending } from "@sharzi/domain";
import type { DagSnapshot, DataBron } from "./bron";

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

export class MockDataBron implements DataBron {
  laadDag(_datum: string): Promise<DagSnapshot> {
    return Promise.resolve({
      ritten,
      taken,
      events,
      zendingen,
      ongepland: ["SHZ-114-021", "SHZ-114-022", "SHZ-114-023", "SHZ-114-024"],
    });
  }
}
