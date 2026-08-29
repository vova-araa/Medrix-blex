// Wagenparkbewaking: APK, onderhoud, tachograafkeuring en verbruik.
// Alles wordt afgeleid uit de vastgelegde gegevens; er wordt nooit een
// "status" opgeslagen die uit de pas kan gaan lopen.

export const WAGENPARK_REGELS = {
  /** Vanaf hoeveel dagen voor de APK-vervaldatum we waarschuwen. */
  apkWaarschuwDagen: 42,
  /** Vanaf hoeveel kilometer voor de onderhoudsbeurt we waarschuwen. */
  onderhoudWaarschuwKm: 2500,
  /**
   * De tachograaf moet elke 2 jaar gekeurd worden (Verordening 165/2014
   * art. 23: periodieke inspectie ten minste elke twee jaar).
   */
  tachograafKeuringMaanden: 24,
  tachograafWaarschuwDagen: 42,
} as const;

/** Voertuigrecord van het wagenpark: keuringen, onderhoud en kosten.
 *  Los van `Voertuig` in types.ts, dat het voertuig op een rit beschrijft. */
export interface WagenparkVoertuig {
  kentekenGenormaliseerd: string;
  landcode: string;
  omschrijving: string;
  kmStand: number;
  apkTotIso: string;
  volgendeOnderhoudKm: number;
  /** Laatste tachograafkeuring; leeg = onbekend, en dat is zelf een signaal. */
  tachograafGekeurdIso?: string;
  verbruikL100: number;
  kostenPerMaandCenten: number;
}

export type BewakingSoort = "apk" | "onderhoud" | "tachograafkeuring";
export type BewakingErnst = "ok" | "waarschuwing" | "verlopen";

export interface Bewaking {
  kenteken: string;
  soort: BewakingSoort;
  ernst: BewakingErnst;
  /** Dagen tot de vervaldatum; negatief = verlopen. Null bij een km-grens. */
  dagenResterend: number | null;
  /** Kilometers tot de beurt; negatief = over tijd. Null bij een datumgrens. */
  kmResterend: number | null;
  omschrijving: string;
}

const DAG_MS = 86_400_000;

function datumBewaking(
  kenteken: string,
  soort: BewakingSoort,
  vervalIso: string,
  nuMs: number,
  waarschuwDagen: number,
  label: string
): Bewaking {
  // Resterende dagen naar beneden afronden (voorzichtig: liever te weinig
  // tijd denken te hebben), maar verstreken dagen naar het exacte aantal —
  // "19 dagen verlopen" terwijl het er 18 zijn, is bij een APK geen detail.
  const ruw = (Date.parse(vervalIso) - nuMs) / DAG_MS;
  const dagen = ruw >= 0 ? Math.floor(ruw) : Math.ceil(ruw);
  return {
    kenteken, soort,
    ernst: dagen < 0 ? "verlopen" : dagen <= waarschuwDagen ? "waarschuwing" : "ok",
    dagenResterend: dagen,
    kmResterend: null,
    omschrijving: dagen < 0
      ? `${label} is ${-dagen} dagen verlopen`
      : `${label} verloopt over ${dagen} dagen`,
  };
}

/**
 * Alle bewakingspunten van één voertuig. Ontbrekende gegevens komen terug als
 * "verlopen" en niet als "ok" — onbekend is geen groen licht.
 */
export function bewakingVan(voertuig: WagenparkVoertuig, nu: string): Bewaking[] {
  const nuMs = Date.parse(nu);
  const R = WAGENPARK_REGELS;
  const lijst: Bewaking[] = [
    datumBewaking(voertuig.kentekenGenormaliseerd, "apk", voertuig.apkTotIso, nuMs, R.apkWaarschuwDagen, "APK"),
  ];

  const kmResterend = voertuig.volgendeOnderhoudKm - voertuig.kmStand;
  lijst.push({
    kenteken: voertuig.kentekenGenormaliseerd,
    soort: "onderhoud",
    ernst: kmResterend < 0 ? "verlopen" : kmResterend <= R.onderhoudWaarschuwKm ? "waarschuwing" : "ok",
    dagenResterend: null,
    kmResterend,
    omschrijving: kmResterend < 0
      ? `Onderhoudsbeurt ${(-kmResterend).toLocaleString("nl-NL")} km over tijd`
      : `Onderhoudsbeurt over ${kmResterend.toLocaleString("nl-NL")} km`,
  });

  if (voertuig.tachograafGekeurdIso) {
    const verval = new Date(Date.parse(voertuig.tachograafGekeurdIso));
    verval.setMonth(verval.getMonth() + R.tachograafKeuringMaanden);
    lijst.push(datumBewaking(
      voertuig.kentekenGenormaliseerd, "tachograafkeuring",
      verval.toISOString(), nuMs, R.tachograafWaarschuwDagen, "Tachograafkeuring"
    ));
  } else {
    lijst.push({
      kenteken: voertuig.kentekenGenormaliseerd,
      soort: "tachograafkeuring",
      ernst: "verlopen",
      dagenResterend: null,
      kmResterend: null,
      omschrijving: "Datum van de laatste tachograafkeuring is onbekend",
    });
  }
  return lijst;
}

/** Alles wat aandacht vraagt, urgentste eerst. */
export function bewakingVanVloot(vloot: readonly WagenparkVoertuig[], nu: string): Bewaking[] {
  const gewicht: Record<BewakingErnst, number> = { verlopen: 0, waarschuwing: 1, ok: 2 };
  return vloot
    .flatMap((v) => bewakingVan(v, nu))
    .sort((a, b) =>
      gewicht[a.ernst] - gewicht[b.ernst] ||
      (a.dagenResterend ?? a.kmResterend ?? 0) - (b.dagenResterend ?? b.kmResterend ?? 0)
    );
}

export interface VoertuigKosten {
  kenteken: string;
  kmVandaag: number;
  /** Vaste maandkosten omgeslagen naar deze dag. */
  vasteKostenCenten: number;
  brandstofCenten: number;
  totaalCenten: number;
  /** Kostprijs per gereden kilometer; null bij nul kilometers. */
  kostprijsPerKmCenten: number | null;
}

/**
 * Kostprijs per kilometer: vaste kosten plus brandstof. Zonder gereden
 * kilometers is er geen kostprijs per km — dan is het antwoord null en niet
 * nul of oneindig.
 */
export function kostenVanDag(
  voertuig: WagenparkVoertuig,
  kmVandaag: number,
  dieselPrijsCentenPerLiter: number,
  dagenPerMaand = 21
): VoertuigKosten {
  const vaste = Math.round(voertuig.kostenPerMaandCenten / dagenPerMaand);
  const liters = (kmVandaag * voertuig.verbruikL100) / 100;
  const brandstof = Math.round(liters * dieselPrijsCentenPerLiter);
  const totaal = vaste + brandstof;
  return {
    kenteken: voertuig.kentekenGenormaliseerd,
    kmVandaag,
    vasteKostenCenten: vaste,
    brandstofCenten: brandstof,
    totaalCenten: totaal,
    kostprijsPerKmCenten: kmVandaag > 0 ? Math.round(totaal / kmVandaag) : null,
  };
}
