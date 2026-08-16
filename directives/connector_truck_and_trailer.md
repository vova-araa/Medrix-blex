# Connector: Truck & Trailer (wagenparkbeheer)

Status: **fixtures** — de koppeling draait tegen vastgelegde voorbeelddata.
De echte HTTP-client wordt pas gebouwd zodra de open vragen hieronder door
Blex zijn beantwoord (§6.7: geen live koppeling zonder concrete afspraken).

## Doel

Vloot- en onderhoudsdata uit het wagenparkbeheersysteem "Truck & Trailer"
inlezen in Sharzi, zodat de Wagenpark-module (APK-bewaking, onderhoud,
verbruik, kosten) en de trailerlijst automatisch actueel blijven in plaats
van handmatig bijgehouden.

Richting: **alleen inlezen** (Truck & Trailer → Sharzi). Sharzi schrijft
niets terug; km-standen die chauffeurs in Sharzi registreren blijven in
Sharzi (bron van waarheid voor ritregistratie is onze eigen event-log).

## Open vragen voor Blex (blokkerend voor livegang)

1. Welk product is "Truck & Trailer" precies (leverancier, versie)? Er is
   geen publieke API-documentatie onder die naam gevonden.
2. Is er een REST-API of alleen export (CSV/Excel)? Zo ja: URL, autorisatie
   (API-key/OAuth), en is er een sandbox-omgeving?
3. Wie beheert de credentials? (Per tenant in de vault, nooit in code — §6.6.)
4. Hoe vaak mag/moet er gesynchroniseerd worden (rate limit)?

## Mapping

Extern veld (aanname, Engels)        → Sharzi
-------------------------------------------------------------------
`registration`                       → `kenteken` (genormaliseerd: hoofdletters,
                                       zonder streepjes — domein `normaliseerKenteken`)
`countryCode`                        → `landcode`
`category` = TRACTOR | RIGID | VAN   → wagenparkvoertuig
`category` = TRAILER                 → trailer
`description`                        → `omschrijving`
`odometerKm`                         → `kmStand`
`motExpiryDate` (ISO-datum)          → `apkTot`
`nextServiceKm`                      → `volgendeOnderhoudKm`
`fuelConsumptionL100`                → `verbruikL100`
`monthlyCostCents` (integer!)        → `kostenPerMaandCenten` (centen, §5.4)

Onbekende categorieën worden geweigerd met een duidelijke fout — nooit
stilzwijgend overslaan (§6.3: falen moet zichtbaar zijn).

## Idempotentie & synchronisatie

- Kenteken (genormaliseerd + landcode) is de natuurlijke sleutel; een sync
  is een volledige upsert en kan veilig herhaald worden.
- Elke sync legt een `syncTijdstip` vast; de UI toont wanneer de vloot voor
  het laatst is bijgewerkt.

## Foutscenario's

| Scenario | Gedrag |
|---|---|
| API onbereikbaar / 5xx | Retry met exponential backoff (3 pogingen: 1 s, 2 s, 4 s); daarna zichtbaar falen in de UI, oude data blijft staan |
| 401/403 | Geen retry; melding "credentials verlopen" naar beheer |
| Onbekende `category` | Sync faalt hard met veldnaam en waarde in de fout |
| `monthlyCostCents` geen integer | Weigeren (geld is integer in centen, §5.4) |
| Dubbel kenteken in respons | Laatste wint (upsert), gelogd als waarschuwing |

## Rate limit

Onbekend (open vraag 4). Tot die tijd: maximaal 1 sync per 15 minuten.

## Tests

`integrations/truck_and_trailer/test/contract.test.ts` draait de mapping
tegen `fixtures/vloot.json` — een vastgelegde voorbeeldrespons. Geen live
API-calls in tests (§6.4).
