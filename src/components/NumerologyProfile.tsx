import { useCallback } from 'react';
import type { NumerologyProfile as Profile } from '../lib/numerology';
import { formatRulingNumber, BIRTH_CHART_PLANES } from '../lib/numerology';
import {
  RULING_ESSENCES,
  SOUL_URGE_ESSENCES,
  OUTER_EXPRESSION_ESSENCES,
} from '../lib/numerologyEssences';
import { generateReferralLink } from '../lib/referral';
import { DEEPLINKS } from '../lib/minipay';

interface Props {
  profile: Profile;
  walletAddress?: string;
  onStartChat: () => void;
  onUnlockAdvanced: () => void;
  isAdvancedUnlocked: boolean;
}

// Birth chart grid positions displayed top→bottom (Mind / Soul / Physical)
const GRID_ROWS = [
  BIRTH_CHART_PLANES.mind,     // 3, 6, 9 — top row
  BIRTH_CHART_PLANES.soul,     // 2, 5, 8 — middle row
  BIRTH_CHART_PLANES.physical, // 1, 4, 7 — bottom row
];
const ROW_LABELS = ['Mind', 'Soul', 'Physical'];

export function NumerologyProfile({ profile, walletAddress, onStartChat, onUnlockAdvanced, isAdvancedUnlocked }: Props) {
  const ruling = formatRulingNumber(profile.rulingNumber);
  const day    = formatRulingNumber(profile.dayNumber);
  const soul   = formatRulingNumber(profile.soulUrgeNumber);
  const outer  = formatRulingNumber(profile.outerExpressionNumber);

  const rulingEssence = RULING_ESSENCES[ruling]  ?? 'A unique and powerful vibration.';
  const soulEssence   = SOUL_URGE_ESSENCES[soul]  ?? '';
  const outerEssence  = OUTER_EXPRESSION_ESSENCES[outer] ?? '';

  const handleCopyLink = useCallback(() => {
    if (!walletAddress) return;
    const link = generateReferralLink(walletAddress);
    navigator.clipboard.writeText(link).catch(() => undefined);
  }, [walletAddress]);

  const handleMiniPayInvite = useCallback(() => {
    window.open(DEEPLINKS.inviteFriends(), '_blank', 'noopener');
  }, []);

  return (
    <div className="np-card">
      {/* ── Header ── */}
      <div className="np-header">
        <div className="np-ruling-badge">{ruling}</div>
        <div className="np-header-text">
          <h2 className="np-name">{profile.name}</h2>
          <p className="np-birthday">{profile.birthday}</p>
          <p className="np-ruling-essence">{rulingEssence}</p>
        </div>
      </div>

      {/* ── Numbers row ── */}
      <div className="np-numbers-row">
        <NumberCard label="Day Number" value={day} essence={`Day of birth resonance`} />
        <NumberCard label="Soul Urge" value={soul} essence={soulEssence} />
        <NumberCard label="Outer Expression" value={outer} essence={outerEssence} />
      </div>

      {/* ── Birth chart grid ── */}
      <div className="np-section">
        <h3 className="np-section-title">Birth Chart</h3>
        <div className="np-chart-grid">
          {GRID_ROWS.map((row, ri) => (
            <div key={ri} className="np-chart-row">
              <span className="np-chart-row-label">{ROW_LABELS[ri]}</span>
              {row.map(pos => {
                const count = profile.birthChart.grid[pos] ?? 0;
                const isPresent = count > 0;
                return (
                  <div
                    key={pos}
                    className={`np-chart-cell ${isPresent ? 'np-chart-cell--present' : 'np-chart-cell--missing'}`}
                    title={isPresent ? `${pos} appears ${count}x` : `${pos} is missing`}
                  >
                    <span className="np-chart-num">{pos}</span>
                    {isPresent && count > 1 && (
                      <span className="np-chart-count">×{count}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {profile.birthChart.missing.length > 0 && (
          <p className="np-chart-missing-note">
            Missing: {profile.birthChart.missing.join(', ')} — areas for soul growth
          </p>
        )}
      </div>

      {/* ── Advanced teaser (locked) ── */}
      {!isAdvancedUnlocked && (
        <div className="np-section">
          <h3 className="np-section-title">Advanced Insights</h3>
          <div className="np-teaser-row">
            <TeaserCard title="Personal Year" hint="Your current cycle theme" />
            <TeaserCard title="Life Pinnacles" hint="4 major life phases" />
            <TeaserCard title="Challenges" hint="Growth areas & lessons" />
          </div>
        </div>
      )}

      {/* ── CTAs ── */}
      <div className="np-ctas">
        {!isAdvancedUnlocked && (
          <button className="np-btn np-btn--primary" onClick={onUnlockAdvanced}>
            Unlock Advanced Insights — $0.50 USDC
          </button>
        )}
        {isAdvancedUnlocked && (
          <div className="np-unlocked-badge">Advanced insights unlocked</div>
        )}
        <button className="np-btn np-btn--secondary" onClick={onStartChat}>
          Chat About My Numbers
        </button>
      </div>

      {/* ── Share row ── */}
      {walletAddress && (
        <div className="np-share-row">
          <span className="np-share-label">
            Invite a friend — both get 5 free messages
          </span>
          <div className="np-share-btns">
            <button className="np-share-btn" onClick={handleCopyLink}>
              Copy Link
            </button>
            <button className="np-share-btn np-share-btn--minipay" onClick={handleMiniPayInvite}>
              Invite via MiniPay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberCard({ label, value, essence }: { label: string; value: string; essence: string }) {
  return (
    <div className="np-num-card">
      <span className="np-num-label">{label}</span>
      <span className="np-num-value">{value}</span>
      <span className="np-num-essence">{essence}</span>
    </div>
  );
}

function TeaserCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="np-teaser-card">
      <span className="np-teaser-lock">🔒</span>
      <span className="np-teaser-title">{title}</span>
      <span className="np-teaser-hint">{hint}</span>
    </div>
  );
}
