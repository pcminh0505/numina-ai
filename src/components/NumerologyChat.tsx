import { useState, useRef, useEffect, useCallback } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { computeNumerologyProfile, computeAdvancedProfile, formatRulingNumber } from '../lib/numerology';
import { useCredits } from '../hooks/useCredits';
import { useAdvancedUnlock } from '../hooks/useAdvancedUnlock';
import { useBuyCredits } from '../hooks/useBuyCredits';
import { NumerologyProfile } from './NumerologyProfile';
import { NumerologyAdvanced } from './NumerologyAdvanced';
import './NumerologyChat.css';

type NumerologyPhase = 'entry' | 'profile' | 'advanced' | 'chat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ProfileData {
  name: string;
  birthday: string;
}

const INITIAL_PROMPT =
  `Hi! I just saw my Numina AI numerology profile. What's the most interesting or surprising thing you notice about my numbers? Start with the one insight that feels most "me" — keep it short and conversational, and ask me something at the end so we can dig deeper.`;

export function NumerologyChat() {
  const { address } = useConnection();
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const [phase, setPhase]       = useState<NumerologyPhase>('entry');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState({ name: '', birthday: '' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef       = useRef<AbortController | null>(null);

  const { data: credits, refetch: refetchCredits } = useCredits(address);
  const advancedUnlock = useAdvancedUnlock(address);
  const buyCredits     = useBuyCredits(address);

  // ── Session persistence ───────────────────────────────────────────────────
  // Hydrate from localStorage when wallet address becomes available
  useEffect(() => {
    const key = `numerology_session_${address ?? 'guest'}`;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;
      const saved = JSON.parse(stored) as {
        profileData: ProfileData;
        messages: Message[];
        phase: 'profile' | 'chat';
      };
      if (saved.profileData?.name && saved.profileData?.birthday) {
        setProfileData(saved.profileData);
        setFormData({ name: saved.profileData.name, birthday: saved.profileData.birthday });
        setMessages(saved.messages ?? []);
        setPhase(saved.phase === 'chat' ? 'chat' : 'profile');
      }
    } catch {
      // ignore corrupt / missing data
    }
  }, [address]);

  // Persist session on every state change
  useEffect(() => {
    if (!profileData || phase === 'entry') return;
    const key = `numerology_session_${address ?? 'guest'}`;
    try {
      localStorage.setItem(key, JSON.stringify({ profileData, messages, phase }));
    } catch {
      // storage quota exceeded or private mode
    }
  }, [profileData, messages, phase, address]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const isAdvancedUnlocked =
    advancedUnlock.isUnlocked || (credits?.advancedUnlocked ?? false);

  const sendMessage = useCallback(
    async (userMessage: string, currentMessages: Message[]) => {
      if (!profileData) return;
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
            name: profileData.name,
            birthday: profileData.birthday,
            messages: newMessages,
            wallet: address,
            tier: isAdvancedUnlocked ? 'advanced' : 'free',
            chainId,
          }),
          signal: abortRef.current.signal,
        });

        if (response.status === 402) {
          const data = await response.json() as { error?: string };
          if (data.error === 'credits_depleted') {
            void refetchCredits();
            setIsLoading(false);
            setStreamingText('');
            return;
          }
        }

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
        // Refresh credit count after each message
        void refetchCredits();
        void queryClient.invalidateQueries({ queryKey: ['credits', address] });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
        ]);
        setStreamingText('');
      } finally {
        setIsLoading(false);
      }
    },
    [profileData, address, isAdvancedUnlocked, refetchCredits, queryClient]
  );

  const handleStart = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.birthday) return;
      setProfileData({ name: formData.name.trim(), birthday: formData.birthday });
      setMessages([]);
      setPhase('profile');
    },
    [formData]
  );

  const handleStartChat = useCallback(() => {
    setPhase('chat');
    // Trigger initial reading on first chat entry
    if (profileData && messages.length === 0) {
      void sendMessage(INITIAL_PROMPT, []);
    }
  }, [profileData, messages.length, sendMessage]);

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

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setProfileData(null);
    setMessages([]);
    setStreamingText('');
    setInput('');
    setPhase('entry');
    setFormData({ name: '', birthday: '' });
    try {
      localStorage.removeItem(`numerology_session_${address ?? 'guest'}`);
    } catch { /* ignore */ }
  }, [address]);

  const computed = profileData
    ? isAdvancedUnlocked
      ? computeAdvancedProfile(profileData.name, profileData.birthday)
      : computeNumerologyProfile(profileData.name, profileData.birthday)
    : null;

  const creditsLeft = credits?.chatMessages ?? null;
  const creditsDepletedState = creditsLeft === 0;

  // ── Entry form ──────────────────────────────────────────────────────────────
  if (phase === 'entry') {
    return (
      <div className="numerology-chat">
        <div className="nc-entry-scroll">
          <div className="nc-hero">
            <img src="/logo-icon.png" alt="Numina AI Logo" className="nc-hero-logo" style={{ width: 120, height: 120, marginBottom: 20, borderRadius: 24, boxShadow: '0 8px 30px rgba(170, 59, 255, 0.3)' }} />
            <h1 className="nc-hero-title">Numina AI</h1>
            <p className="nc-hero-subtitle">
              Your onchain Pythagorean Oracle & 1:1 Numerology Consultant — based on{' '}
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
      </div>
    );
  }

  // ── Profile card ────────────────────────────────────────────────────────────
  if (phase === 'profile' && computed) {
    return (
      <div className="numerology-chat">
        <div className="nc-phase-header">
          <button className="nc-reset-btn" onClick={handleReset}>← New Reading</button>
          {credits && (
            <span className="nc-credits-badge">
              {creditsLeft} msg{creditsLeft !== 1 ? 's' : ''} left
            </span>
          )}
        </div>
        <div className="nc-scrollable">
          <NumerologyProfile
            profile={computed}
            walletAddress={address}
            onStartChat={handleStartChat}
            onUnlockAdvanced={() => {
              if (isAdvancedUnlocked) {
                setPhase('advanced');
              } else {
                advancedUnlock.initiate();
              }
            }}
            isAdvancedUnlocked={isAdvancedUnlocked}
          />
          {/* Show advanced content inline if already unlocked */}
          {isAdvancedUnlocked && 'personalYear' in computed && (
            <div className="nc-advanced-inline">
              <NumerologyAdvanced
                profile={computed as ReturnType<typeof computeAdvancedProfile>}
                unlockState={advancedUnlock}
                walletAddress={address}
              />
            </div>
          )}
          {/* Show paywall gate if not unlocked */}
          {!isAdvancedUnlocked && (
            <NumerologyAdvanced
              profile={computeAdvancedProfile(computed.name, computed.birthday)}
              unlockState={advancedUnlock}
              walletAddress={address}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Chat ────────────────────────────────────────────────────────────────────
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
        <div className="nc-bar-right">
          {credits && (
            <span className="nc-credits-badge">
              {creditsLeft} msg{creditsLeft !== 1 ? 's' : ''} left
            </span>
          )}
          <button className="nc-tab-btn" onClick={() => setPhase('profile')}>
            Profile
          </button>
          <button
            className="nc-reset-btn"
            onClick={handleReset}
          >
            ← New
          </button>
        </div>
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

      {/* Credits depleted banner */}
      {creditsDepletedState && !isLoading && (
        <div className="nc-credits-depleted">
          <span>No messages left today.</span>
          {address && (
            <button
              className="nc-buy-btn"
              onClick={buyCredits.initiate}
              disabled={buyCredits.isPaying || buyCredits.isConfirming || buyCredits.isVerifying}
            >
              {buyCredits.isPaying
                ? 'Confirm...'
                : buyCredits.isConfirming
                  ? 'Confirming...'
                  : buyCredits.isVerifying
                    ? 'Verifying...'
                    : 'Buy 20 msgs for $0.20 USDC'}
            </button>
          )}
          {buyCredits.error && (
            <span className="nc-buy-error">{buyCredits.error}</span>
          )}
        </div>
      )}

      <form className="nc-input-row" onSubmit={handleSend}>
        <input
          className="nc-chat-input"
          type="text"
          placeholder="Ask about your numbers, relationships, life path…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isLoading || creditsDepletedState}
        />
        <button
          className="nc-send-btn"
          type="submit"
          disabled={isLoading || !input.trim() || creditsDepletedState}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
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
  // Match **bold** first (takes priority), then *italic* (single stars, non-empty)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*[^*\s]\*|\*[^*\s]\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
