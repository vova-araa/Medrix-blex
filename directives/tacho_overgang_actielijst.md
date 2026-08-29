# Actielijst: tachodata in Sharzi, met Roadsoft ernaast

Doel: Sharzi laten meelezen met de tachodata terwijl **Roadsoft gewoon blijft
draaien**, zodat we weken kunnen vergelijken voordat er iets verandert. Pas als
de cijfers aantoonbaar overeenkomen, is een overstap überhaupt een gesprek.

Status: `[ ]` open · `[~]` loopt · `[x]` klaar
Eigenaar: **V** = Vova · **B** = Blex · **R** = Roadsoft · **S** = Sharzi (ik)

---

## Fase 0 — Uitzoeken (blokkerend, hier begint alles)

### Bij Roadsoft
- [ ] **R1** Heeft Roadsoft een **uitgaande** API of export voor derden? Hun
      documentatie beschrijft alleen koppelingen naar binnen (telematica →
      Roadsoft). *(V/R — dit bepaalt de hele route)*
- [ ] **R2** Zo ja: documentatie, authenticatie, rate limits, kosten.
- [ ] **R3** Zo nee: kan Roadsoft periodiek de **DDD-bestanden** leveren
      (SFTP, e-mail of webhook)? Dat is voldoende om mee te lezen.
- [ ] **R4** Mag Blex zijn eigen tachodata door een derde laten verwerken?
      Check de voorwaarden — het is Blex' data, maar zet het zwart op wit.
- [ ] **R5** **Dataportabiliteit bij vertrek**: krijgt Blex álle historische
      DDD-bestanden mee, in welk formaat, en binnen welke termijn? Vraag dit
      nú, niet bij opzegging.
- [ ] **R6** Opzegtermijn en contractduur van het huidige abonnement.

### Bij Blex
- [ ] **B1** Welke telematica zit in de trucks (leverancier + type kastje)?
- [ ] **B2** Welke **tachograafgeneratie** rijdt er? Slimme tachograaf v1, v2
      of ouder. Alleen de slimme tachograaf geeft een live activiteitenstroom
      via de ITS-interface; oudere units niet.
- [ ] **B3** Zit er een **SIM in de tachograaf** voor remote download, of
      loopt dat via het telematicakastje?
- [ ] **B4** Wie is nu formeel **bewaarplichtige** van de DDD-bestanden?
- [ ] **B5** Rijdt Blex internationaal met **twee verkorte weekrusten achter
      elkaar**? Zo ja geldt de terugkeerplicht van 3 weken in plaats van 4, en
      moet ik die bewaking toevoegen.
- [ ] **B6** Komt **dubbele bemanning** voor in de vloot? (30-uursvenster,
      beide chauffeurs minimaal 9 uur rust.)
- [ ] **B7** Geldt de standaard referentieperiode van **16 weken** voor het
      48-uursgemiddelde, of wijkt de cao daarvan af?

---

## Fase 1 — Juridisch en mensen (parallel aan fase 0)

- [ ] **J1** **Instemming ondernemingsraad.** Een systeem dat rij- en
      werktijden van chauffeurs registreert is een personeelsvolgsysteem;
      de OR heeft instemmingsrecht op zowel de verwerking van
      personeelsgegevens als het volgsysteem zelf (art. 27 lid 1 sub k en l
      WOR). Zonder instemming mag de regeling niet worden ingevoerd. Heeft
      Blex een OR of personeelsvertegenwoordiging? *(V/B — start dit vroeg,
      dit heeft doorlooptijd)*
- [ ] **J2** **Verwerkersovereenkomst** tussen Blex en Sharzi.
- [ ] **J3** **Chauffeurs informeren**: wat wordt gelezen, waarvoor, hoe lang
      bewaard, en wat ze zelf kunnen inzien.
- [ ] **J4** **ITS-toestemming per chauffeur.** De chauffeur geeft eenmalig
      per tachograaf toestemming; zonder dat geeft het apparaat de
      persoonsgegevens niet vrij. Dit is geen storing die wij kunnen
      oplossen — het moet echt door de chauffeur gebeuren.
- [ ] **J5** Bewaartermijn vastleggen: wettelijk minimaal 1 jaar; bepaal wat
      Blex zelf aanhoudt.

---

## Fase 2 — Technisch opzetten (S, zodra fase 0 antwoorden geeft)

- [ ] **T1** Testtoegang / API-sleutels aanleveren. **Nooit in de repo of in
      een chat** — die gaan in de vault. *(B levert, S zet weg)*
- [ ] **T2** Beginnen met **1 tot 2 voertuigen**, niet de hele vloot.
- [ ] **T3** Connector afmaken op basis van de echte veldnamen. Het
      leverancieronafhankelijke model, de fixtures en de contract tests staan
      al klaar — alleen de mapping moet erop. *(S)*
- [ ] **T4** Uitleestermijnen laten meelopen: 90 dagen voertuigunit,
      28 dagen chauffeurskaart. Bewaking staat al in de app. *(S — klaar)*

---

## Fase 3 — Schaduwdraaien (het echte testen)

- [ ] **S1** Periode afspreken: advies **4 tot 6 weken**, zodat er minstens
      één volledige weekrustcyclus en een maandwissel in zit.
- [ ] **S2** **Wekelijks vergelijken**: Sharzi naast Roadsoft, per chauffeur.
      De vergelijkingsfunctie zit in de app.
- [ ] **S3** **Acceptatiecriterium vooraf afspreken.** Voorstel: geen enkel
      verschil op overtredingen, en maximaal 5 minuten afwijking op dag- en
      weektotalen. Spreek dit af vóór je begint, niet achteraf. *(V/B)*
- [ ] **S4** Elk verschil uitzoeken tot je de oorzaak weet. Een verschil dat
      je niet kunt verklaren is een blokkade, geen afrondingskwestie.
- [ ] **S5** Roadsoft blijft in deze hele fase gewoon leidend.

---

## Fase 4 — Pas hierna: beslissen over overstappen

- [ ] **O1** Alleen als fase 3 schoon is.
- [ ] **O2** **Bewaarplicht overnemen** vraagt aantoonbare opslag met
      back-up en herstel. Dit is de zwaarste stap: verliest Sharzi die data,
      dan is dat een nalevingsprobleem voor Blex, niet alleen voor ons.
- [ ] **O3** Historische DDD-bestanden overhalen uit Roadsoft (zie R5).
- [ ] **O4** Pas daarna Roadsoft opzeggen, met de opzegtermijn uit R6.

---

## Wat ik alvast gebouwd heb (geen actie nodig)
- Volledige rij- en rusttijdenmotor: 561/2006 én Arbeidstijdenbesluit vervoer
- Bewaking van de uitleestermijnen 90 en 28 dagen
- Bron per chauffeur zichtbaar: uitgelezen tacho of app-registratie
- Leverancieronafhankelijk datamodel met fixtures en contract tests
- Vergelijkingsfunctie voor het schaduwdraaien

## Wat ik bewust nog NIET gebouwd heb
- De echte Roadsoft-mapping — die kan pas na R1/R2/R3
- Terugkeerplicht bij twee verkorte weekrusten — wacht op B5
- Dubbele bemanning in de UI — wacht op B6
