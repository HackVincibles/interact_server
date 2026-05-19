import User, { IUser } from '../models/User';

// XP rewards per action
export const XP_REWARDS = {
  INTERVIEW_COMPLETED: 30,
  CODE_SESSION: 15,
  GD_SESSION: 20,
  STREAK_BONUS: 5,       // extra XP per day of streak
  FIRST_INTERVIEW: 50,   // bonus badge XP
  PERFECT_SCORE: 25,     // score >= 90
};

// Level thresholds (cumulative XP needed)
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000];

export function calculateLevel(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

// Compute readiness score from recent feedback scores (0-100)
export function computeReadinessScore(recentScores: number[]): number {
  if (!recentScores.length) return 0;
  // Weighted average — more recent scores carry more weight
  const weights = recentScores.map((_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = recentScores.reduce((sum, score, i) => sum + score * weights[i], 0);
  return Math.round(weightedSum / totalWeight);
}

// Update streak and activity log for a user
export async function recordActivity(
  userId: string,
  type: 'interview' | 'code' | 'gd',
  extraXP: number = 0,
  recentFeedbackScores: number[] = []
): Promise<IUser | null> {
  const user = await User.findById(userId);
  if (!user) return null;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // ---- Streak logic ----
  if (user.lastActiveDate !== today) {
    if (user.lastActiveDate === yesterday) {
      user.streak += 1;
    } else {
      user.streak = 1; // reset streak
    }
    user.lastActiveDate = today;
    if (user.streak > user.longestStreak) {
      user.longestStreak = user.streak;
    }
  }

  // ---- XP ----
  let xpGain = extraXP + (user.streak > 1 ? XP_REWARDS.STREAK_BONUS : 0);
  user.xp += xpGain;
  user.level = calculateLevel(user.xp);

  // ---- Activity log (heatmap data) ----
  const todayEntry = user.activityLog.find(a => a.date === today);
  if (todayEntry) {
    todayEntry.count += 1;
  } else {
    user.activityLog.push({ date: today, count: 1 });
  }
  // Keep only last 365 days
  if (user.activityLog.length > 365) {
    user.activityLog = user.activityLog.slice(-365);
  }

  // ---- Type-specific counters ----
  if (type === 'interview') user.totalInterviews += 1;
  else if (type === 'code') user.totalCodeSessions += 1;
  else if (type === 'gd') user.totalGDSessions += 1;

  // ---- Weekly session count ----
  const now = new Date();
  if (!user.weeklyGoalResetDate || now > user.weeklyGoalResetDate) {
    // Reset weekly counter every Monday
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
    nextMonday.setHours(0, 0, 0, 0);
    user.weeklyGoalResetDate = nextMonday;
    user.weeklySessionsCompleted = 1;
  } else {
    user.weeklySessionsCompleted += 1;
  }

  // ---- Readiness score ----
  if (recentFeedbackScores.length > 0) {
    user.readinessScore = computeReadinessScore(recentFeedbackScores);
  }

  // ---- Badges ----
  const newBadges: string[] = [];
  if (user.totalInterviews === 1 && !user.badges.includes('first_interview')) {
    newBadges.push('first_interview');
  }
  if (user.streak >= 7 && !user.badges.includes('week_warrior')) {
    newBadges.push('week_warrior');
  }
  if (user.streak >= 30 && !user.badges.includes('month_master')) {
    newBadges.push('month_master');
  }
  if (user.xp >= 1000 && !user.badges.includes('xp_1000')) {
    newBadges.push('xp_1000');
  }
  if (user.totalCodeSessions >= 10 && !user.badges.includes('code_warrior')) {
    newBadges.push('code_warrior');
  }
  user.badges.push(...newBadges);

  await user.save();
  return user;
}
