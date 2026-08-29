# Rij- en rusttijden — bronregels voor de Sharzi-rijtijdenmotor

Deze directive is de bron van waarheid voor `packages/domain/src/rijtijden.ts`.
Elke constante in de code verwijst hiernaar. Wijzig nooit een getal in de code
zonder deze directive bij te werken met de bron erbij.

Laatst nagezocht: 29 augustus 2026.

## 1. Verordening (EG) nr. 561/2006 — rij- en rusttijden

### 1.1 Rijtijden
| Regel | Waarde | Bijzonderheden |
|---|---|---|
| Dagelijkse rijtijd | max **9 uur** | mag **2× per week** verlengd worden tot **10 uur** |
| Wekelijkse rijtijd | max **56 uur** | week = maandag 00:00 t/m zondag 24:00 |
| Tweewekelijkse rijtijd | max **90 uur** | over twee opeenvolgende weken |

### 1.2 Onderbreking (pauze)
- Na maximaal **4,5 uur** rijden is **45 minuten** pauze verplicht.
- De pauze mag gesplitst worden in **15 minuten gevolgd door 30 minuten**.
  De volgorde is dwingend: 30 + 15 is **geen** geldige onderbreking.
- Ander werk onderbreekt de rijtijd wel, maar telt **niet** als pauze.

### 1.3 Dagelijkse rust
- Normaal: **11 uur** aaneengesloten.
- Gesplitst: **3 uur + 9 uur** (samen 12 uur; deze volgorde).
- Verkort: **9 uur**, maximaal **3×** tussen twee wekelijkse rusttijden.

### 1.4 Wekelijkse rust
- Normaal: minimaal **45 uur**. Verkort: minimaal **24 uur**.
- Moet **beginnen uiterlijk na zes perioden van 24 uur** gerekend vanaf het
  einde van de vorige wekelijkse rust.
- Inkorting moet **gecompenseerd** worden met een aaneengesloten rust die
  vóór het einde van de **derde week** volgend op de betreffende week wordt
  opgenomen, **aansluitend op een rust van minimaal 9 uur**.

### 1.5 Dubbele bemanning
- Beoordelingsvenster is **30 uur** in plaats van 24 uur.
- Binnen dat venster moeten beide chauffeurs **minimaal 9 uur** dagelijkse rust
  hebben gehad; dit geldt **niet** als verkorte dagrust.
- Gedurende het **eerste uur** is de aanwezigheid van de tweede chauffeur
  optioneel, daarna verplicht.

### 1.6 Mobility Package (sinds 20 augustus 2020)
- De **reguliere** (45 uur) en de compenserende wekelijkse rust mag **niet in
  de cabine** worden doorgebracht — passende accommodatie is verplicht.
- Bij internationaal vervoer mogen onder voorwaarden **twee verkorte
  wekelijkse rusttijden achter elkaar** worden genomen.
- **Terugkeerplicht**: de chauffeur keert elke **4 weken** terug (elke
  **3 weken** als van de twee-verkorte-regeling gebruik is gemaakt).

## 2. Arbeidstijdenbesluit vervoer (NL) / richtlijn 2002/15/EG

| Regel | Waarde |
|---|---|
| Maximale arbeidstijd per week | **60 uur** |
| Gemiddelde arbeidstijd per week | **48 uur** over een referentieperiode van **16 weken** |
| Maximale arbeidstijd per dienst | **12 uur** |
| Nachtarbeid | meer dan 1 uur arbeid tussen **00:00 en 06:00**; dan max **10 uur** arbeidstijd per dienst |

Arbeidstijd omvat rijden én ander werk; beschikbaarheidstijd en pauze tellen
niet mee als arbeidstijd.

## 3. Wat Sharzi bewust NIET automatisch doet
- De planner plant **nooit** uit zichzelf een verlenging naar 10 uur in. De
  automaat stelt het hooguit voor, met de melding hoeveel verlengingen deze
  week al gebruikt zijn; de planner beslist.
- Een verkorte wekelijkse rust wordt nooit automatisch ingepland.

## 4. Open punten voor Blex
- Geldt bij Blex de standaard referentieperiode van 16 weken, of is bij cao een
  afwijkende periode afgesproken?
- Rijdt Blex internationaal met twee verkorte weekrusten achter elkaar? Dan
  moet de terugkeerplicht van 3 weken bewaakt worden in plaats van 4.
- Komt dubbele bemanning voor in de vloot?

## Bronnen
- Verordening (EG) nr. 561/2006, geconsolideerde versie 20-08-2020 (EUR-Lex)
- Rijksoverheid — Regels voor rijtijden en rusttijden bij wegvervoer
- IRU — Guide to EU rules on drivers' hours, Regulation (EC) No 561/2006
- ILT — Gemiddelde werkweek 48 uur; Mobility Package
- Arbeidstijdenbesluit vervoer, hoofdstuk wegvervoer
