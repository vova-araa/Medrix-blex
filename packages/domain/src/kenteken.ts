// Kentekens genormaliseerd opslaan (CLAUDE.md §5.5): hoofdletters, zonder
// streepjes, met landcode. Formatteren gebeurt pas bij weergave.

export interface Kenteken {
  landcode: string;
  kenteken: string;
}

export function normaliseerKenteken(landcode: string, invoer: string): Kenteken {
  return {
    landcode: landcode.trim().toUpperCase(),
    kenteken: invoer.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  };
}

/** Weergave: streepjes tussen elke wissel van letters naar cijfers en terug. */
export function formatteerKenteken(k: Kenteken): string {
  const groepen = k.kenteken.match(/[A-Z]+|[0-9]+/g) ?? [k.kenteken];
  return groepen.join("-");
}
