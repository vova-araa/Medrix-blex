// Moduleregister: Sharzi is per module verkoopbaar. Elke module kan per
// tenant aan of uit staan; kernmodules horen bij elk abonnement. Modules met
// `inOntwikkeling` staan wel in de catalogus (verkoopvitrine) maar zijn nog
// niet leverbaar. Alle module-namen en -omschrijvingen zijn eigen werk.

export type ModuleId =
  | "planbord"
  | "kaart"
  | "uren"
  | "facturen"
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
  icoon: string;
  /** Kernmodules zitten in elk abonnement en kunnen niet uit. */
  kern?: boolean;
  /** Zichtbaar in de catalogus, nog niet leverbaar. */
  inOntwikkeling?: boolean;
  /** Heeft een eigen tab in de navigatie. */
  tab?: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: "planbord", icoon: "🗓️", kern: true, tab: true },
  { id: "kaart", icoon: "🗺️", tab: true },
  { id: "uren", icoon: "⏱️", tab: true },
  { id: "facturen", icoon: "🧾", tab: true },
  { id: "emballage", icoon: "📦", tab: true },
  { id: "portaal", icoon: "🔎", tab: true },
  { id: "wagenpark", icoon: "🚚", tab: true },
  { id: "rapportage", icoon: "📈", tab: true },
  { id: "assistent", icoon: "✨" },
  { id: "dock", icoon: "🏭", inOntwikkeling: true },
  { id: "edi", icoon: "🔗", inOntwikkeling: true },
  { id: "documenten", icoon: "📄", inOntwikkeling: true },
  { id: "boekhouding", icoon: "📚", inOntwikkeling: true },
];

export const STANDAARD_ACTIEF: ModuleId[] = MODULES.filter(
  (m) => !m.inOntwikkeling
).map((m) => m.id);
