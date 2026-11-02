import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bot, BriefcaseBusiness, CalendarCheck, CheckCircle2, ChevronRight, HeartPulse, Home, MapPin, Search, ShieldCheck, Sparkles, Star, Utensils, Wrench } from 'lucide-react';
import { api } from '../api/client';
import { I18nBoundary, useI18n } from '../context/I18nContext';
import LanguageSelector from '../components/LanguageSelector';

const categoryIcons = { healthcare: HeartPulse, 'home-services': Home, 'food-services': Utensils, automotive: Wrench };
const categoryColors = ['blue', 'mint', 'amber', 'coral', 'indigo', 'teal'];

function PublicHomeContent() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');

  useEffect(() => {
    api.get('/categories').then(setCategories).catch((error) => setCategoryError(error.message || 'Service categories are temporarily unavailable.')).finally(() => setLoading(false));
  }, []);

  const services = useMemo(() => categories.flatMap((category) => (category.services || []).map((service) => ({ ...service, category }))), [categories]);
  const matches = query.trim() ? services.filter((service) => `${service.name} ${service.description || ''} ${service.category.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5) : [];

  const openSearch = (event) => {
    event.preventDefault();
    navigate(`/login?next=${encodeURIComponent('/discover')}`);
  };

  return (
    <div className="public-site">
      <header className="public-nav">
        <Link to="/" className="public-brand"><span className="public-brand-mark"><Sparkles size={18} /></span><span>SmartService<span className="public-brand-accent">AI</span></span></Link>
        <nav className="public-nav-links" aria-label={t('home.nav')}><a href="#services">{t('common.services')}</a><a href="#how-it-works">{t('home.howItWorks')}</a><a href="#assistant">{t('home.guide')}</a></nav>
        <div className="public-nav-actions"><LanguageSelector /><Link to="/login" className="public-nav-login">{t('home.signIn')}</Link><Link to="/register" className="btn btn-primary public-nav-cta">{t('home.getStarted')} <ArrowUpRight size={16} /></Link></div>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <div className="public-eyebrow"><span className="public-eyebrow-dot" />{t('home.trusted')}</div>
            <h1>{t('home.heroTitle')} <em>{t('home.closer')}</em></h1>
            <p className="public-hero-lede">{t('home.heroDescription')}</p>
            <form className="public-search" onSubmit={openSearch}>
              <Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('home.whatNeed')} aria-label={t('home.searchServices')} /><button type="submit" className="btn btn-primary">{t('common.explore')} <ArrowRight size={16} /></button>
              {matches.length > 0 && <div className="public-search-results">{matches.map((service) => <Link key={service.id} to={`/login?next=${encodeURIComponent(`/services/${service.category.slug}/${service.slug}`)}`}><span><strong>{service.name}</strong><small>{service.category.name}</small></span><ChevronRight size={16} /></Link>)}</div>}
            </form>
            <div className="public-hero-notes"><span><CheckCircle2 size={15} /> {t('home.approvedProviders')}</span><span><MapPin size={15} /> {t('home.searchLocation')}</span></div>
          </div>
          <div className="public-hero-visual"><img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=85" alt="Professional home service specialist at work" /><div className="public-visual-label"><span className="public-status-dot" /><span><strong>{t('home.realServices')}</strong><small>{t('home.ready')}</small></span></div><div className="public-visual-float"><ShieldCheck size={18} /><span>{t('home.vetted')}</span></div></div>
        </section>

        <section className="public-trust-strip"><span>{t('home.everyday')}</span><div><span><Home size={17} /> {t('home.homeCategory')}</span><span><HeartPulse size={17} /> {t('home.healthcareCategory')}</span><span><BriefcaseBusiness size={17} /> {t('home.educationCategory')}</span><span><Wrench size={17} /> {t('home.autoCategory')}</span></div></section>

        <section className="public-section" id="services"><div className="public-section-heading"><div><div className="public-kicker">{t('home.marketplace')}</div><h2>{t('home.nextNeed')}</h2></div><Link to="/login?next=%2Fservices" className="public-text-link">{t('home.viewAllServices')} <ArrowRight size={16} /></Link></div>{categoryError && <p className="public-inline-error">{categoryError}</p>}{loading ? <div className="public-loading">{t('home.loadingServices')}</div> : <div className="public-category-grid">{categories.map((category, index) => { const Icon = categoryIcons[category.slug] || Sparkles; return <Link className={`public-category-card ${categoryColors[index % categoryColors.length]}`} to={`/login?next=${encodeURIComponent(`/services/${category.slug}`)}`} key={category.id}><span className="public-category-icon"><Icon size={21} /></span><span className="public-category-number">0{index + 1}</span><h3>{category.name}</h3><p>{category.description || t('home.serviceFallback')}</p><span className="public-category-footer"><strong>{t('common.serviceCount', { count: category.services?.length || 0 })}</strong><ArrowUpRight size={17} /></span></Link> })}</div>}</section>

        <section className="public-process-band" id="how-it-works"><div className="public-section-heading public-heading-light"><div><div className="public-kicker">{t('home.processKicker')}</div><h2>{t('home.processTitle')}</h2></div><p>{t('home.processDescription')}</p></div><div className="public-steps"><Step number="01" icon={Search} title={t('home.stepOneTitle')} text={t('home.stepOneText')} /><Step number="02" icon={ShieldCheck} title={t('home.stepTwoTitle')} text={t('home.stepTwoText')} /><Step number="03" icon={CalendarCheck} title={t('home.stepThreeTitle')} text={t('home.stepThreeText')} /></div></section>

        <section className="public-ai-section" id="assistant"><div className="public-ai-orbit"><div className="public-ai-center"><Bot size={30} /></div><span className="public-orbit-card orbit-one"><Sparkles size={15} /> {t('home.understand')}</span><span className="public-orbit-card orbit-two"><MapPin size={15} /> {t('home.nearby')}</span><span className="public-orbit-card orbit-three"><ShieldCheck size={15} /> {t('home.verifiedData')}</span></div><div className="public-ai-copy"><div className="public-kicker">{t('home.guideKicker')}</div><h2>{t('home.guideTitle')}<br /><em>{t('home.guidePrompt')}</em></h2><p>{t('home.guideDescription')}</p><Link to="/login?next=%2Fassistant" className="btn btn-primary">{t('home.tryGuide')} <ArrowRight size={17} /></Link></div></section>

        <section className="public-cta"><div><div className="public-kicker">{t('home.nextStep')}</div><h2>{t('home.ctaTitle')}</h2></div><Link to="/register" className="btn btn-light">{t('home.createAccount')} <ArrowUpRight size={17} /></Link></section>
      </main>

      <footer className="public-footer"><div className="public-footer-main"><div><Link to="/" className="public-brand public-brand-footer"><span className="public-brand-mark"><Sparkles size={16} /></span><span>SmartService<span className="public-brand-accent">AI</span></span></Link><p>{t('home.footerDescription')}</p></div><div className="public-footer-links"><div><strong>{t('common.explore')}</strong><Link to="/login?next=%2Fservices">{t('common.services')}</Link><Link to="/login?next=%2Fdiscover">{t('common.discover')}</Link></div><div><strong>{t('home.company')}</strong><a href="#how-it-works">{t('home.howItWorks')}</a><a href="#assistant">{t('home.guide')}</a></div><div><strong>{t('common.account')}</strong><Link to="/login">{t('home.signIn')}</Link><Link to="/register">{t('home.createAccount')}</Link></div></div></div><div className="public-footer-bottom"><span>© 2026 SmartServiceAI</span><span>{t('home.builtOnData')}</span></div></footer>
    </div>
  );
}

function Step({ number, icon: Icon, title, text }) {
  return <div className="public-step"><span className="public-step-number">{number}</span><span className="public-step-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p></div>;
}

export default function PublicHome() {
  return <I18nBoundary><PublicHomeContent /></I18nBoundary>;
}
