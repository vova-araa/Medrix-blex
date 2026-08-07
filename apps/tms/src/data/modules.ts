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
  | "boekhouding";

export interface ModuleDef {
  id: ModuleId;
  icoon: IcoonNaam;
  /** Kernmodules zitten in elk abonnement en kunnen niet uit. */
  kern?: boolean;
  /** Zichtbaar in de catalogus, nog niet leverbaar. */
  inOntwikkeling?: boolean;
  /** Heeft een eigen tab in de navigatie. */
  tab?: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: "planbord", icoon: "planbord", kern: true, tab: true },
  { id: "operatie", icoon: "operatie", kern: true, tab: true },
  { id: "kaart", icoon: "kaart", tab: true },
  { id: "uren", icoon: "klok", tab: true },
  { id: "facturen", icoon: "factuur", tab: true },
  { id: "klanten", icoon: "klanten", tab: true },
  { id: "emballage", icoon: "emballage", tab: true },
  { id: "portaal", icoon: "portaal", tab: true },
  { id: "wagenpark", icoon: "wagenpark", tab: true },
  { id: "rapportage", icoon: "rapportage", tab: true },
  { id: "assistent", icoon: "assistent" },
  { id: "dock", icoon: "dock", inOntwikkeling: true },
  { id: "edi", icoon: "edi", inOntwikkeling: true },
  { id: "documenten", icoon: "document", inOntwikkeling: true },
  { id: "boekhouding", icoon: "boek", inOntwikkeling: true },
];

export const STANDAARD_ACTIEF: ModuleId[] = MODULES.filter(
  (m) => !m.inOntwikkeling
).map((m) => m.id);
