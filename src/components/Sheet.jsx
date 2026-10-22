const ZONES_X = ['A', 'B', 'C', 'D', 'E', 'F'];
const ZONES_Y = ['1', '2', '3', '4'];

export function TitleBlock({ meta }) {
  return (
    <div className="title-block">
      <div className="tb-row tb-head">
        <span className="tb-no num">{meta.number}</span>
        <span className="label">Specimen</span>
      </div>
      <div className="tb-title serif">{meta.title}</div>
      <div className="tb-row tb-cells">
        <span>
          <i className="label">Seed</i>
          <b className="num">{meta.seed}</b>
        </span>
        <span>
          <i className="label">Scale</i>
          <b className="num">{meta.scale}</b>
        </span>
        <span>
          <i className="label">Date</i>
          <b className="num">{meta.date}</b>
        </span>
      </div>
      {meta.stats.length > 0 && (
        <div className="tb-stats num">
          {meta.stats.map(([k, v]) => (
            <span key={k}>
              {k} <b>{v}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sheet({ meta, children }) {
  return (
    <section className="sheet">
      <div className="zones zones-x" aria-hidden="true">
        {ZONES_X.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      <div className="zones zones-y" aria-hidden="true">
        {ZONES_Y.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      <div className="sheet-frame">
        {children}
        <p className="sheet-note serif">
          <span className="num">{meta.number}.</span> {meta.note}
        </p>
        <TitleBlock meta={meta} />
      </div>
    </section>
  );
}
