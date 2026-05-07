import { useState, useRef, useEffect, useCallback } from 'react';
import { computeNumerologyProfile, formatRulingNumber } from '../lib/numerology';
import './NumerologyChat.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ProfileData {
  name: string;
  birthday: string;
}

const INITIAL_PROMPT = (name: string) =>
  `Please give me a complete numerology reading for ${name}. Start with my Ruling Number and what it means for my life purpose, then cover my Day Number, Soul Urge, and Birth Chart. Use insights from "The Complete Book of Numerology" by David Phillips.`;

export function NumerologyChat() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState({ name: '', birthday: '' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const sendMessage = useCallback(
    async (userMessage: string, currentMessages: Message[]) => {
      if (!profile) return;
      setIsLoading(true);
      setStreamingText('');

      const newMessages: Message[] = [
        ...currentMessages,
        { role: 'user', content: userMessage },
      ];
      setMessages(newMessages);

      abortRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: profile.name,
            birthday: profile.birthday,
            messages: newMessages,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('Network error');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data) as { text?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                fullText += parsed.text;
                setStreamingText(fullText);
              }
            } catch {
              // ignore parse errors on individual chunks
            }
          }
        }

        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: fullText },
        ]);
        setStreamingText('');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          },
        ]);
        setStreamingText('');
      } finally {
        setIsLoading(false);
      }
    },
    [profile]
  );

  const handleStart = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.birthday) return;
      const newProfile = { name: formData.name.trim(), birthday: formData.birthday };
      setProfile(newProfile);
      setMessages([]);
      await sendMessage(INITIAL_PROMPT(newProfile.name), []);
    },
    [formData, sendMessage]
  );

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;
      setInput('');
      await sendMessage(text, messages);
    },
    [input, isLoading, messages, sendMessage]
  );

  const computed = profile ? computeNumerologyProfile(profile.name, profile.birthday) : null;

  if (!profile) {
    return (
      <div className="numerology-chat">
        <div className="nc-hero">
          <div className="nc-hero-icon">🔢</div>
          <h1 className="nc-hero-title">Numerology Reading</h1>
          <p className="nc-hero-subtitle">
            Discover your life path through the science of numbers — based on{' '}
            <em>The Complete Book of Numerology</em> by David A. Phillips
          </p>
        </div>

        <form className="nc-form" onSubmit={handleStart}>
          <div className="nc-field">
            <label className="nc-label" htmlFor="nc-name">
              Full Name (as given at birth)
            </label>
            <input
              id="nc-name"
              className="nc-input"
              type="text"
              placeholder="e.g. John David Smith"
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="nc-field">
            <label className="nc-label" htmlFor="nc-birthday">
              Date of Birth
            </label>
            <input
              id="nc-birthday"
              className="nc-input"
              type="date"
              value={formData.birthday}
              onChange={e => setFormData(p => ({ ...p, birthday: e.target.value }))}
              required
            />
          </div>

          <button className="nc-submit" type="submit">
            Reveal My Numbers ✨
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="numerology-chat">
      <div className="nc-profile-bar">
        <div className="nc-profile-info">
          <span className="nc-profile-name">{computed?.name}</span>
          <span className="nc-profile-numbers">
            Life Path{' '}
            <strong>{formatRulingNumber(computed?.rulingNumber ?? '')}</strong>
            {' · '}Day{' '}
            <strong>{formatRulingNumber(computed?.dayNumber ?? '')}</strong>
            {' · '}Soul Urge{' '}
            <strong>{formatRulingNumber(computed?.soulUrgeNumber ?? '')}</strong>
          </span>
        </div>
        <button
          className="nc-reset-btn"
          onClick={() => {
            abortRef.current?.abort();
            setProfile(null);
            setMessages([]);
            setStreamingText('');
            setInput('');
          }}
        >
          ← New Reading
        </button>
      </div>

      <div className="nc-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`nc-msg nc-msg--${msg.role}`}>
            <div className="nc-msg-bubble">
              <MessageContent content={msg.content} />
            </div>
          </div>
        ))}

        {isLoading && streamingText && (
          <div className="nc-msg nc-msg--assistant">
            <div className="nc-msg-bubble">
              <MessageContent content={streamingText} />
              <span className="nc-cursor" />
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
          <div className="nc-msg nc-msg--assistant">
            <div className="nc-msg-bubble nc-msg-bubble--typing">
              <span className="nc-dot" />
              <span className="nc-dot" />
              <span className="nc-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="nc-input-row" onSubmit={handleSend}>
        <input
          className="nc-chat-input"
          type="text"
          placeholder="Ask about your numbers, relationships, life path…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          className="nc-send-btn"
          type="submit"
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering: bold, headings, lists
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="nc-md-h2">{line.slice(3)}</h3>);
    } else if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="nc-md-h3">{line.slice(4)}</h4>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="nc-md-h1">{line.slice(2)}</h2>);
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <li key={i} className="nc-md-li">
          <InlineMarkdown text={line.slice(2)} />
        </li>
      );
    } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<strong key={i} className="nc-md-strong">{line.slice(2, -2)}</strong>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="nc-md-spacer" />);
    } else {
      elements.push(
        <p key={i} className="nc-md-p">
          <InlineMarkdown text={line} />
        </p>
      );
    }
    i++;
  }

  return <div className="nc-md">{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
