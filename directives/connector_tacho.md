# Connector: tachograafdata

Doel: de rij- en rusttijdenmotor voeden met **uitgelezen** tachograafdata in
plaats van met wat de chauffeur in de app aantikt, en de wettelijke
uitleestermijnen bewaken.

Deze directive is leverancieronafhankelijk. De connector per leverancier
(Roadsoft, Webfleet, VDO Fleet, Samsara, FleetGO, Squarell) mapt op dít model.
Zie ook `directives/connector_truck_and_trailer.md` voor het patroon.

## 1. Drie lagen, niet één

| Laag | Wat | Frequentie | Juridische status |
|---|---|---|---|
| **Activiteitenstroom** | huidige activiteit, chauffeur-ID, resterende rijtijd | bijna live (minuten) | hulpmiddel |
| **DDD-bestanden** | volledige wettelijke uitlezing voertuigunit + chauffeurskaart | periodiek | **bewijs** |
| **Handhaving (DSRC)** | meelezen op afstand door ILT/politie | n.v.t. | niet voor ons |

Sharzi gebruikt laag 1 om te plannen en laag 2 om te verantwoorden.

## 2. Harde regel: de tachograaf wint

Onze berekening is een **hulpmiddel**, geen bewijs. Wijkt onze stand af van de
uitgelezen tachograafdata, dan is de tachograaf leidend en tonen we het
verschil — we schrijven de tachograafwaarde nooit stil weg en passen onze
berekening er nooit stilzwijgend op aan.

Elke activiteit draagt daarom een `bron`:
- `tachograaf` — uitgelezen, juridisch onderbouwd
- `app` — geregistreerd door de chauffeur in Sharzi
- `handmatig` — door de planner gecorrigeerd, met wie en waarom

In de UI is zichtbaar welke bron een chauffeurstand heeft. Een stand die
volledig op `app` leunt, wordt als zodanig gemarkeerd.

## 3. Wettelijke uitleestermijnen (bewaken, niet uitvoeren)

| Wat | Uiterlijk elke | Bij overschrijding |
|---|---|---|
| Voertuigunit (bedrijfskaart) | **90 dagen** | zware overtreding bij bedrijfscontrole ILT |
| Chauffeurskaart | **28 dagen** | idem |
| Bewaarplicht uitgelezen data | minimaal **1 jaar** | idem |

Sharzi bewaakt deze termijnen en waarschuwt vóór het verstrijken. Neemt Sharzi
de opslag over van een bestaand pakket, dan erft Sharzi de bewaarplicht — dat
mag pas nadat opslag en termijnbewaking aantoonbaar werken.

## 4. Toestemming van de chauffeur (AVG)

De ITS-parameters van de slimme tachograaf zijn persoonsgegevens. De chauffeur
geeft **eenmalig per tachograaf** toestemming voordat het apparaat ze vrijgeeft.
Sharzi registreert per chauffeur of die toestemming er is, wanneer en voor welk
voertuig, en toont het ontbreken ervan als reden dat er geen live data is —
nooit als technische storing.

## 5. Datamodel (leverancieronafhankelijk)

```
TachoActiviteit  { chauffeurskaart, voertuig, soort, van, tot, bron }
TachoUitlezing   { soort: voertuig|chauffeurskaart, kenteken?, chauffeur?,
                   tijdstip, bestandsnaam, periodeVan, periodeTot }
TachoToestemming { chauffeur, voertuig, gegevenOp }
```

`soort` van een activiteit volgt de tachograafcategorieën: rijden, ander werk,
beschikbaarheid, rust — gelijk aan `ActiviteitSoort` in het domein.

## 6. Foutscenario's

| Scenario | Gedrag |
|---|---|
| Leverancier onbereikbaar | laatste stand blijven tonen mét tijdstempel; nooit een lege stand als "0 uur" tonen |
| Chauffeurskaart niet ingestoken | activiteit zonder chauffeur — melden, niet toewijzen aan de laatst bekende chauffeur |
| Twee chauffeurs op één voertuig | dubbele bemanning: 30-uursvenster, beiden ≥9 u rust |
| Uitlezing mislukt | termijnteller loopt gewoon door; melding met resterende dagen |
| Tijd van tachograaf wijkt af | UTC uit de tachograaf is leidend; afwijking loggen |

## 7. Open vragen voor Blex en de leverancier

1. Gebruikt Blex Roadsoft, en heeft Roadsoft een **uitgaande** API voor derden?
   (Hun documentatie beschrijft koppelingen naar binnen, van telematica naar
   Roadsoft — niet naar buiten.)
2. Zit er een SIM in de tachografen voor remote download, of loopt het via een
   telematicakastje? Welke leverancier?
3. Welke tachograafgeneratie rijdt in de vloot? De ITS-interface met Bluetooth
   is pas vanaf de slimme tachograaf verplicht; oudere units geven geen live
   activiteitenstroom.
4. Wie is nu bewaarplichtige van de DDD-bestanden, en wil Blex dat verplaatsen?
5. Is er dubbele bemanning in de vloot?

## Bronnen
- Verordening (EU) nr. 165/2014 (tachografen), ITS- en DSRC-interfaces
- ILT — Slimme tachograaf; handhaving op afstand vanaf 20 augustus 2024
- VDO Fleet — ITS-toestemming en Bluetooth Low Energy
- Roadsoft — tachograafsoftware en remote download
