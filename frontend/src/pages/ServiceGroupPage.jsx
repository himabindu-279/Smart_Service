import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { getServiceCategories } from '../api/client';
import ServiceCardImage from '../components/ServiceCardImage';
import { getServiceCategory } from '../config/serviceCatalog';
import { useI18n } from '../context/I18nContext';

export default function ServiceGroupPage() {
  const { t } = useI18n();
  const { categorySlug } = useParams();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const config = getServiceCategory(categorySlug);

  useEffect(() => {
    let isMounted = true;

    getServiceCategories()
      .then((data) => {
        if (isMounted) setCategories(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || t('services.loadFailed'));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [categorySlug]);

  const taskCards = useMemo(() => {
    if (!config) return [];
    const services = categories.flatMap((category) => (
      (category.services || []).map((service) => ({ ...service, categorySlug: category.slug }))
    ));

    return config.tasks
      .map((task) => ({
        task,
        service: services.find((service) => service.slug === task.serviceSlug),
      }))
      .filter(({ service }) => Boolean(service));
  }, [categories, config]);

  if (loading) {
    return <main className="services-page-container"><div className="services-state" role="status">{t('common.loading')} {config?.title || t('common.services')}...</div></main>;
  }

  if (error || !config) {
    return (
      <main className="services-page-container">
        <div className="services-state services-state-error" role="alert">{error || t('services.unavailable')}</div>
        <Link to="/services" className="services-back-button"><ArrowLeft size={17} /> {t('services.backAll')}</Link>
      </main>
    );
  }

  return (
    <main className="services-page-container">
      <nav className="services-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/services">{t('common.services')}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{config.title}</span>
      </nav>

      <header className="service-group-heading">
        <div>
          <div className="services-eyebrow"><Sparkles size={15} /> {config.title}</div>
          <h1>{t('services.chooseHelp')}</h1>
          <p>{config.description}</p>
        </div>
        <Link to="/services" className="services-back-button"><ArrowLeft size={17} /> {t('services.allCategories')}</Link>
      </header>

      {taskCards.length ? (
        <section className="service-task-grid" aria-label={`${config.title} subservices`}>
          {taskCards.map(({ task, service }) => (
            <Link
              className="service-task-card"
              key={`${task.slug}-${service.id}`}
              to={`/services/${service.categorySlug}/${service.slug}?task=${encodeURIComponent(task.slug)}`}
            >
              <ServiceCardImage
                src={task.image}
                alt={task.imageAlt}
                className="service-task-image"
              />
              <div className="service-task-content">
                <div className="service-task-meta">
                  <span>{t('common.providers', { count: service.active_providers_count || 0 })}</span>
                  <span><MapPin size={13} /> {t('services.localService')}</span>
                </div>
                <h2>{task.title}</h2>
                <p>{task.description}</p>
                <div className="service-task-footer">
                  <span>{t('common.from')} ₹{Number(service.base_price || 0).toLocaleString('en-IN')}</span>
                  <span className="service-task-action">{t('services.viewProviders')} <ArrowRight size={16} /></span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="services-state">{t('services.empty')}</div>
      )}
    </main>
  );
}
