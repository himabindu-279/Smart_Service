import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Bot, Edit3, Menu, MessageSquare, MoreVertical, Plus, Send, ShieldCheck, Sparkles, Trash2, User, X } from 'lucide-react';

const welcomeMessage = { role: 'assistant', content: 'Hi, I can help identify the right marketplace service, explain what to expect, and find providers near your saved location.', suggested_service: null, providers: [], actions: [] };

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function AIAssistant() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryPayload, setRetryPayload] = useState(null);
  const [serviceLocation, setServiceLocation] = useState(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/chat/conversations'),
      user ? api.get('/users/me/location').catch(() => null) : Promise.resolve(null),
    ]).then(([items, location]) => {
      if (!mounted) return;
      setConversations(items);
      setServiceLocation(location || JSON.parse(localStorage.getItem('serviceLocation') || 'null'));
      if (items.length) setActiveId(items[0].id);
    }).catch(() => mounted && setError('Unable to load your chat history. Please try again.'))
      .finally(() => mounted && setPageLoading(false));
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return undefined; }
    let mounted = true;
    setMessages([]);
    api.get(`/chat/conversations/${activeId}/messages`).then((items) => {
      if (mounted) setMessages(items.length ? items : [welcomeMessage]);
    }).catch(() => mounted && setError('Unable to load this conversation.'));
    return () => { mounted = false; };
  }, [activeId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const createConversation = async () => {
    try {
      const conversation = await api.post('/chat/conversations', {});
      setConversations((prev) => [conversation, ...prev]);
      setActiveId(conversation.id);
      setMessages([welcomeMessage]);
      setMobileHistoryOpen(false);
      setError('');
    } catch { setError('Unable to start a new conversation.'); }
  };

  const selectConversation = (id) => { setActiveId(id); setMobileHistoryOpen(false); setError(''); };

  const renameConversation = async (conversation) => {
    const title = window.prompt('Rename conversation', conversation.title);
    if (!title || title.trim() === conversation.title) return;
    try {
      const updated = await api.patch(`/chat/conversations/${conversation.id}`, { title: title.trim() });
      setConversations((prev) => prev.map((item) => item.id === updated.id ? updated : item));
    } catch { setError('Unable to rename this conversation.'); }
  };

  const deleteConversation = async (conversation) => {
    if (!window.confirm(`Delete "${conversation.title}"?`)) return;
    try {
      await api.delete(`/chat/conversations/${conversation.id}`);
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);
      if (activeId === conversation.id) {
        setActiveId(remaining[0]?.id || null);
        setMessages(remaining.length ? [] : [welcomeMessage]);
      }
    } catch { setError('Unable to delete this conversation.'); }
  };

  const handleSend = async (textToSend, retryId = null) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;
    const clientMessageId = retryId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    setInput('');
    setError('');
    setRetryPayload(null);
    setLoading(true);
    try {
      let conversationId = activeId;
      if (!conversationId) {
        const conversation = await api.post('/chat/conversations', {});
        conversationId = conversation.id;
        setActiveId(conversationId);
        setConversations((prev) => [conversation, ...prev]);
      }
      const result = await api.post(`/chat/conversations/${conversationId}/messages`, {
        message: messageText,
        client_message_id: clientMessageId,
        latitude: serviceLocation?.latitude,
        longitude: serviceLocation?.longitude,
        location: serviceLocation?.address_line || serviceLocation?.display_name || serviceLocation?.city,
      });
      setMessages((prev) => [...prev.filter((message) => message !== welcomeMessage && message.client_message_id !== clientMessageId), result.user_message, result.assistant_message]);
      setConversations((prev) => prev.map((conversation) => conversation.id === conversationId
        ? { ...conversation, title: conversation.title === 'New chat' ? messageText.slice(0, 120) : conversation.title, updated_at: result.user_message.created_at, message_count: (conversation.message_count || 0) + 2 }
        : conversation).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
    } catch (err) {
      setMessages((prev) => [...prev.filter((message) => message.client_message_id !== clientMessageId), { role: 'user', content: messageText, client_message_id: clientMessageId }]);
      setRetryPayload({ message: messageText, clientMessageId });
      setError(err.message || 'Your message could not be completed. Please retry.');
    }
    finally { setLoading(false); }
  };

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);

  return (
    <div className="assistant-shell">
      <aside className={`assistant-history ${mobileHistoryOpen ? 'assistant-history-open' : ''}`}>
        <div className="assistant-history-header"><div className="assistant-brand"><span className="assistant-brand-mark"><Bot size={19} /></span><strong>Service guide</strong></div><button className="assistant-icon-button mobile-only" onClick={() => setMobileHistoryOpen(false)} aria-label="Close chat history"><X size={18} /></button></div>
        <button className="assistant-new-chat" onClick={createConversation}><Plus size={17} /> New chat</button>
        <div className="assistant-history-label">Your conversations</div>
        <div className="assistant-conversation-list">
          {conversations.map((conversation) => <div className={`assistant-conversation ${conversation.id === activeId ? 'active' : ''}`} key={conversation.id}><button onClick={() => selectConversation(conversation.id)}><MessageSquare size={16} /><span>{conversation.title}</span></button><div className="assistant-conversation-actions"><button onClick={() => renameConversation(conversation)} aria-label="Rename conversation"><Edit3 size={14} /></button><button onClick={() => deleteConversation(conversation)} aria-label="Delete conversation"><Trash2 size={14} /></button></div></div>)}
          {!conversations.length && !pageLoading && <p className="assistant-empty-history">Your saved chats will appear here.</p>}
        </div>
        <div className="assistant-account"><div className="assistant-account-avatar"><User size={17} /></div><div><strong>{user?.full_name || 'Account'}</strong><span>{user?.email}</span></div><button onClick={logout} aria-label="Log out" title="Log out"><MoreVertical size={17} /></button></div>
      </aside>

      <main className="assistant-main">
        <header className="assistant-topbar"><button className="assistant-icon-button mobile-only" onClick={() => setMobileHistoryOpen(true)} aria-label="Open chat history"><Menu size={20} /></button><div><h1>{activeConversation?.title || 'New conversation'}</h1><span>Grounded in the live marketplace catalog</span></div><Sparkles size={19} color="var(--primary)" /></header>
        <section className="assistant-messages" aria-live="polite">
          {pageLoading && <div className="assistant-status">Loading your conversations...</div>}
          {!pageLoading && !messages.length && <div className="assistant-welcome"><Bot size={32} /><h2>What can we solve today?</h2><p>Describe a service need and I will search the real marketplace catalog for relevant options.</p></div>}
          {messages.map((message, index) => <div className={`assistant-message-row ${message.role}`} key={message.id || `${message.role}-${index}`}><div className="assistant-message-avatar">{message.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}</div><div className="assistant-message-content"><div className="assistant-message-meta"><strong>{message.role === 'assistant' ? 'Service guide' : 'You'}</strong><span>{formatTime(message.created_at)}</span></div><div className="assistant-message-text">{message.content}</div>{message.suggested_service && <div className="assistant-service-result"><strong>{message.suggested_service.name}</strong><span>{message.suggested_service.category} · from ₹{message.suggested_service.base_price}</span></div>}{message.providers?.length > 0 && <div className="assistant-provider-list">{message.providers.map((provider) => <div className="assistant-provider" key={provider.id}><div><strong>{provider.business_name}</strong>{provider.is_verified && <ShieldCheck size={14} color="var(--primary)" />}<span>★ {provider.rating || 'New'} · ₹{provider.price || 'Quote'}</span></div><Link to={`/providers/${provider.id}?book=true`} className="btn btn-primary btn-sm">Book <ArrowRight size={13} /></Link></div>)}</div>}{message.actions?.length > 0 && <div className="assistant-actions">{message.actions.map((action) => <Link key={action.path} to={action.path} className="btn btn-secondary btn-sm">{action.label} <ArrowRight size={13} /></Link>)}</div>}</div></div>)}
          {loading && <div className="assistant-typing"><Sparkles size={16} className="animate-spin" /> Searching verified marketplace options...</div>}
          {error && <div className="assistant-error">{error} <button className="btn btn-secondary btn-sm" onClick={() => retryPayload && handleSend(retryPayload.message, retryPayload.clientMessageId)} disabled={loading}>Retry</button></div>}
          <div ref={messagesEndRef} />
        </section>
        <div className="assistant-composer-wrap"><div className="assistant-composer-hint">Ask about repairs, care, food, education, or vehicle services</div><form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); handleSend(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Message the service guide..." disabled={loading} /><button className="btn btn-primary" disabled={loading || !input.trim()} aria-label="Send message"><Send size={17} /></button></form></div>
      </main>
    </div>
  );
}
