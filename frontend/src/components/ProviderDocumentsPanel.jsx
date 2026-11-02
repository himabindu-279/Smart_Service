import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

const REQUIRED_DOCUMENTS = [
  { type: 'IDENTITY', label: 'Identity document' },
  { type: 'SERVICE_QUALIFICATION', label: 'Service qualification / license' },
];

export default function ProviderDocumentsPanel() {
  const [documents, setDocuments] = useState([]);
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      setDocuments(await api.get('/providers/me/documents'));
    } catch (error) {
      setMessage(error.message || 'Could not load uploaded documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const uploadDocuments = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage('');
    try {
      for (const { type, label } of REQUIRED_DOCUMENTS) {
        if (!files[type]) continue;
        const form = new FormData();
        form.append('document_type', type);
        form.append('upload', files[type]);
        await api.post('/providers/me/documents', form);
      }
      setFiles({});
      formElement.reset();
      setMessage('Documents uploaded to private storage for administrator review.');
      await loadDocuments();
    } catch (error) {
      setMessage(error.message || 'Document upload failed. Retry the missing document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="provider-documents card" aria-labelledby="provider-documents-title">
      <div>
        <h3 id="provider-documents-title">Verification documents</h3>
        <p>Only authorized administrators can inspect these private files.</p>
      </div>
      {loading ? <p>Loading document status...</p> : (
        <ul className="provider-documents__list">
          {REQUIRED_DOCUMENTS.map(({ type, label }) => {
            const uploaded = documents.find((document) => document.document_type === type);
            return (
              <li key={type}>
                <span>{label}</span>
                <strong className={uploaded ? 'is-uploaded' : 'is-missing'}>
                  {uploaded ? `Uploaded: ${uploaded.original_filename}` : 'Required'}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={uploadDocuments} className="provider-documents__form">
        {REQUIRED_DOCUMENTS.map(({ type, label }) => (
          <label key={type}>
            {label}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => setFiles((current) => ({ ...current, [type]: event.target.files?.[0] }))}
            />
          </label>
        ))}
        <button type="submit" className="btn btn-primary" disabled={saving || !Object.keys(files).length}>
          {saving ? 'Uploading...' : 'Upload selected documents'}
        </button>
      </form>
      {message && <p role="status" className="provider-documents__message">{message}</p>}
    </section>
  );
}