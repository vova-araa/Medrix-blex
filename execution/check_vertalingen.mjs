#!/usr/bin/env node
// Controleert of alles wat een chauffeur of depotmedewerker op zijn scherm
// krijgt in alle vier de talen bestaat.
//
// Waarom een script en geen unit test: het gaat om een eigenschap van de
// bestanden, niet van een functie. Het leest de componenten die de mobiele
// schermen tekenen, haalt daar de gebruikte vertaalsleutels uit en vergelijkt
// die met de woordenboeken.
//
// Gebruik:  node execution/check_vertalingen.mjs
// Uitvoer:  per taal wat er ontbreekt; exitcode 1 als er iets mist.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const I18N = "apps/tms/src/i18n";
const COMPONENTEN = "apps/tms/src/components";

// Schermen die een chauffeur of depotmedewerker onder ogen krijgt. De
// kantoorschermen vallen bewust terug op Nederlands en Engels.
const MOBIELE_BESTANDEN = [
  "ChauffeurView.tsx",
  "DockView.tsx",
  "DagcontroleKaart.tsx",
  "InstructieBoek.tsx",
  "TaalKnop.tsx",
];

/** Sleutels uit een woordenboekbestand. */
function sleutelsVanWoordenboek(taal) {
  const inhoud = readFileSync(join(I18N, `${taal}.ts`), "utf8");
  return new Set([...inhoud.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]));
}

/**
 * Sleutels die een bestand gebruikt. Vangt t("x") en statische varianten als
 * t(`prefix.${...}`) worden apart afgehandeld via de patronenlijst hieronder.
 */
function sleutelsVanBestand(pad) {
  const inhoud = readFileSync(pad, "utf8");
  return [...inhoud.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Sleutels die met een template worden opgebouwd, bijvoorbeeld
 * t(`dagcontrole.punt.${punt}`). Die kunnen we niet uit de code lezen, dus
 * nemen we de hele prefix mee: alles wat in het Nederlands onder deze prefix
 * staat, moet ook vertaald zijn.
 */
const DYNAMISCHE_PREFIXEN = [
  "status.",
  "taak.",
  "event.",
  "dagcontrole.punt.",
  "dagcontrole.stand.",
  "dock.status.",
  "dock.event.",
  "dock.stand.",
  "emballage.soort.",
  "klok.event.",
  "rijtijd.bron.",
  "instructie.",
];

const nl = sleutelsVanWoordenboek("nl");

const gebruikt = new Set();
for (const bestand of MOBIELE_BESTANDEN) {
  for (const sleutel of sleutelsVanBestand(join(COMPONENTEN, bestand))) {
    gebruikt.add(sleutel);
  }
}
for (const prefix of DYNAMISCHE_PREFIXEN) {
  for (const sleutel of nl) if (sleutel.startsWith(prefix)) gebruikt.add(sleutel);
}

// Sanity: elke sleutel die de mobiele schermen gebruiken moet in het
// Nederlands bestaan, anders is er een typefout in de code.
const onbekend = [...gebruikt].filter((s) => !nl.has(s)).sort();

let fouten = onbekend.length;
if (onbekend.length) {
  console.log(`FOUT  ${onbekend.length} sleutel(s) uit de mobiele schermen bestaan niet in nl.ts:`);
  for (const s of onbekend) console.log(`  - ${s}`);
}

const bestaandeTalen = readdirSync(I18N)
  .filter((n) => /^[a-z]{2}\.ts$/.test(n))
  .map((n) => n.slice(0, 2))
  .filter((t) => t !== "nl");

for (const taal of bestaandeTalen) {
  const woorden = sleutelsVanWoordenboek(taal);
  const mist = [...gebruikt].filter((s) => nl.has(s) && !woorden.has(s)).sort();
  if (mist.length === 0) {
    console.log(`OK    ${taal}: alle ${gebruikt.size} mobiele sleutels vertaald`);
  } else {
    fouten += mist.length;
    console.log(`FOUT  ${taal}: ${mist.length} van de ${gebruikt.size} mobiele sleutels ontbreken:`);
    for (const s of mist) console.log(`  - ${s}`);
  }
}

process.exit(fouten === 0 ? 0 : 1);
