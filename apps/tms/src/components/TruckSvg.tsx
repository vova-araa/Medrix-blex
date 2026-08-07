export function TruckSvg() {
  return (
    <svg viewBox="0 0 220 62" aria-hidden="true">
      <rect className="tr-box" x="2" y="4" width="138" height="38" rx="4" />
      <rect className="tr-band" x="2" y="4" width="138" height="8" rx="4" />
      <text className="tr-text" x="12" y="30">SHARZI</text>
      <rect className="tr-chassis" x="140" y="34" width="10" height="8" />
      <path className="tr-cab" d="M154 16 h26 a6 6 0 0 1 5 3 l8 13 v10 h-45 V22 a6 6 0 0 1 6 -6 z" />
      <rect className="tr-window" x="172" y="20" width="13" height="10" rx="2" />
      <rect className="tr-chassis" x="2" y="42" width="191" height="4" />
      {[26, 50, 122, 172].map((cx) => (
        <g key={cx}>
          <circle className="tr-wheel" cx={cx} cy="50" r="9" />
          <circle className="tr-rim" cx={cx} cy="50" r="3.5" />
        </g>
      ))}
    </svg>
  );
}
