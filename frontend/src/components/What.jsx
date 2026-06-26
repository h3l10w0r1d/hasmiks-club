import t from '../data/content'

export default function What({ lang }) {
  const c = t.what
  const hy = lang === 'hy'
  return (
    <section className="what">
      <div className="what-hd">
        <div className="sec-tag" style={{ justifyContent: 'center' }}>
          {hy ? c.tagHy : c.tagEn}
        </div>
        <h2 className="sec-h" style={{ textAlign: 'center' }}>
          {hy
            ? <>Ինչ է ստանում <em>յուրաքանչյուր</em> անդամ</>
            : <>What every member <em>receives</em></>
          }
        </h2>
        <p className="what-sub">{hy ? c.subHy : c.subEn}</p>
      </div>

      <div className="cards">
        {c.cards.map((card) => (
          <div className="card" key={card.num}>
            <div className="card-num">{card.num}</div>
            <div className="card-title">
              {hy ? card.titleHy : card.titleEn}
            </div>
            <p className="card-text">
              {hy ? card.textHy : card.textEn}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
