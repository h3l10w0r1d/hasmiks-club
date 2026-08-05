import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAuthModal } from '../context/AuthModalContext'
import { useContent } from '../context/SiteContentContext'
import { E, AddItemButton, RemoveItemButton } from './Editable'
import { getPublicPackages } from '../api/packages'
import Reveal from './Reveal'
import PackageCard, { packageCardClassName } from './PackageCard'

export default function Pricing({ lang }) {
  const { user } = useAuth()
  const { openRegister } = useAuthModal()
  const navigate = useNavigate()
  const t = useContent()
  const c = t.pricing
  const hy = lang === 'hy'
  const suffix = hy ? 'Hy' : 'En'
  const p = (b) => `pricing.${b}${suffix}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])
  const paragraphs = Array.isArray(v('sub')) ? v('sub') : [v('sub')].filter(Boolean)
  const terms = Array.isArray(v('terms')) ? v('terms') : []

  const [packages, setPackages] = useState([])
  const [termsOpen, setTermsOpen] = useState(false)

  useEffect(() => {
    getPublicPackages().then(setPackages).catch(() => setPackages([]))
  }, [])

  return (
    <section className="pricing" id="pricing">
      <Reveal as="div">
        <E as="div" className="sec-tag" style={{ justifyContent: 'center' }} path={p('tag')} value={v('tag')} />
        <E as="h2" className="sec-h" style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto 12px' }} path={p('h')} value={v('h')} emphasis />
        {paragraphs.map((text, i) => (
          <div className="hc-item-row" key={i}>
            <E as="p" className="pricing-sub" path={p('sub')} value={text} listIndex={i} emphasis />
            {paragraphs.length > 1 && <RemoveItemButton paths={[p('sub')]} index={i} />}
          </div>
        ))}
        <AddItemButton paths={[p('sub')]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
      </Reveal>

      <div className="plans">
        {packages.map((pkg, pos) => (
          <Reveal as="div" className={packageCardClassName(pkg)} key={pkg.id} delay={120 + pos * 90}>
            <PackageCard
              pkg={pkg}
              lang={lang}
              footer={
                <button type="button" className={`plan-btn ${pkg.badge ? 'plan-btn-fill' : 'plan-btn-outline'}`} onClick={() => (user ? navigate('/dashboard') : openRegister())}>
                  {v('btn')}
                </button>
              }
            />
          </Reveal>
        ))}
      </div>

      <Reveal as="div" className="pricing-gift-teaser" style={{ textAlign: 'center', marginTop: 32 }}>
        <E as="p" className="pricing-sub" path={p('giftTeaser')} value={v('giftTeaser')} emphasis />
        <Link to="/gift" className="plan-btn-outline" style={{ display: 'inline-block', marginTop: 10, padding: '10px 22px', borderRadius: 999 }}>
          <E as="span" path={p('giftLink')} value={v('giftLink')} />
        </Link>
      </Reveal>

      {terms.length > 0 && (
        <Reveal as="div" className="pricing-terms">
          <button type="button" className="pricing-terms-toggle" onClick={() => setTermsOpen((o) => !o)}>
            <E as="span" path={p('termsTitle')} value={v('termsTitle')} />
            <ChevronDown size={18} className={termsOpen ? 'pricing-terms-chevron open' : 'pricing-terms-chevron'} />
          </button>
          {termsOpen && (
            <>
              <ul className="pricing-terms-list">
                {terms.map((term, i) => (
                  <li key={i} className="hc-item-row">
                    <E as="span" path={p('terms')} value={term} listIndex={i} />
                    {terms.length > 1 && <RemoveItemButton paths={[p('terms')]} index={i} />}
                  </li>
                ))}
              </ul>
              <AddItemButton paths={[p('terms')]} label={hy ? 'Ավելացնել պայման' : 'Add term'} />
            </>
          )}
        </Reveal>
      )}
    </section>
  )
}
