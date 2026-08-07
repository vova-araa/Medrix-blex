// Alle schermteksten zijn vertaalbaar (CLAUDE.md §7.5). NL is de eerste taal;
// EN/PL/RO volgen als eigen bestanden met dezelfde sleutels.

export const nl = {
  "app.naam": "Sharzi",
  "rol.bedrijf": "🏢 Bedrijf",
  "rol.chauffeur": "🚛 Chauffeur",

  "kpi.rittenOnderweg": "ritten onderweg",
  "kpi.takenAfgerond": "taken afgerond",
  "kpi.problemen": "problemen",
  "kpi.ongepland": "ongeplande zendingen",

  "ongepland.titel": "Ongepland",
  "ongepland.hint": "Sleep een zending op een voertuig",
  "ongepland.leeg": "Alles gepland ✓",

  "vloot.vrijVoertuig": "Vrij voertuig — sleep een zending hierheen om een rit te starten",
  "vloot.laadmeter": "{gebruikt} / {cap} laadmeter",
  "vloot.charter": "charter",
  "vloot.beschikbaar": "— beschikbaar —",

  "status.gepland": "Gepland",
  "status.onderweg": "Onderweg",
  "status.bezig": "Bezig",
  "status.afgerond": "Afgerond",
  "status.probleem": "Probleem",

  "taak.laden": "Laden",
  "taak.lossen": "Lossen",
  "taak.emballage_retour": "Emballage retour",

  "event.taak_aangemaakt": "Taak aangemaakt",
  "event.vertrokken": "Vertrokken",
  "event.aangekomen": "Aangekomen op adres",
  "event.geladen": "Geladen",
  "event.gelost": "Gelost + POD",
  "event.probleem_gemeld": "Probleem gemeld",

  "detail.gepland": "Gepland",
  "detail.tijdvenster": "Tijdvenster",
  "detail.zending": "Zending",
  "detail.voertuig": "Voertuig",
  "detail.eventlog": "Event-log",
  "detail.eventlogNoot": "Append-only · status is afgeleid uit het laatste event",
  "detail.simuleer": "Simuleer: {event}",
  "detail.sluiten": "Sluiten",

  "chauffeur.groet": "Hoi {naam}",
  "chauffeur.voortgang": "Voortgang rit",
  "chauffeur.taken": "{klaar}/{totaal} taken",
  "chauffeur.nu": "Nu · {status}",
  "chauffeur.route": "Route van vandaag",
  "chauffeur.venster": "⏱ Venster {venster}",
  "chauffeur.geenRit.titel": "Nog geen rit toegewezen",
  "chauffeur.geenRit.uitleg": "Zodra planning een rit klaarzet, zie je hem hier.",
  "chauffeur.klaar.titel": "Rit afgerond",
  "chauffeur.klaar.uitleg": "Alle {totaal} taken geregistreerd. Goede reis terug!",
  "chauffeur.actie.vertrek": "🚛 Ik vertrek",
  "chauffeur.actie.aangekomen": "📍 Aangekomen op adres",
  "chauffeur.actie.geladen": "✅ Geladen",
  "chauffeur.actie.gelost": "✍️ Gelost + POD",
  "chauffeur.actie.probleem": "⚠️ Probleem melden",
  "chauffeur.actie.hervatten": "▶️ Hervatten",
  "chauffeur.online": "Online · alles gesynct",
  "chauffeur.offline": "Offline · outbox: {aantal}",
  "chauffeur.offlineToggle": "simuleer dode zone (offline)",
  "chauffeur.nachtNoot": "🌙 Nachtmodus volgt automatisch zonsondergang · alle teksten vertaalbaar (NL/EN/PL/RO)",

  "toast.gepland": "{zending} gepland op {rit} ({kenteken}) — taak aangemaakt met event",
  "toast.pastNiet": "Past niet: {lm} lm erbij overschrijdt de {cap} lm van {kenteken}",
  "toast.geregistreerd": "{event} geregistreerd — status is nu “{status}”",
  "toast.outbox": "{event} vastgelegd — in outbox (offline), synct zodra er verbinding is",
  "toast.gesynct": "Verbinding terug — {aantal} registratie(s) uit de outbox gesynct, zonder duplicaten",

  "banner.mock": "Ontwikkelversie op mockdata — nog geen database gekoppeld",
} as const;

export type VertaalSleutel = keyof typeof nl;
