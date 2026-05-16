import './App.css'
import { useLang } from './hooks/useLang'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Band from './components/Band'
import Why from './components/Why'
import What from './components/What'
import Story from './components/Story'
import Pricing from './components/Pricing'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'

export default function App() {
  const [lang, setLang] = useLang()

  return (
    <>
      <Nav lang={lang} setLang={setLang} />
      <Hero lang={lang} />
      <Band lang={lang} />
      <Why lang={lang} />
      <What lang={lang} />
      <Story lang={lang} />
      <Pricing lang={lang} />
      <FinalCta lang={lang} />
      <Footer />
    </>
  )
}
