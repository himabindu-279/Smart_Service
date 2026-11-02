import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { getServiceCategories } from '../api/client';
import ServiceCardImage from '../components/ServiceCardImage';
import { serviceCatalog } from '../config/serviceCatalog';
import '../styles/services.css';
import { useI18n } from '../context/I18nContext';

export default function Services() {
  const { t } = useI18n();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  }, []);

  return (
    <main className="services-page-container">
      <section className="services-page-heading">
        <div className="services-eyebrow"><Sparkles size={15} /> {t('services.eyebrow')}</div>
        <h1>{t('services.heading')}</h1>
        <p>{t('services.description')}</p>
      </section>

      {loading ? (
        <div className="services-state" role="status">{t('services.loadingCategories')}</div>
      ) : error ? (
        <div className="services-state services-state-error" role="alert">{error}</div>
      ) : (
        <section className="service-category-grid" aria-label="Service categories">
          {serviceCatalog.map((item) => {
            const category = categories.find((entry) => entry.slug === item.backendCategorySlug);
            const realServiceCount = category?.services?.length || 0;

            return (
              <Link
                className="service-category-card"
                key={item.slug}
                to={`/services/${item.slug}`}
                aria-label={`${t('common.explore')} ${item.title}`}
              >
                <ServiceCardImage
                  src={item.image}
                  alt={item.imageAlt}
                  className="service-category-image"
                />
                <div className="service-category-content">
                  <div className="service-category-meta">
                    <span>{t('common.serviceCount', { count: item.tasks.length })}</span>
                    <span className="service-category-live">
                      {t('common.liveServiceCount', { count: realServiceCount })}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  <span className="service-category-link">{t('services.exploreServices')} <ArrowRight size={17} /></span>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
