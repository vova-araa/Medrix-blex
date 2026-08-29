// Hulp voor contract tests. Elke connector test tegen vastgelegde fixtures,
// nooit tegen een live API (CLAUDE.md §6.4). Deze helpers maken het makkelijk
// om te controleren dat een mapping volledig is en niets stil laat vallen.

/**
 * Controleert dat elke sleutel in het ruwe antwoord bekend is in de mapping.
 * Een leverancier die een veld toevoegt, mag niet stil genegeerd worden —
 * dan mist er data zonder dat iemand het merkt.
 */
export function onbekendeVelden(
  ruw: Record<string, unknown>,
  bekend: readonly string[]
): string[] {
  return Object.keys(ruw).filter((sleutel) => !bekend.includes(sleutel));
}

/**
 * Controleert dat een mapping-tabel elke waarde uit de fixture kan vertalen.
 * Geeft de codes terug die ontbreken, zodat de test kan falen mét namen.
 */
export function ontbrekendeCodes(
  waarden: readonly string[],
  tabel: Record<string, unknown>
): string[] {
  return [...new Set(waarden)].filter((w) => tabel[w] === undefined);
}

/** Alle verplichte velden gevuld? Geeft de lege terug. */
export function legeVerplichteVelden<T extends object>(
  object: T,
  verplicht: readonly (keyof T)[]
): string[] {
  return verplicht
    .filter((veld) => object[veld] === undefined || object[veld] === null || object[veld] === "")
    .map(String);
}
