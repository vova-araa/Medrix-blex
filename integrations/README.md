# Koppelingen bouwen

Elke koppeling volgt hetzelfde stramien. Wie zich eraan houdt, heeft een
nieuwe connector in een dag staan — inclusief tests.

## De volgorde (nooit omdraaien)

1. **Directive eerst.** `directives/connector_<naam>.md` met de mapping, de
   foutscenario's, het rate limit en de open vragen. Code schrijven zonder
   directive levert een koppeling op die niemand kan onderhouden.
2. **Fixtures.** Een vastgelegd voorbeeldantwoord van de leverancier in
   `src/fixtures/`. Vraag er één op; verzin er nooit één.
3. **Types.** De ruwe vorm van de leverancier in `src/types.ts`, apart van ons
   domein. Leveranciers hernoemen velden, ons domein niet.
4. **Mapping.** `src/mapping.ts` vertaalt ruw → domein. Een onbekende code
   **gooit een fout**; nooit stil terugvallen op een standaardwaarde — dan
   verdwijnt er data zonder dat iemand het merkt.
5. **Contract tests.** Tegen de fixture, nooit tegen een live API.
6. **Client.** Fixture-implementatie eerst, HTTP-implementatie ernaast met
   dezelfde interface. De app kent alleen de interface.

## Wat je uit de kit haalt (niet zelf schrijven)

```ts
import {
  metRetry, foutVanStatus, KoppelingFout,   // opnieuw proberen, foutsoorten
  verwerkEenmalig, GeheugenStore,           // idempotentie voor inkomend
  DeadLetterWachtrij,                       // gefaalde uitgaande aanroepen
  onbekendeVelden, ontbrekendeCodes,        // hulp voor contract tests
} from "@sharzi/connector-kit";
```

- **Uitgaand**: altijd door `metRetry`. Die stopt vanzelf bij een
  autorisatiefout of een ongeldig verzoek, en volgt een `Retry-After` van de
  leverancier bij een rate limit.
- **Inkomend**: altijd door `verwerkEenmalig`. Externe partijen sturen dubbel;
  een herhaling geeft hetzelfde antwoord zonder opnieuw te verwerken.
- **Gefaald**: in de `DeadLetterWachtrij`, zichtbaar in de Koppelingen-hub en
  opnieuw af te spelen. Nooit stilzwijgend laten vallen.

## Mapstructuur

```
integrations/<naam>/
  package.json          @sharzi/connector-kit + @sharzi/domain
  src/types.ts          ruwe vorm van de leverancier
  src/mapping.ts        ruw → domein, gooit bij onbekende codes
  src/client.ts         interface + Fixture- en Http-implementatie
  src/fixtures/*.ts     vastgelegde voorbeeldantwoorden
  src/index.ts          publieke export
  test/contract.test.ts contract tests tegen de fixtures
```

## Regels die niet onderhandelbaar zijn

- Credentials per tenant in de vault. **Nooit** in code, migraties of `.env`
  van het project (CLAUDE.md §6.6, §17).
- Sandbox eerst. Nooit tegen een productieomgeving van een vervoerder testen
  zonder expliciete toestemming — labels kosten geld en maken echte zendingen.
- Geen nieuwe koppeling zonder concrete klantvraag (§6.7). De catalogus in de
  Koppelingen-hub verzamelt die vraag.
- Vervoerder- of leverancierspecifieke logica blijft in `integrations/`,
  nooit in `apps/`.

## Klaar om te bouwen

| Koppeling | Directive | Fixtures | Status |
|---|---|---|---|
| Truck & Trailer | ✓ | ✓ | fixture-client, HTTP-skelet klaar |
| Tachograaf | ✓ | ✓ | fixture-client; wacht op leverancierkeuze |
| Exact Online | — | — | aanvraagbaar in de catalogus |
| DHL Parcel | — | — | aanvraagbaar in de catalogus |
| Verkeersdata | — | — | aanvraagbaar in de catalogus |
