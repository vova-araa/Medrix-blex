// Dead-letter queue: een uitgaande aanroep die na alle pogingen faalt,
// verdwijnt nooit stilzwijgend (CLAUDE.md §6.3). Hij gaat in de wachtrij,
// is zichtbaar in de Koppelingen-hub en kan opnieuw worden afgespeeld.

import type { FoutSoort } from "./fouten";

export interface WachtrijItem {
  id: string;
  koppelingId: string;
  actie: string;
  /** Wat we wilden versturen — genoeg om het opnieuw te doen. */
  inhoud: unknown;
  foutSoort: FoutSoort | "onbekend";
  foutmelding: string;
  eersteFoutIso: string;
  pogingen: number;
  /** Gezet zodra een herhaling geslaagd is; het item blijft als spoor staan. */
  opgelostIso?: string;
}

export class DeadLetterWachtrij {
  private items: WachtrijItem[] = [];

  constructor(private readonly nu: () => string = () => new Date().toISOString()) {}

  /**
   * Zet een gefaalde actie in de wachtrij. Dezelfde actie die nogmaals faalt
   * verhoogt de teller in plaats van een tweede regel te maken — anders loopt
   * de hub vol met ruis bij een leverancier die een uur plat ligt.
   */
  voegToe(item: Omit<WachtrijItem, "id" | "eersteFoutIso" | "pogingen">): WachtrijItem {
    const bestaand = this.items.find(
      (i) => !i.opgelostIso && i.koppelingId === item.koppelingId && i.actie === item.actie
    );
    if (bestaand) {
      bestaand.pogingen += 1;
      bestaand.foutmelding = item.foutmelding;
      bestaand.foutSoort = item.foutSoort;
      return bestaand;
    }
    const nieuw: WachtrijItem = {
      ...item,
      id: `dlq-${this.items.length + 1}-${Date.now()}`,
      eersteFoutIso: this.nu(),
      pogingen: 1,
    };
    this.items.push(nieuw);
    return nieuw;
  }

  markeerOpgelost(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item) item.opgelostIso = this.nu();
  }

  /** Alles wat nog aandacht vraagt. */
  get open(): WachtrijItem[] { return this.items.filter((i) => !i.opgelostIso); }
  get alles(): WachtrijItem[] { return [...this.items]; }
}
