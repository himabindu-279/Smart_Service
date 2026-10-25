import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bot, BriefcaseBusiness, CalendarCheck, CheckCircle2, ChevronRight, HeartPulse, Home, MapPin, Search, ShieldCheck, Sparkles, Star, Utensils, Wrench } from 'lucide-react';
import { api } from '../api/client';

const categoryIcons = { healthcare: HeartPulse, 'home-services': Home, 'food-services': Utensils, automotive: Wrench };
const categoryColors = ['blue', 'mint', 'amber', 'coral', 'indigo', 'teal'];

export default function PublicHome() {
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
        <nav className="public-nav-links" aria-label="Public navigation"><a href="#services">Services</a><a href="#how-it-works">How it works</a><a href="#assistant">AI Guide</a></nav>
        <div className="public-nav-actions"><Link to="/login" className="public-nav-login">Sign in</Link><Link to="/register" className="btn btn-primary public-nav-cta">Get started <ArrowUpRight size={16} /></Link></div>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <div className="public-eyebrow"><span className="public-eyebrow-dot" />Trusted help, thoughtfully matched</div>
            <h1>Good help should feel <em>closer.</em></h1>
            <p className="public-hero-lede">Find the right local professional for the things that keep your home, health, learning, and life moving.</p>
            <form className="public-search" onSubmit={openSearch}>
              <Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What do you need help with?" aria-label="Search services" /><button type="submit" className="btn btn-primary">Explore <ArrowRight size={16} /></button>
              {matches.length > 0 && <div className="public-search-results">{matches.map((service) => <Link key={service.id} to={`/login?next=${encodeURIComponent(`/services/${service.category.slug}/${service.slug}`)}`}><span><strong>{service.name}</strong><small>{service.category.name}</small></span><ChevronRight size={16} /></Link>)}</div>}
            </form>
            <div className="public-hero-notes"><span><CheckCircle2 size={15} /> Approved marketplace providers</span><span><MapPin size={15} /> Search by your location</span></div>
          </div>
          <div className="public-hero-visual"><img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=85" alt="Professional home service specialist at work" /><div className="public-visual-label"><span className="public-status-dot" /><span><strong>Real people. Real services.</strong><small>Ready when you are</small></span></div><div className="public-visual-float"><ShieldCheck size={18} /><span>Vetted marketplace</span></div></div>
        </section>

        <section className="public-trust-strip"><span>One place for everyday essentials</span><div><span><Home size={17} /> Home</span><span><HeartPulse size={17} /> Healthcare</span><span><BriefcaseBusiness size={17} /> Education</span><span><Wrench size={17} /> Auto</span></div></section>

        <section className="public-section" id="services"><div className="public-section-heading"><div><div className="public-kicker">Explore the marketplace</div><h2>Whatever you need next.</h2></div><Link to="/login?next=%2Fservices" className="public-text-link">View all services <ArrowRight size={16} /></Link></div>{categoryError && <p className="public-inline-error">{categoryError}</p>}{loading ? <div className="public-loading">Loading available services...</div> : <div className="public-category-grid">{categories.map((category, index) => { const Icon = categoryIcons[category.slug] || Sparkles; return <Link className={`public-category-card ${categoryColors[index % categoryColors.length]}`} to={`/login?next=${encodeURIComponent(`/services/${category.slug}`)}`} key={category.id}><span className="public-category-icon"><Icon size={21} /></span><span className="public-category-number">0{index + 1}</span><h3>{category.name}</h3><p>{category.description || 'Explore services from approved local professionals.'}</p><span className="public-category-footer"><strong>{category.services?.length || 0} services</strong><ArrowUpRight size={17} /></span></Link> })}</div>}</section>

        <section className="public-process-band" id="how-it-works"><div className="public-section-heading public-heading-light"><div><div className="public-kicker">A better way to get things done</div><h2>From need to next step.</h2></div><p>Everything you need to make a confident choice, without the noise.</p></div><div className="public-steps"><Step number="01" icon={Search} title="Tell us what you need" text="Describe the job in your own words, or ask the Service Guide." /><Step number="02" icon={ShieldCheck} title="Compare real options" text="See relevant services and approved providers from the marketplace." /><Step number="03" icon={CalendarCheck} title="Book with confidence" text="Choose a provider and manage the appointment in one place." /></div></section>

        <section className="public-ai-section" id="assistant"><div className="public-ai-orbit"><div className="public-ai-center"><Bot size={30} /></div><span className="public-orbit-card orbit-one"><Sparkles size={15} /> Understands context</span><span className="public-orbit-card orbit-two"><MapPin size={15} /> Finds nearby options</span><span className="public-orbit-card orbit-three"><ShieldCheck size={15} /> Uses verified data</span></div><div className="public-ai-copy"><div className="public-kicker">Meet your Service Guide</div><h2>Not sure what to book?<br /><em>Start with a conversation.</em></h2><p>Explain the problem, ask a follow-up, or switch categories mid-conversation. The guide uses the live marketplace catalog to help you take the next useful step.</p><Link to="/login?next=%2Fassistant" className="btn btn-primary">Try the AI Guide <ArrowRight size={17} /></Link></div></section>

        <section className="public-cta"><div><div className="public-kicker">Your next step is simple</div><h2>Make room for the things<br />that matter.</h2></div><Link to="/register" className="btn btn-light">Create your account <ArrowUpRight size={17} /></Link></section>
      </main>

      <footer className="public-footer"><div className="public-footer-main"><div><Link to="/" className="public-brand public-brand-footer"><span className="public-brand-mark"><Sparkles size={16} /></span><span>SmartService<span className="public-brand-accent">AI</span></span></Link><p>Everyday services, made easier to find.</p></div><div className="public-footer-links"><div><strong>Explore</strong><Link to="/login?next=%2Fservices">Services</Link><Link to="/login?next=%2Fdiscover">Discover</Link></div><div><strong>Company</strong><a href="#how-it-works">How it works</a><a href="#assistant">Service Guide</a></div><div><strong>Account</strong><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></div></div></div><div className="public-footer-bottom"><span>© 2026 SmartServiceAI</span><span>Built around real marketplace data</span></div></footer>
    </div>
  );
}

function Step({ number, icon: Icon, title, text }) {
  return <div className="public-step"><span className="public-step-number">{number}</span><span className="public-step-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p></div>;
}
