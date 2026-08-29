# Connector: <naam leverancier>

> Sjabloon. Kopieer naar `directives/connector_<naam>.md` en vul in **voordat**
> je code schrijft. Zie `integrations/README.md` voor de volgorde.

## 1. Waarom deze koppeling
Welke klantvraag ligt eronder? Zonder concrete vraag bouwen we hem niet (§6.7).

## 2. Richting en frequentie
| Wat | Richting | Frequentie | Trigger |
|---|---|---|---|
| … | in / uit | … | polling / webhook / handmatig |

## 3. Authenticatie
- Soort: API-key / OAuth / basic
- Waar de credentials staan: **tenant-vault**, nooit in code of `.env`
- Vervalt de sleutel? Zo ja: hoe vaak, en wie vernieuwt hem?

## 4. Rate limit
- Toegestaan: … verzoeken per …
- Stuurt de leverancier een `Retry-After`? De kit volgt die automatisch.

## 5. Mapping
| Veld leverancier | Ons domeinveld | Opmerking |
|---|---|---|
| … | … | … |

Onbekende codes **gooien een fout** — nooit stil terugvallen.

## 6. Foutscenario's
| Scenario | Verwacht gedrag |
|---|---|
| Leverancier onbereikbaar | laatste stand tonen mét tijdstempel, nooit leeg als nul |
| 401 / 403 | direct stoppen, melding "credentials vernieuwen" |
| 429 | wachten volgens `Retry-After`, daarna opnieuw |
| Onbekend veld of code | fout gooien, mapping bijwerken |
| Dubbele levering | idempotent overslaan via `verwerkEenmalig` |

## 7. Sandbox
- Sandbox-URL: …
- Is er een sandbox? Zo nee: **niet** tegen productie testen zonder
  schriftelijke toestemming.

## 8. Open vragen
1. …
