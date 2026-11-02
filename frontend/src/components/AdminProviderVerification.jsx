import React, { useEffect, useState } from 'react';
import { Download, MapPin, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ALL'];

export default function AdminProviderVerification() {
  const { t } = useI18n();
  const [status, setStatus] = useState('PENDING');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadProviders = async () => {
    setLoading(true);
    setError('');
    try {
      setProviders(await api.get('/admin/provider-verifications', { status }));
    } catch (requestError) {
      setError(requestError.message || 'Could not load provider verification requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, [status]);

  const reviewProvider = async (provider, nextStatus) => {
    const reason = nextStatus === 'APPROVED'
      ? null
      : window.prompt(t('admin.reviewReason', { status: t(`admin.${nextStatus.toLowerCase()}`) }));
    if (nextStatus !== 'APPROVED' && !reason?.trim()) return;
    setBusyId(provider.id);
    setError('');
    try {
      await api.post(`/admin/providers/${provider.id}/verification`, { status: nextStatus, reason });
      await loadProviders();
    } catch (requestError) {
      setError(requestError.message || 'Provider review could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  const downloadDocument = async (document) => {
    try {
      const blob = await api.download(`/admin/provider-documents/${document.id}/download`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = document.filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError.message || 'Document download failed.');
    }
  };

  return (
    <section className="admin-verification">
      <header className="admin-verification__header">
        <div>
          <h2>{t('admin.verification')}</h2>
          <p>{t('admin.description')}</p>
        </div>
        <ShieldCheck aria-hidden="true" size={28} />
      </header>
      <nav className="admin-verification__filters" aria-label={t('admin.filter')}>
        {STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={status === item}
            className={status === item ? 'is-active' : ''}
            onClick={() => setStatus(item)}
          >
            {t(`admin.${item.toLowerCase()}`)}
          </button>
        ))}
      </nav>
      {error && <p className="admin-verification__error" role="alert">{error}</p>}
      {loading ? <p>{t('admin.loadingRecords')}</p> : providers.length === 0 ? (
        <div className="admin-verification__empty">{t('admin.noStatusProviders')}</div>
      ) : (
        <div className="admin-verification__list">
          {providers.map((provider) => (
            <article key={provider.id} className="admin-verification__card">
              <div className="admin-verification__summary">
                <div>
                  <span className={`admin-verification__badge status-${provider.status.toLowerCase()}`}>
                    {provider.status}
                  </span>
                  <h3>{provider.business_name}</h3>
                  <p>{provider.name} · {provider.email}</p>
                  <p>{provider.phone || t('admin.phoneMissing')} · {t('admin.yearsExperience', { count: provider.experience_years })}</p>
                </div>
                <div className="admin-verification__location">
                  <MapPin size={16} aria-hidden="true" />
                  <span>{provider.address || 'No address provided'}</span>
                  <small>
                    {provider.latitude != null && provider.longitude != null
                      ? `${Number(provider.latitude).toFixed(5)}, ${Number(provider.longitude).toFixed(5)}`
                      : 'Coordinates not saved'}
                  </small>
                </div>
              </div>
              <p className="admin-verification__meta">
                {provider.email_verified ? t('admin.emailVerified') : t('admin.emailUnverified')} · {t('admin.registered')} {new Date(provider.registration_date).toLocaleString()}
                {' · '}{t('admin.coverage')} {provider.service_radius_km} km
              </p>
              <div className="admin-verification__services">
                <h4>{t('admin.submittedServices')}</h4>
                {provider.services.length ? provider.services.map((service) => (
                  <div key={service.id} className="admin-verification__service">
                    <strong>{service.name}</strong>
                    <span>₹{service.price} · {service.status} · {service.location || 'Location missing'} · {service.radius_km} km</span>
                    <small>{service.availability || 'Availability not provided'}{service.description ? ` — ${service.description}` : ''}</small>
                  </div>
                )) : <p>{t('admin.noServices')}</p>}
              </div>
              <div className="admin-verification__documents">
                <h4>{t('admin.privateDocuments')}</h4>
                {provider.documents.length ? provider.documents.map((document) => (
                  <button key={document.id} type="button" onClick={() => downloadDocument(document)}>
                    <Download size={15} aria-hidden="true" />
                    {document.document_type}: {document.filename}
                  </button>
                )) : <p>{t('admin.noDocumentsUploaded')}</p>}
              </div>
              {provider.review_history?.length > 0 && (
                <details className="admin-verification__history">
                  <summary>{t('admin.reviewHistory', { count: provider.review_history.length })}</summary>
                  {provider.review_history.map((review, index) => (
                    <p key={`${review.reviewed_at}-${index}`}>
                      {review.status} by {review.reviewer} · {new Date(review.reviewed_at).toLocaleString()}
                      {review.reason ? ` — ${review.reason}` : ''}
                    </p>
                  ))}
                </details>
              )}
              <div className="admin-verification__actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyId === provider.id || provider.status === 'APPROVED'}
                  onClick={() => reviewProvider(provider, 'APPROVED')}
                >
                  {t('admin.approve')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busyId === provider.id || provider.status === 'REJECTED'}
                  onClick={() => reviewProvider(provider, 'REJECTED')}
                >
                  {t('admin.reject')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busyId === provider.id || provider.status === 'SUSPENDED'}
                  onClick={() => reviewProvider(provider, 'SUSPENDED')}
                >
                  {t('admin.suspend')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}