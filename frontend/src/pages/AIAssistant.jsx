import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Bot, Send, User, Sparkles, Star, MapPin, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your SmartService AI Consultant. Describe any issue with your home appliances, healthcare needs, plumbing, tutoring, or vehicle, and I will diagnose the exact marketplace service and connect you with top verified specialists in Bengaluru.',
      suggested_service: null,
      providers: [],
      actions: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || loading) return;

    const userMessage = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await api.post('/assistant/chat', {
        message: messageText,
        history: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        latitude: 12.9116,
        longitude: 77.6389
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.response,
        suggested_service: response.suggested_service,
        providers: response.providers || [],
        actions: response.actions || []
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I experienced an issue processing your request. Please ensure the backend server is reachable, or try rephrasing your service requirement.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    "My AC is making strange noise and not cooling",
    "Kitchen sink pipe is leaking water under cabinet",
    "Switch board is sparking when I turn on the geyser",
    "Elderly family member needs post-surgery home nursing",
    "Car engine makes a grinding noise during braking"
  ];

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem', maxWidth: '950px' }}>
      {/* Title */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: '#fff',
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(37,99,235,0.3)'
        }}>
          <Bot size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.65rem', marginBottom: '0.15rem' }}>SmartService AI Consultant</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            RAG-powered conversational diagnostic engine connected to real Bengaluru database services & specialists.
          </p>
        </div>
      </div>

      {/* Chat Window */}
      <div className="card" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '680px',
        padding: 0,
        overflow: 'hidden'
      }}>
        {/* Messages Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: m.role === 'user' ? '80%' : '90%'
              }}
            >
              {m.role === 'assistant' && (
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Bot size={18} />
                </div>
              )}

              <div style={{
                background: m.role === 'user' ? 'var(--primary)' : '#f8fafc',
                color: m.role === 'user' ? '#ffffff' : 'var(--text-main)',
                padding: '1.1rem 1.35rem',
                borderRadius: 'var(--radius-lg)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                lineHeight: 1.6,
                fontSize: '0.925rem'
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>

                {/* Grounded Service Badge */}
                {m.suggested_service && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Matched Marketplace Service
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--secondary)' }}>
                        {m.suggested_service.name}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.4rem' }}>
                          ({m.suggested_service.category})
                        </span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--secondary)' }}>
                      ₹{m.suggested_service.base_price}
                    </div>
                  </div>
                )}

                {/* Suggested Real Providers from DB */}
                {m.providers && m.providers.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Recommended Verified Specialists:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {m.providers.map((p) => (
                        <div key={p.id} style={{
                          background: '#ffffff',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.business_name}</span>
                              {p.is_verified && <ShieldCheck size={14} color="var(--primary)" />}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              ⭐ {p.rating} ({p.total_ratings}) • {p.distance_km} km away • ₹{p.price}
                            </div>
                          </div>
                          <Link
                            to={`/providers/${p.id}?book=true`}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Book Now
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Suggestions */}
                {m.actions && m.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {m.actions.map((act, aIdx) => (
                      <Link
                        key={aIdx}
                        to={act.path}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        <span>{act.label}</span>
                        <ArrowRight size={13} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--secondary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <User size={18} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={18} className="animate-spin" />
              </div>
              <div style={{
                background: '#f8fafc',
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                fontSize: '0.875rem',
                color: 'var(--text-muted)'
              }}>
                Searching marketplace knowledge graph and diagnosing service need...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Query Pills */}
        <div style={{
          padding: '0.6rem 1.25rem',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-main)',
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>Quick:</span>
          {sampleQueries.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sq)}
              disabled={loading}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: '0.75rem',
            background: '#ffffff'
          }}
        >
          <input
            type="text"
            placeholder="Type your service inquiry, symptoms or question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.25rem', flexShrink: 0 }}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
