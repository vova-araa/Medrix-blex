import { mapActiviteit, mapToestemming, mapUitlezing, type TachoActiviteit } from "./mapping";
import { FIXTURE_DAG } from "./fixtures/dag";
import type { RuweTachoAntwoord } from "./types";
import type { TachoToestemming, TachoUitlezing } from "@sharzi/domain";

export interface TachoStand {
  activiteiten: TachoActiviteit[];
  uitlezingen: TachoUitlezing[];
  toestemmingen: TachoToestemming[];
  /** Tijdstip van de laatste geslaagde ophaal — nooit een lege stand tonen. */
  opgehaaldOp: string;
  /** Activiteiten zonder chauffeurskaart: melden, niet toewijzen. */
  zonderKaart: number;
}

export interface TachoClient {
  haalStand(): Promise<TachoStand>;
}

export function verwerkAntwoord(antwoord: RuweTachoAntwoord): TachoStand {
  const activiteiten = antwoord.activities.map(mapActiviteit);
  return {
    activiteiten,
    uitlezingen: antwoord.downloads.map(mapUitlezing),
    toestemmingen: antwoord.consents.map(mapToestemming),
    opgehaaldOp: antwoord.retrievedAtUtc,
    zonderKaart: activiteiten.filter((a) => a.chauffeur === null).length,
  };
}

/** Fixture-client tot de API-afspraken met de leverancier rond zijn. */
export class FixtureTachoClient implements TachoClient {
  async haalStand(): Promise<TachoStand> {
    return verwerkAntwoord(FIXTURE_DAG);
  }
}
