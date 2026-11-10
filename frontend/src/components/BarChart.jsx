/**
 * Graphique à barres horizontales (HTML/CSS), une ligne par catégorie.
 * rows   : [{ label, values: [number, ...] }]
 * series : [{ name, color }]  (même ordre que values)
 * format : number -> string (étiquette directe de chaque barre)
 * Une légende est affichée dès 2 séries ; chaque barre porte sa valeur (étiquette directe).
 */
export default function BarChart({ title, rows, series, format, unit }) {
  const max = Math.max(...rows.flatMap((r) => r.values), 1e-9);
  return (
    <figure className="chart" aria-label={title}>
      <figcaption>
        <strong>{title}</strong>
        {unit && <span className="muted"> ({unit})</span>}
      </figcaption>
      {series.length > 1 && (
        <ul className="legend">
          {series.map((s) => (
            <li key={s.name}><i style={{ background: s.color }} />{s.name}</li>
          ))}
        </ul>
      )}
      <div className="chart-rows">
        {rows.map((r) => (
          <div className="chart-row" key={r.label}>
            <span className="chart-label">{r.label}</span>
            <div className="chart-bars">
              {r.values.map((v, i) => (
                <div className="bar-line" key={i} title={`${r.label} · ${series[i].name} : ${format(v)}`}>
                  <div className="bar" style={{ width: `${Math.max((v / max) * 100, 0.8)}%`, background: series[i].color }} />
                  <span className="bar-value">{format(v)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
