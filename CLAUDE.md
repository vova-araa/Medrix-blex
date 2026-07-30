# Agent Instructions — Sharzi

Read this entire file before starting any task. Do not take any action until you have read all sections, especially the Domeinregels (§5–§9) and the Learned Rules.

---

## 0. Openstaande beslissingen

Beantwoord op 2026-07-30 — details in `PROJECT_CONFIG.md`. Vul de resterende punten niet zelf in; vraag ernaar zodra ze relevant worden.

- [x] Definitieve productnaam: **Sharzi** (voorheen werknaam TRAJECT)
- [x] GitHub repo + organisatie: `vova-araa/Medrix-blex`
- [ ] Supabase project-ref (dev / prod gescheiden?) — nog geen project aangemaakt
- [ ] Hosting: Railway of Vercel — nog niet besloten, voorlopig alleen lokale ontwikkeling
- [x] Juridische entiteit die het product uitgeeft: nieuwe entiteit (naam en oprichting nog open)
- [x] Eerste externe pilotklant naast Blex: geen — focus ligt volledig op Blex

---

## 1. Wat is dit project

Sharzi is een transport management systeem voor Nederlandse en Europese wegvervoerders,
gebouwd als moderne tegenhanger van MendriX TMS. Drie oppervlakken, één datamodel:

| Onderdeel | Gebruiker | Vorm |
|---|---|---|
| **Sharzi TMS** | Planner, administratie, controller | Web-app (desktop-first, dense UI) |
| **Sharzi Mobile** | Chauffeur, charter | Mobiele app, offline-first |
| **Sharzi Dock** | Depot- en warehousemedewerker | Mobiele scanner-app |

**Eerste klant en designpartner:** Blex Logistics. Wat Blex morgen gebruikt heeft voorrang
op wat een hypothetische markt zou willen. Blex draait nu op MendriX TMS en losse
platformen; Sharzi vervangt die als alles-in-één-platform.

**Waar we het verschil maken** (bewaak dit bij elke feature-beslissing):

1. Web-planbord in plaats van een Windows desktop-client
2. REST + webhooks in plaats van SOAP/XML over sockets
3. Koppelingen die de klant zelf kan inzien, testen en opnieuw afspelen
4. Echt offline-first in de chauffeursapp, inclusief zuinig met accu
5. Self-service onboarding: een vervoerder met acht auto's draait binnen een dag

Bouw niets dat geen van deze vijf punten dient, tenzij een klant er expliciet om vraagt.

---

## 2. Projectinitialisatie

Controleer eerst of `PROJECT_CONFIG.md` bestaat in de root.

### Als PROJECT_CONFIG.md NIET bestaat

Stel de vragen uit §0, plus:

```
1. Welke Supabase project-ref is dev en welke is prod?
2. Draait er al een tenant voor Blex? Zo ja: welk tenant_id?
3. Welke koppelingen zijn al live? (vervoerder / boekhouding / boordcomputer)
4. Zijn er productie-POD's in de storage bucket? (bepaalt of destructieve
   operaties überhaupt bespreekbaar zijn)
```

Schrijf de antwoorden weg naar `PROJECT_CONFIG.md` en pas daarna `.claude/settings.json`
aan met de juiste Supabase `project-ref`.

**Begin nooit met werken zonder dat PROJECT_CONFIG.md bestaat en volledig is ingevuld.**

---

## 3. De 3-Laag Architectuur

**Layer 1: Directive (Wat te doen)**
- SOPs in Markdown, leven in `directives/`
- Per connector één directive: `directives/connector_dhl_parcel.md`, `connector_exact_online.md`, …
- Per domeinproces één directive: `directives/order_to_cash.md`, `directives/emballage_saldi.md`

**Layer 2: Orchestration (Beslissingen nemen)**
- Dit ben jij. Je leest directives, roept execution-scripts aan, handelt errors af, vraagt
  om verduidelijking, en werkt directives bij met wat je leert.
- Je schrijft niet zelf een DHL-label-request in je antwoord — je leest
  `directives/connector_dhl_parcel.md` en roept `execution/carrier_label.py` aan.

**Layer 3: Execution (Het werk doen)**
- Deterministische scripts in `execution/`
- Environment variables en API tokens in `.env`
- Connector-fixtures en contract tests horen hier, niet in de app-code

---

## 4. Bestandsstructuur

```
apps/
  tms/                 — Web-app planner (React)
  driver/              — Chauffeursapp
  dock/                — Cross-dock scanner
packages/
  domain/              — Entiteiten, statusmachines, berekeningen. Geen UI, geen I/O.
  ui/                  — Gedeelde componenten
integrations/
  <connector>/         — Eén map per koppeling: client, mapping, fixtures, contract test
supabase/
  migrations/          — Genummerde SQL-migraties
  functions/           — Edge functions
execution/             — Python/Node scripts
directives/            — SOPs in Markdown
methods/               — Werkmethodes
memory/                — Team memory (zie §19)
.tmp/                  — Tussenbestanden (nooit committen)
.env                   — API keys (NOOIT in GitHub)
.env.example           — Template zonder echte waarden (WEL in GitHub)
.claude/settings.json  — MCP-configuratie
CLAUDE.md              — Dit bestand
PROJECT_CONFIG.md      — Projectconfiguratie
```

Domeinlogica hoort in `packages/domain/`. Als een berekening in een React-component staat,
staat hij op de verkeerde plek.

---

## 5. Domeinmodel — harde regels

De canonieke keten is: **order → zending → leg → rit → taak → event**.

- Een **order** is de commerciële afspraak met de opdrachtgever.
- Een **zending** is fysieke lading met een eigen identiteit en barcode.
- Een **leg** is één verplaatsing van A naar B. Cross-dock betekent meerdere legs.
- Een **rit** is wat een chauffeur op een dag rijdt.
- Een **taak** is één handeling op één adres binnen een rit.
- Een **event** is een onveranderlijk feit: wie, wat, waar, wanneer, op welk apparaat.

**Regels die je nooit overtreedt:**

1. **De event-log is append-only.** Statussen zijn afgeleid, nooit primair. Je muteert nooit
   een status zonder dat er een event onder ligt. In transport is "wie heeft wat wanneer
   geregistreerd" juridisch bewijs (CMR, aansprakelijkheid, claims).
2. **Emballagesaldi zijn afgeleid van transacties.** Nooit een `saldo`-kolom bijwerken.
3. **Tijden in UTC in de database, altijd met tijdzone.** Weergave in `Europe/Amsterdam`
   tenzij de gebruiker anders instelt. Tijdvensters horen bij een adres, niet bij een order.
4. **Geld als integer in centen, met expliciete valuta.** Nooit floats.
5. **Kentekens genormaliseerd opslaan** (hoofdletters, zonder streepjes, met landcode).
   Formatteren doe je pas bij weergave.
6. **POD's, foto's en handtekeningen zijn onveranderlijk.** Nooit overschrijven, nooit
   verwijderen. Een correctie is een nieuw bestand met een verwijzing naar het origineel.
7. **Elke tabel heeft `tenant_id`.** Zie §8.

Bij twijfel over een nieuw veld: hoort dit bij de order (afspraak), de zending (lading),
of het event (wat er gebeurde)? Kies bewust en leg het vast in de migratie-comment.

---

## 6. Integratielaag — harde regels

Koppelingen zijn geen feature maar een doorlopende verplichting. Behandel ze als zodanig.

1. **Nooit vervoerder- of pakketspecifieke logica in `apps/`.** Alles achter de
   connector-interface in `integrations/`.
2. **Elke inkomende call is idempotent.** Externe partijen sturen dubbel. Gebruik een
   idempotency key en sla verwerkte message-ids op.
3. **Elke uitgaande call heeft retry met exponential backoff en een dead-letter queue.**
   Nooit stilzwijgend falen — een gefaalde koppeling moet zichtbaar zijn in de UI.
4. **Elke connector heeft fixtures en een contract test.** Geen live API-calls in tests.
5. **Sandbox eerst.** Nooit tegen een productie-vervoerderomgeving testen zonder expliciete
   toestemming — labels aanmaken kost geld en genereert echte zendingen.
6. **Credentials per tenant, versleuteld, nooit in code of migraties.**
7. **Geen nieuwe koppeling bouwen zonder klantvraag.** Drie werkende koppelingen zijn meer
   waard dan vijftien half onderhouden connectors.

Bij een nieuwe connector: schrijf eerst `directives/connector_<naam>.md` met de mapping,
de foutscenario's en het rate limit. Pas daarna code.

---

## 7. Offline-first — regels voor de chauffeursapp

De app moet volledig doorwerken zonder verbinding. Depots hebben dode zones.

1. **Outbox pattern.** Elke registratie gaat lokaal in een wachtrij en wordt daarna gesynct.
   De UI blokkeert nooit op het netwerk.
2. **Client genereert UUID's.** Nooit wachten op een server-id.
3. **Conflictregel:** de server wint op planning (ritten, taken, volgorde), de client wint op
   registratie (scans, foto's, handtekeningen, tijden). Nooit een chauffeursregistratie
   overschrijven met serverdata.
4. **GPS adaptief.** Geofencing en variabele sampling in plaats van continue tracking.
   Accuverbruik is een productkenmerk, geen bijzaak.
5. **Elke schermtekst is vertaalbaar.** NL, EN, PL, RO minimaal. Geen hardcoded strings.
6. **Nacht-modus is geen thema-extraatje** maar de standaard tussen zonsondergang en -opkomst.

---

## 8. Multi-tenant & RLS

- Elke tabel heeft `tenant_id`, elke query is tenant-scoped.
- **RLS staat altijd aan.** Controleer dit expliciet na elke migratie en meld het in je output.
- De `service_role` key komt nooit in client-code of in een app-bundle.
- Een tenant kan meerdere business units en depots hebben. Depot-scoping zit ónder tenant-scoping,
  nooit ernaast.
- Interdepot-verrekening loopt tussen business units binnen één tenant. Nooit tussen tenants.

---

## 9. Privacy & AVG

Chauffeursdata is persoonsgegeven. Dit is geen formaliteit — het is een verkoopargument
richting ondernemingsraden en een risico bij nalatigheid.

- GPS-locatie, rijtijden en urenregistratie zijn herleidbaar tot een persoon.
- Doelbinding: locatiedata is voor planning en bewijsvoering, niet voor beoordeling van
  individuele chauffeurs. Bouw geen features die dat impliciet mogelijk maken zonder overleg.
- Retentie expliciet per datasoort vastleggen in de migratie.
- Een chauffeur moet zijn eigen registraties kunnen inzien in de app.
- Bespreek elke nieuwe vorm van tracking of meting eerst met de gebruiker.

---

## 10. Operationele Principes

**1. Check eerst voor tools**
Controleer `execution/` per je directive voor je een script schrijft.

**2. Self-anneal als dingen breken**
- Lees de foutmelding en stack trace
- Fix het script en test het opnieuw
- Update de directive met wat je hebt geleerd

**3. Update directives als je leert**
Directives zijn levende documenten. Maak of overschrijf geen directives zonder te vragen.

---

## 11. Denken vóór Coderen

**Geen aannames. Verberg verwarring niet. Benoem tradeoffs.**

Vóór je implementeert:
- Benoem aannames expliciet. Bij twijfel: vraag.
- Bij meerdere interpretaties: presenteer ze — kies niet stilletjes.
- Als er een simpelere aanpak is: zeg het. Push back waar gerechtvaardigd.
- Als iets onduidelijk is: stop. Benoem wat verwart. Vraag.

Transport zit vol edge cases die er in het klein onschuldig uitzien: deelleveringen,
weigeringen, retouren, meerdaagse ritten, wisselende trailers, charters die onderaannemen.
Vraag hoe een geval hoort te lopen voordat je het in code vastlegt.

---

## 12. Simpelheid Eerst

**Minimale code die het probleem oplost. Niets speculatiefs.**

- Geen features voorbij wat gevraagd is.
- Geen abstracties voor eenmalige code.
- Geen "flexibiliteit" of "configureerbaarheid" die niet gevraagd is.
- Geen error handling voor onmogelijke scenario's.
- Als je 200 regels schrijft die ook 50 kunnen zijn: herschrijf.

Uitzondering: de connector-interface (§6) en de event-log (§5). Daar is structuur vooraf
goedkoper dan een migratie achteraf.

---

## 13. Chirurgische Wijzigingen

**Raak alleen aan wat moet. Ruim alleen je eigen rommel op.**

- "Verbeter" geen aangrenzende code, comments of formatting.
- Refactor niet wat niet stuk is.
- Match bestaande stijl, ook als jij het anders zou doen.
- Zie je los dode code? Benoem het — verwijder het niet.

Als jouw wijzigingen orphans creëren:
- Verwijder imports/variabelen/functies die door JOUW wijziging ongebruikt zijn.
- Verwijder geen pre-existing dead code tenzij daarom gevraagd.

De test: elke gewijzigde regel moet direct terug te voeren zijn op de user-request.

---

## 14. Doelgedreven Uitvoering

**Definieer succescriteria. Loop tot geverifieerd.**

Zet taken om in verifieerbare doelen:
- "Emballage werkt" → "Saldo per klant per depot klopt na 200 gemengde transacties, inclusief
  correcties en retouren"
- "Koppeling met DPD" → "Label aanmaken, status terugkrijgen en annuleren tegen sandbox,
  contract test groen"
- "App werkt offline" → "Vliegtuigmodus aan, volledige rit afhandelen, netwerk aan,
  alles gesynct zonder duplicaten"
- "Fix the bug" → "Schrijf een test die het reproduceert, laat hem slagen"

Voor multi-step taken: benoem een kort plan.

```
1. [Stap] → verify: [check]
2. [Stap] → verify: [check]
3. [Stap] → verify: [check]
```

---

## 15. Self-Correcting Rules Engine

1. Wanneer de gebruiker je corrigeert of je een fout maakt, voeg dan direct een nieuwe regel
   toe aan "Learned Rules" onderaan
2. Formaat: `N. [CATEGORIE] Nooit/Altijd doe X — omdat Y`
3. Categorieën: `[STYLE]`, `[CODE]`, `[ARCH]`, `[TOOL]`, `[PROCESS]`, `[DATA]`, `[UX]`,
   `[SECURITY]`, `[ACCOUNT]`, `[DOMAIN]`, `[INTEGRATION]`
4. Als twee regels conflicteren, wint de nieuwere regel
5. Verwijder nooit regels — voeg een nieuwe toe die hem overschrijft

---

## 16. Deployment — Harde Regels (nooit overtreden)

**GitHub repo:** `vova-araa/Medrix-blex`
**Hosting:** nog niet besloten (Railway of Vercel — zie §0); voorlopig alleen lokale ontwikkeling

### De enige juiste manier om te deployen
1. `git push origin main`
2. De hostingpartij pikt de push automatisch op via de GitHub-koppeling
3. Klaar — geen CLI-deploys

### Verboden zonder uitzondering
- `vercel deploy` / `vercel link` — CLI is ingelogd als `seo-kitchen`
- `railway up` vanaf een lokale machine
- `rm -rf .vercel` of het verwijderen van projectkoppelingen
- Zoeken in `~/.vercel/`, `~/.railway/`, `~/.config/` naar credentials van andere projecten

### Migraties
Database-migraties worden **nooit** meegedeployed zonder aparte bevestiging. Eerst de
migratie bespreken, dan draaien op dev, dan pas prod.

---

## 17. Accountbeveiliging & Authenticatie

### GitHub
- Controleer ALTIJD eerst met `git remote -v` welk account gekoppeld is
- Zoek NOOIT zelf naar SSH-keys of credentials op het systeem
- Vraag bij twijfel expliciet welk GitHub-account gebruikt moet worden

### Supabase
- Vraag ALTIJD bevestiging voordat je migraties of schema-wijzigingen uitvoert
- Verwijder NOOIT productiedata zonder expliciete toestemming
- Gebruik ALTIJD de `--project-ref` in `.claude/settings.json`
- Zoek NOOIT zelf naar Supabase-tokens op het systeem
- Dubbel check altijd of RLS aanstaat

### Vervoerder- en boekhoud-API's
- Nooit productiecredentials gebruiken waar sandbox bestaat
- Nooit een echt label of een echte factuur aanmaken tijdens ontwikkelen
- API-keys van klanten blijven in de tenant-vault, nooit in `.env` van het project

### Algemeen
- Gebruik NOOIT een account of token die je zelf hebt gevonden
- `.env` bestanden worden NOOIT in GitHub gezet
- Voer NOOIT een push, deploy of migratie uit zonder bevestiging

---

## 18. CLAUDE.md Bestandsregels

- Pas NOOIT de globale `~/.claude/CLAUDE.md` aan
- Aanpassingen gaan ALLEEN in de CLAUDE.md van dit project
- Vraag ALTIJD bevestiging voordat je een CLAUDE.md aanpast

---

## 19. Taal & Communicatie

- Communiceer altijd in het Nederlands tenzij anders gevraagd
- Code, variabelenamen en commits in het Engels
- **Domeintermen in het Nederlands, ook in code**, waar de sector die term gebruikt:
  `emballage`, `rit`, `taak`, `depot`, `charter`, `laadmeter`, `vrachtbrief`.
  Half vertalen is erger dan niet vertalen — kies per begrip en houd het consequent.
- UI-teksten zijn nooit hardcoded (zie §7.5)

---

## 20. Team memory

Sla auto-memory bestanden (user/feedback/project/reference) op in `./memory/` in deze repo,
niet in de user-lokale `.claude/projects/.../memory/` map, zodat ze git-tracked en gedeeld
zijn. Zelfde formaat: één `MEMORY.md` index plus één frontmatter-bestand per memory.
Geen secrets, geen persoonlijke voorkeuren die anderen niet zouden moeten zien.

---

## Learned Rules

<!-- Nieuwe regels worden onder deze regel toegevoegd. Bewerk niets boven deze sectie. -->

1. [ACCOUNT] Gebruik nooit `vercel deploy` of `vercel link` — CLI is ingelogd als `seo-kitchen`. Deploy altijd via `git push`.
2. [SECURITY] Zoek nooit zelf naar auth-bestanden op het systeem — deze horen bij andere projecten.
3. [SECURITY] Gebruik nooit een account of token die je zelf hebt gevonden — vraag altijd aan de gebruiker.
4. [PROCESS] Pas nooit de globale `~/.claude/CLAUDE.md` aan — aanpassingen gaan alleen in het huidige project.
6. [DATA] Voer nooit Supabase-migraties uit zonder expliciete bevestiging van de gebruiker.
7. [PROCESS] Voer nooit een push, deploy of migratie uit zonder bevestiging van de gebruiker.
8. [PROCESS] Controleer altijd of PROJECT_CONFIG.md bestaat voor je begint — stel anders eerst de initialisatievragen.
9. [DOMAIN] Muteer nooit een status zonder een onderliggend event — de event-log is append-only en juridisch bewijs.
10. [DOMAIN] Bereken emballagesaldi altijd uit transacties, nooit uit een opgeslagen saldoveld — saldi lopen anders stil uit de pas.
11. [DOMAIN] Sla geld op als integer in centen met expliciete valuta — floats geven afrondingsverschillen op facturen.
12. [INTEGRATION] Plaats nooit vervoerderspecifieke logica buiten `integrations/` — anders is een connector niet los te vervangen.
13. [INTEGRATION] Test nooit tegen een productieomgeving van een vervoerder zonder toestemming — labels kosten geld en maken echte zendingen aan.
14. [ARCH] Laat de chauffeursapp nooit blokkeren op een netwerkcall — alle registraties gaan via de outbox.
15. [ARCH] Overschrijf nooit een chauffeursregistratie met serverdata — server wint op planning, client wint op registratie.
16. [SECURITY] Controleer na elke migratie expliciet of RLS aanstaat en meld dit in je output.
17. [PROCESS] Bouw geen nieuwe koppeling zonder concrete klantvraag — elke connector is jarenlang onderhoud.
18. [PROCESS] Vraag de gebruiker alles één voor één — stel nooit meerdere beslisvragen tegelijk in één bericht.
