import advancedBookRaw from '../data/advancedNumerology.json';

const advancedBook = advancedBookRaw as {
  personalYears: Record<string, string>;
  pinnacles: Record<string, string>;
  challenges: Record<string, string>;
};
import type { AdvancedNumerologyProfile, PinnaclePhase } from '../lib/numerology';
import { formatRulingNumber } from '../lib/numerology';
import type { useAdvancedUnlock } from '../hooks/useAdvancedUnlock';

interface Props {
  profile: AdvancedNumerologyProfile;
  unlockState: ReturnType<typeof useAdvancedUnlock>;
  walletAddress?: string;
}

export function NumerologyAdvanced({ profile, unlockState, walletAddress }: Props) {
  const { isUnlocked, isPaying, isConfirming, isVerifying, initiate, error } = unlockState;

  if (!isUnlocked) {
    return (
      <div className="na-paywall">
        <h3 className="na-paywall-title">Advanced Numina AI Insights</h3>
        <p className="na-paywall-sub">
          Unlock your Personal Year, Life Pinnacles, and Core Challenges — deep
          interpretations drawn from the Pythagorean system.
        </p>

        <div className="na-preview-row">
          <PreviewCard
            title={`Personal Year ${profile.personalYear}`}
            snippet={getSnippet(advancedBook.personalYears[String(profile.personalYear)])}
          />
          <PreviewCard
            title={`Pinnacle ${formatRulingNumber(activePinnacle(profile).number)}`}
            snippet={getSnippet(advancedBook.pinnacles[String(activePinnacle(profile).number)])}
          />
          <PreviewCard
            title={`Challenge ${profile.challenges.main}`}
            snippet={getSnippet(advancedBook.challenges[String(profile.challenges.main)])}
          />
        </div>

        {!walletAddress ? (
          <p className="na-no-wallet">Connect your wallet to unlock advanced insights.</p>
        ) : (
          <button
            className="na-unlock-btn"
            onClick={initiate}
            disabled={isPaying || isConfirming || isVerifying}
          >
            {isPaying
              ? 'Confirm in MiniPay...'
              : isConfirming
                ? 'Confirming...'
                : isVerifying
                  ? 'Verifying payment...'
                  : 'Unlock All Advanced Insights — $0.50 USDC'}
          </button>
        )}

        {error && <p className="na-error">{error}</p>}
      </div>
    );
  }

  // ── Unlocked content ──────────────────────────────────────────────────────
  const py = profile.personalYear;
  const pyText = advancedBook.personalYears[String(py)] ?? '';

  const challenges = profile.challenges;
  const mainChallText = advancedBook.challenges[String(challenges.main)] ?? '';
  const firstChallText = advancedBook.challenges[String(challenges.first)] ?? '';
  const secondChallText = advancedBook.challenges[String(challenges.second)] ?? '';

  const currentAge = new Date().getFullYear() - parseInt(profile.birthday.split('-')[0], 10);

  return (
    <div className="na-content">
      {/* Personal Year */}
      <div className="na-section">
        <div className="na-section-header">
          <span className="na-section-number">{py}</span>
          <div>
            <h3 className="na-section-title">Personal Year {py}</h3>
            <p className="na-section-subtitle">Your current 9-year cycle theme</p>
          </div>
        </div>
        <p className="na-section-body">{pyText}</p>
      </div>

      {/* Pinnacles timeline */}
      <div className="na-section">
        <h3 className="na-section-title na-section-title--standalone">Life Pinnacles</h3>
        <p className="na-section-subtitle na-section-subtitle--standalone">
          Four major phases shaping your life journey
        </p>
        <PinnacleTimeline pinnacles={profile.pinnacles} currentAge={currentAge} />
        <div className="na-pinnacles">
          {Object.entries(profile.pinnacles).map(([key, phase]) => {
            const p = phase as PinnaclePhase;
            const isActive = currentAge >= p.ageStart && currentAge <= p.ageEnd;
            const label = key === 'fourth' ? 'Final' : key.charAt(0).toUpperCase() + key.slice(1);
            const ageRange =
              p.ageEnd === 999
                ? `Age ${p.ageStart}+`
                : `Ages ${p.ageStart}–${p.ageEnd}`;
            const text = advancedBook.pinnacles[String(p.number)] ?? '';
            return (
              <div key={key} className={`na-pinnacle-card ${isActive ? 'na-pinnacle-card--active' : ''}`}>
                <div className="na-pinnacle-header">
                  <span className="na-pinnacle-num">{formatRulingNumber(p.number)}</span>
                  <div>
                    <span className="na-pinnacle-label">
                      {label} Pinnacle {isActive && <span className="na-active-tag">Active</span>}
                    </span>
                    <span className="na-pinnacle-ages">{ageRange}</span>
                  </div>
                </div>
                <p className="na-pinnacle-body">{text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Challenges */}
      <div className="na-section">
        <h3 className="na-section-title na-section-title--standalone">Core Challenges</h3>
        <p className="na-section-subtitle na-section-subtitle--standalone">
          Growth lessons encoded in your birth date
        </p>
        <div className="na-challenges">
          <ChallengeCard
            number={challenges.main}
            label="Main Challenge"
            text={mainChallText}
            isMain
          />
          <ChallengeCard
            number={challenges.first}
            label="First Sub-Challenge"
            text={firstChallText}
          />
          <ChallengeCard
            number={challenges.second}
            label="Second Sub-Challenge"
            text={secondChallText}
          />
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function activePinnacle(profile: AdvancedNumerologyProfile): PinnaclePhase {
  const age = new Date().getFullYear() - parseInt(profile.birthday.split('-')[0], 10);
  const { first, second, third, fourth } = profile.pinnacles;
  if (age <= first.ageEnd) return first;
  if (age <= second.ageEnd) return second;
  if (age <= third.ageEnd) return third;
  return fourth;
}

function getSnippet(text: string | undefined): string {
  if (!text) return '';
  return text.slice(0, 120) + '…';
}

function PreviewCard({ title, snippet }: { title: string; snippet: string }) {
  return (
    <div className="na-preview-card">
      <span className="na-preview-title">{title}</span>
      <p className="na-preview-snippet na-preview-snippet--blurred">{snippet}</p>
    </div>
  );
}

// Segment colours for the 4 pinnacle phases
const SEG_COLORS = ['#aa3bff', '#818cf8', '#38bdf8', '#34d399'];

function PinnacleTimeline({
  pinnacles,
  currentAge,
}: {
  pinnacles: AdvancedNumerologyProfile['pinnacles'];
  currentAge: number;
}) {
  const phases = Object.values(pinnacles) as PinnaclePhase[];
  const maxAge = Math.max(phases[3].ageStart + 28, currentAge + 4, 78);

  const toPercent = (age: number) =>
    `${Math.min((age / maxAge) * 100, 100).toFixed(2)}%`;

  const nowPct = Math.min((currentAge / maxAge) * 100, 98);

  return (
    <div className="na-timeline">
      {/* Bar track */}
      <div className="na-timeline-track">
        {phases.map((p, i) => {
          const end = p.ageEnd === 999 ? maxAge : Math.min(p.ageEnd + 1, maxAge);
          const leftPct = (p.ageStart / maxAge) * 100;
          const widthPct = ((end - p.ageStart) / maxAge) * 100;
          const isActive = currentAge >= p.ageStart && (p.ageEnd === 999 || currentAge <= p.ageEnd);
          return (
            <div
              key={i}
              className={`na-timeline-segment${isActive ? ' na-timeline-segment--active' : ''}`}
              style={{
                left: `${leftPct.toFixed(2)}%`,
                width: `${widthPct.toFixed(2)}%`,
                '--seg-color': SEG_COLORS[i],
              } as React.CSSProperties}
            >
              <span className="na-timeline-seg-num" style={{ color: SEG_COLORS[i] }}>
                {formatRulingNumber(p.number)}
              </span>
            </div>
          );
        })}
        {/* Current-age line */}
        <div
          className="na-timeline-now"
          style={{ left: `${nowPct.toFixed(2)}%` }}
        >
          <div className="na-timeline-now-line" />
        </div>
      </div>

      {/* Age labels row */}
      <div className="na-timeline-labels" style={{ position: 'relative' }}>
        {phases.map((p, i) => (
          <span
            key={i}
            className="na-timeline-label"
            style={{ left: toPercent(p.ageStart) }}
          >
            {p.ageStart}
          </span>
        ))}
        <span className="na-timeline-label-end">{maxAge}+</span>
        {/* "now" age tag floated above */}
        <span
          className="na-timeline-now-tag"
          style={{ left: `${nowPct.toFixed(2)}%` }}
        >
          {currentAge}
        </span>
      </div>
    </div>
  );
}

function ChallengeCard({
  number,
  label,
  text,
  isMain = false,
}: {
  number: number;
  label: string;
  text: string;
  isMain?: boolean;
}) {
  return (
    <div className={`na-challenge-card ${isMain ? 'na-challenge-card--main' : ''}`}>
      <div className="na-challenge-header">
        <span className="na-challenge-num">{number}</span>
        <span className="na-challenge-label">{label}</span>
      </div>
      <p className="na-challenge-body">{text}</p>
    </div>
  );
}
