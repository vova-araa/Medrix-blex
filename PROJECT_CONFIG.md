# PROJECT_CONFIG — Sharzi

Vastgelegd op 2026-07-30 na de initialisatievragen uit CLAUDE.md §0 en §2.

## Product

- **Productnaam:** Sharzi (voorheen werknaam TRAJECT)
- **Omschrijving:** Alles-in-één transport management systeem voor Nederlandse en
  Europese wegvervoerders. Drie oppervlakken, één datamodel:
  - **Sharzi TMS** — web-app voor planner, administratie en controller (desktop-first)
  - **Sharzi Mobile** — chauffeursapp, offline-first
  - **Sharzi Dock** — scanner-app voor depot en warehouse
- **Eerste klant / designpartner:** Blex Logistics
- **Te vervangen systeem bij Blex:** MendriX TMS (Blex gebruikt nu losse platformen
  die Sharzi als alles-in-één-platform gaat vervangen)

## GitHub

- **Repo:** `vova-araa/Medrix-blex`
- **Huidige werkbranch:** `claude/app-review-planning-o9b13r`

## Supabase

- **Status:** nog geen Supabase-project aangemaakt
- **Dev project-ref:** _(nog aan te maken)_
- **Prod project-ref:** _(nog aan te maken)_
- **Tenant Blex (tenant_id):** n.v.t. — nog geen database
- **Productie-POD's in storage:** n.v.t. — nog geen storage bucket, dus geen
  beperkingen op destructieve operaties zolang dit zo blijft

> Zodra de Supabase-projecten bestaan: refs hier invullen én `.claude/settings.json`
> bijwerken met de juiste `project-ref` (CLAUDE.md §2, §17).

## Koppelingen

- **Live koppelingen:** geen. Er draaien nog geen integraties richting Sharzi.
- Connectors worden pas gebouwd bij concrete klantvraag (CLAUDE.md §6.7).

## Hosting & deployment

- **Hosting:** nog niet besloten — voorlopig alleen lokale ontwikkeling.
- Deploykeuze (Railway vs. Vercel) volgt later; tot die tijd geldt §16 onverkort:
  geen CLI-deploys, deployen kan straks alleen via `git push`.

## Organisatie

- **Juridische entiteit:** nieuwe entiteit (nog op te richten, naam volgt)
- **Eerste externe pilotklant:** geen — focus ligt volledig op Blex

## Productbesluiten (2026-08-07)

- **Roadsoft-alternatief:** Blex gebruikt Roadsoft voor rittenregistratie &
  urenverantwoording → in Sharzi één module: werkuren + rittenregistratie
  (inklokken, rij-/werk-/pauzetijd, km per dag), gevoed door werktijd-events.
- **Samsara-alternatief:** ingebouwde telematics — kaart met live posities,
  verkeersinfo en ETA per taak. Verkeersdata is nu gesimuleerd; provider
  (TomTom/HERE/NDW, betaald abonnement) kiezen bij livegang.
- **Facturatie:** Sharzi stelt facturen zelf op; boekhouding blijft een apart
  pakket. Geen boekhoudkoppeling tot er een concrete vraag ligt.
- **AI-integratie in drie fases:** 1) assistent/chat over eigen data,
  2) planhulp voor de planner, 3) orders inlezen uit e-mail/PDF. Nu een
  regelgebaseerde demo achter de `AiBron`-interface; Claude API bij livegang.
- **Adresbibliotheek:** per losadres instructies en foto's, vastgelegd door
  het bedrijf, zichtbaar voor de chauffeur bij zijn taak.
- **AVG:** GPS-posities en werkuren zijn persoonsgegevens — doelbinding is
  planning en verantwoording, niet beoordeling van chauffeurs; de chauffeur
  ziet zijn eigen registraties in de app.

## Openstaande beslissingen

- [ ] Naam en oprichting van de nieuwe juridische entiteit
- [ ] Hostingkeuze (Railway of Vercel)
- [ ] Supabase dev- en prod-project aanmaken en refs hier vastleggen
- [ ] Inventarisatie overige platformen bij Blex naast MendriX (boekhouding, boordcomputer)
