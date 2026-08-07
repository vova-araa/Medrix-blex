import type { Rit, Taak, TaakEvent, Zending } from "@sharzi/domain";

// De UI praat alleen met deze poort. Nu zit er een mock achter (in-memory);
// zodra het Supabase dev-project bestaat komt daar een tweede implementatie
// achter dezelfde interface — de componenten merken daar niets van.

export interface DagSnapshot {
  ritten: Rit[];
  taken: Taak[];
  events: TaakEvent[];
  zendingen: Record<string, Zending>;
  ongepland: string[];
}

export interface DataBron {
  laadDag(datum: string): Promise<DagSnapshot>;
}
