// Moduleregister: Sharzi is per module verkoopbaar. Elke module kan per
// tenant aan of uit staan; kernmodules horen bij elk abonnement. Modules met
// `inOntwikkeling` staan wel in de catalogus (verkoopvitrine) maar zijn nog
// niet leverbaar. Alle module-namen en -omschrijvingen zijn eigen werk.

import type { IcoonNaam } from "../components/Icoon";

export type ModuleId =
  | "planbord"
  | "operatie"
  | "kaart"
  | "uren"
  | "facturen"
  | "klanten"
  | "emballage"
  | "portaal"
  | "wagenpark"
  | "rapportage"
  | "assistent"
  | "dock"
  | "edi"
  | "documenten"
  | "adresboek"
  | "boekhouding"
  | "berichten"
  | "koppelingen";

/** Navigatiegroepen: de zijbalk toont de modules per werkgebied. */
export type ModuleGroep = "planning" | "administratie" | "data" | "systeem";

export const MODULE_GROEPEN: ModuleGroep[] = ["planning", "administratie", "data", "systeem"];

export interface ModuleDef {
  id: ModuleId;
  icoon: IcoonNaam;
  groep: ModuleGroep;
  /** Kernmodules zitten in elk abonnement en kunnen niet uit. */
  kern?: boolean;
  /** Zichtbaar in de catalogus, nog niet leverbaar. */
  inOntwikkeling?: boolean;
  /** Heeft een eigen tab in de navigatie. */
  tab?: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: "planbord", icoon: "planbord", groep: "planning", kern: true, tab: true },
  { id: "operatie", icoon: "operatie", groep: "planning", kern: true, tab: true },
  { id: "kaart", icoon: "kaart", groep: "planning", tab: true },
  { id: "uren", icoon: "klok", groep: "administratie", tab: true },
  { id: "facturen", icoon: "factuur", groep: "administratie", tab: true },
  { id: "klanten", icoon: "klanten", groep: "administratie", tab: true },
  { id: "emballage", icoon: "emballage", groep: "administratie", tab: true },
  { id: "portaal", icoon: "portaal", groep: "data", tab: true },
  { id: "wagenpark", icoon: "wagenpark", groep: "data", tab: true },
  { id: "rapportage", icoon: "rapportage", groep: "data", tab: true },
  { id: "assistent", icoon: "assistent", groep: "planning" },
  { id: "dock", icoon: "dock", groep: "data" },
  { id: "edi", icoon: "edi", groep: "systeem", inOntwikkeling: true },
  { id: "documenten", icoon: "document", groep: "data", tab: true },
  { id: "adresboek", icoon: "locatie", groep: "data", tab: true },
  { id: "boekhouding", icoon: "boek", groep: "systeem", inOntwikkeling: true },
  { id: "berichten", icoon: "mail", groep: "systeem", tab: true },
  { id: "koppelingen", icoon: "koppeling", groep: "systeem", kern: true, tab: true },
];

export const STANDAARD_ACTIEF: ModuleId[] = MODULES.filter(
  (m) => !m.inOntwikkeling
).map((m) => m.id);
