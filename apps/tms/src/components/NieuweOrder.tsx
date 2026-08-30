import type { Order, Zending } from "@sharzi/domain";
import type { AppState } from "../data/state";
import { t } from "../i18n";
import { Icoon } from "./Icoon";
import { OrderFormulier } from "./OrderFormulier";

interface Props {
  state: AppState;
  nu: string;
  standaardDatum: string;
  onSluit: () => void;
  onAanmaken: (order: Order, zending: Zending) => void;
}

export function NieuweOrder({ state, nu, standaardDatum, onSluit, onAanmaken }: Props) {
  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="detail">
        <div className="detail-head">
          <button className="btn detail-close" onClick={onSluit} aria-label={t("detail.sluiten")}>
            <Icoon naam="kruis" maat={13} />
          </button>
          <div className="eyebrow">{t("order.eyebrow")}</div>
          <h3>{t("order.titel")}</h3>
        </div>
        <div className="detail-body">
          <OrderFormulier
            state={state}
            nu={nu}
            standaardDatum={standaardDatum}
            knopLabel={t("order.aanmaken")}
            onAanmaken={onAanmaken}
          />
        </div>
      </aside>
    </div>
  );
}
