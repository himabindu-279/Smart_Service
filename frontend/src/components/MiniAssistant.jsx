import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { api } from '../api/client';

export default function MiniAssistant() {
  const [serviceLocation, setServiceLocation] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! What service can I help you find?' },
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const loadLocation = async () => {
      try {
        const saved = localStorage.getItem('token') ? await api.get('/users/me/location') : null;
        const stored = saved || JSON.parse(localStorage.getItem('serviceLocation') || 'null');
        if (isMounted && stored) setServiceLocation(stored);
      } catch {
        const stored = JSON.parse(localStorage.getItem('serviceLocation') || 'null');
        if (isMounted && stored) setServiceLocation(stored);
      }
    };
    loadLocation();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages, loading]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/assistant/chat', {
        message,
        history,
        latitude: serviceLocation?.latitude,
        longitude: serviceLocation?.longitude,
        location: serviceLocation?.address_line || serviceLocation?.display_name || serviceLocation?.city,
      });
      setMessages((current) => [...current, {
        role: 'assistant',
        content: response.response || 'I could not find an answer just now. Please try again.',
      }]);
    } catch {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: 'I could not reach the assistant. Please try again in a moment.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mini-assistant">
      {isOpen && (
        <section className="mini-assistant-panel" aria-label="AI service assistant">
          <header className="mini-assistant-header">
            <span className="mini-assistant-heading"><Bot size={19} /> Service assistant</span>
            <button type="button" className="mini-assistant-close" onClick={() => setIsOpen(false)} aria-label="Close assistant">
              <X size={18} />
            </button>
          </header>
          <div className="mini-assistant-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`mini-assistant-message ${message.role}`}>
                {message.content}
              </div>
            ))}
            {loading && <div className="mini-assistant-message assistant">Thinking...</div>}
            <div ref={messagesEndRef} />
          </div>
          <form className="mini-assistant-form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Describe what you need"
              aria-label="Message the service assistant"
              disabled={loading}
            />
            <button type="submit" aria-label="Send message" disabled={loading || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="mini-assistant-launcher"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        title="AI service assistant"
      >
        {isOpen ? <X size={23} /> : <Bot size={25} />}
      </button>
    </div>
  );
}