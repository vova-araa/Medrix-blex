// Het instructieboek: hoe het werk hier gaat. Geen algemene handleiding van de
// app, maar de werkwijze van dit bedrijf — welke knop je wanneer gebruikt en
// waarom dat zo afgesproken is.
//
// De teksten staan als vertaalsleutels in de woordenboeken, zodat het boek
// meegaat met de taalkeuze van de chauffeur (§7.5). De sleutels staan hier
// letterlijk in een lijst en niet samengesteld, zodat de typecontrole een
// ontbrekende vertaling meteen ziet.

import type { IcoonNaam } from "../components/Icoon";
import type { VertaalSleutel } from "../i18n/nl";

export type InstructieId =
  | "daglijst"
  | "cmr"
  | "laden_lossen"
  | "schade"
  | "garage"
  | "emballage"
  | "offline"
  | "rijtijden"
  | "problemen";

export interface Instructie {
  id: InstructieId;
  icoon: IcoonNaam;
  titel: VertaalSleutel;
  intro: VertaalSleutel;
  stappen: VertaalSleutel[];
  /** Uitzondering of valkuil die je moet weten voordat je het fout doet. */
  letOp?: VertaalSleutel;
}

export const INSTRUCTIES: Instructie[] = [
  {
    id: "daglijst",
    icoon: "check",
    titel: "instructie.daglijst.titel",
    intro: "instructie.daglijst.intro",
    stappen: [
      "instructie.daglijst.stap1",
      "instructie.daglijst.stap2",
      "instructie.daglijst.stap3",
      "instructie.daglijst.stap4",
      "instructie.daglijst.stap5",
    ],
    letOp: "instructie.daglijst.let",
  },
  {
    id: "cmr",
    icoon: "document",
    titel: "instructie.cmr.titel",
    intro: "instructie.cmr.intro",
    stappen: [
      "instructie.cmr.stap1",
      "instructie.cmr.stap2",
      "instructie.cmr.stap3",
      "instructie.cmr.stap4",
      "instructie.cmr.stap5",
      "instructie.cmr.stap6",
    ],
    letOp: "instructie.cmr.let",
  },
  {
    id: "laden_lossen",
    icoon: "pakket",
    titel: "instructie.laden_lossen.titel",
    intro: "instructie.laden_lossen.intro",
    stappen: [
      "instructie.laden_lossen.stap1",
      "instructie.laden_lossen.stap2",
      "instructie.laden_lossen.stap3",
      "instructie.laden_lossen.stap4",
      "instructie.laden_lossen.stap5",
    ],
    letOp: "instructie.laden_lossen.let",
  },
  {
    id: "schade",
    icoon: "waarschuwing",
    titel: "instructie.schade.titel",
    intro: "instructie.schade.intro",
    stappen: [
      "instructie.schade.stap1",
      "instructie.schade.stap2",
      "instructie.schade.stap3",
      "instructie.schade.stap4",
    ],
    letOp: "instructie.schade.let",
  },
  {
    id: "garage",
    icoon: "wagenpark",
    titel: "instructie.garage.titel",
    intro: "instructie.garage.intro",
    stappen: [
      "instructie.garage.stap1",
      "instructie.garage.stap2",
      "instructie.garage.stap3",
      "instructie.garage.stap4",
    ],
    letOp: "instructie.garage.let",
  },
  {
    id: "emballage",
    icoon: "emballage",
    titel: "instructie.emballage.titel",
    intro: "instructie.emballage.intro",
    stappen: [
      "instructie.emballage.stap1",
      "instructie.emballage.stap2",
      "instructie.emballage.stap3",
      "instructie.emballage.stap4",
    ],
    letOp: "instructie.emballage.let",
  },
  {
    id: "offline",
    icoon: "koppeling",
    titel: "instructie.offline.titel",
    intro: "instructie.offline.intro",
    stappen: [
      "instructie.offline.stap1",
      "instructie.offline.stap2",
      "instructie.offline.stap3",
    ],
    letOp: "instructie.offline.let",
  },
  {
    id: "rijtijden",
    icoon: "klok",
    titel: "instructie.rijtijden.titel",
    intro: "instructie.rijtijden.intro",
    stappen: [
      "instructie.rijtijden.stap1",
      "instructie.rijtijden.stap2",
      "instructie.rijtijden.stap3",
      "instructie.rijtijden.stap4",
      "instructie.rijtijden.stap5",
    ],
    letOp: "instructie.rijtijden.let",
  },
  {
    id: "problemen",
    icoon: "mail",
    titel: "instructie.problemen.titel",
    intro: "instructie.problemen.intro",
    stappen: [
      "instructie.problemen.stap1",
      "instructie.problemen.stap2",
      "instructie.problemen.stap3",
      "instructie.problemen.stap4",
    ],
    letOp: "instructie.problemen.let",
  },
];
