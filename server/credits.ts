const FREE_DAILY_MESSAGES = 5;
const REFERRAL_BONUS = 5;
const PAID_CREDITS_COUNT = 20;

export interface UserCredits {
  chatMessages: number;
  advancedUnlocked: boolean;
  lastResetDate: string;
  referredBy: string | null;
}

const store = new Map<string, UserCredits>();

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function getOrCreate(address: string): UserCredits {
  const key = address.toLowerCase();
  if (!store.has(key)) {
    store.set(key, {
      chatMessages: FREE_DAILY_MESSAGES,
      advancedUnlocked: false,
      lastResetDate: today(),
      referredBy: null,
    });
  }
  return store.get(key)!;
}

export function resetDailyIfNeeded(address: string): void {
  const credits = getOrCreate(address);
  const t = today();
  if (credits.lastResetDate !== t) {
    // Only reset up to FREE_DAILY_MESSAGES; preserve any paid credits above that
    credits.chatMessages = Math.max(credits.chatMessages, FREE_DAILY_MESSAGES);
    credits.lastResetDate = t;
  }
}

export function getCredits(address: string): UserCredits & { freeRemaining: number } {
  resetDailyIfNeeded(address);
  const credits = getOrCreate(address);
  return { ...credits, freeRemaining: Math.min(credits.chatMessages, FREE_DAILY_MESSAGES) };
}

export function deductChat(address: string): boolean {
  const credits = getOrCreate(address);
  if (credits.chatMessages <= 0) return false;
  credits.chatMessages--;
  return true;
}

export function addChatCredits(address: string, count: number = PAID_CREDITS_COUNT): void {
  const credits = getOrCreate(address);
  credits.chatMessages += count;
}

export function unlockAdvanced(address: string): void {
  getOrCreate(address).advancedUnlocked = true;
}

export function applyReferral(newAddress: string, referrerAddress: string): boolean {
  const newKey = newAddress.toLowerCase();
  const referrerKey = referrerAddress.toLowerCase();
  if (newKey === referrerKey) return false;

  const newCredits = getOrCreate(newKey);
  if (newCredits.referredBy) return false; // already used a referral

  newCredits.referredBy = referrerKey;
  newCredits.chatMessages += REFERRAL_BONUS;

  getOrCreate(referrerKey).chatMessages += REFERRAL_BONUS;

  return true;
}
