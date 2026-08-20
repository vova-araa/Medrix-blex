import { MODULE_GROEPEN, type ModuleDef, type ModuleGroep, type ModuleId } from "../data/modules";
import { t } from "../i18n";
import { Icoon } from "./Icoon";

type Tab = ModuleId | "modules";

interface Props {
  modules: ModuleDef[];
  actief: Tab;
  ingeklapt: boolean;
  aantalMeldingen: number;
  ongelezenBerichten: number;
  onKies: (tab: Tab) => void;
  onKlapIn: () => void;
}

/**
 * Navigatie per werkgebied. De zijbalk groeit mee met het aantal modules —
 * in een enkele bovenbalk vielen onderdelen buiten beeld zodra er meer dan
 * ongeveer tien bij kwamen. Ingeklapt blijft alleen de icoonkolom over.
 */
export function Zijbalk({
  modules, actief, ingeklapt, aantalMeldingen, ongelezenBerichten, onKies, onKlapIn,
}: Props) {
  const perGroep = (groep: ModuleGroep) => modules.filter((m) => m.groep === groep);

  const badgeVan = (id: ModuleId): number => {
    if (id === "operatie") return aantalMeldingen;
    if (id === "berichten") return ongelezenBerichten;
    return 0;
  };

  return (
    <nav className={`zijbalk${ingeklapt ? " ingeklapt" : ""}`} aria-label={t("nav.hoofdmenu")}>
      {MODULE_GROEPEN.map((groep) => {
        const items = perGroep(groep);
        if (items.length === 0) return null;
        return (
          <div className="zb-groep" key={groep}>
            <div className="zb-groepnaam">{t(`nav.groep.${groep}`)}</div>
            {items.map((moduleDef) => {
              const badge = badgeVan(moduleDef.id);
              const naam = t(`module.${moduleDef.id}.naam`);
              return (
                <button
                  key={moduleDef.id}
                  className={`zb-item${actief === moduleDef.id ? " actief" : ""}`}
                  onClick={() => onKies(moduleDef.id)}
                  title={ingeklapt ? naam : undefined}
                  aria-current={actief === moduleDef.id ? "page" : undefined}
                >
                  <Icoon naam={moduleDef.icoon} maat={15} />
                  <span className="zb-label">{naam}</span>
                  {badge > 0 && <span className="nav-badge">{badge}</span>}
                </button>
              );
            })}
          </div>
        );
      })}

      <div className="zb-groep zb-onder">
        <button
          className={`zb-item${actief === "modules" ? " actief" : ""}`}
          onClick={() => onKies("modules")}
          title={ingeklapt ? t("nav.modules") : undefined}
        >
          <Icoon naam="modules" maat={15} />
          <span className="zb-label">{t("nav.modules")}</span>
        </button>
        <button className="zb-item zb-klap" onClick={onKlapIn}>
          <Icoon naam="pijl" maat={15} />
          <span className="zb-label">{t("nav.klapIn")}</span>
        </button>
      </div>
    </nav>
  );
}
