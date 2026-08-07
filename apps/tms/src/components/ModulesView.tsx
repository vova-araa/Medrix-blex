import type { AppState } from "../data/state";
import { MODULES, type ModuleId } from "../data/modules";
import { t } from "../i18n";
import { Icoon } from "./Icoon";

interface Props {
  state: AppState;
  onZetModule: (module: ModuleId, actief: boolean) => void;
}

export function ModulesView({ state, onZetModule }: Props) {
  const actief = new Set(state.actieveModules);

  return (
    <div className="modules-main">
      <div className="facturen-kop">
        <h3 className="zij-kop">{t("modules.titel")}</h3>
        <p className="uren-noot">{t("modules.noot")}</p>
      </div>
      <div className="modules-grid">
        {MODULES.map((moduleDef) => {
          const aan = actief.has(moduleDef.id);
          return (
            <div
              key={moduleDef.id}
              className={`module-kaart${moduleDef.inOntwikkeling ? " ontwikkeling" : aan ? " aan" : " uit"}`}
            >
              <div className="module-kop">
                <span className="module-icoon"><Icoon naam={moduleDef.icoon} maat={20} /></span>
                <b>{t(`module.${moduleDef.id}.naam`)}</b>
                {moduleDef.kern && <span className="module-badge kern">{t("modules.kern")}</span>}
                {moduleDef.inOntwikkeling && (
                  <span className="module-badge roadmap">{t("modules.roadmap")}</span>
                )}
              </div>
              <p className="module-oms">{t(`module.${moduleDef.id}.oms`)}</p>
              <div className="module-voet">
                {moduleDef.inOntwikkeling ? (
                  <span className="module-status">{t("modules.binnenkort")}</span>
                ) : moduleDef.kern ? (
                  <span className="module-status">{t("modules.altijdAan")}</span>
                ) : (
                  <label className="module-schakel">
                    <input
                      type="checkbox"
                      checked={aan}
                      onChange={(e) => onZetModule(moduleDef.id, e.target.checked)}
                    />
                    {aan ? t("modules.actief") : t("modules.inactief")}
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
