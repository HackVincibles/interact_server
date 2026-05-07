import { Request, Response } from 'express';
import User from '../models/User';
import Interview from '../models/Interview';
import Feedback from '../models/Feedback';
import { recordActivity, XP_REWARDS } from '../utils/gamification';

/**
 * GET /api/stats/dashboard
 * Returns all real-time dashboard data for the authenticated user.
 */
export const getDashboardStats = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    // Fetch user (has XP, streak, readiness etc.)
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Fetch recent interviews
    const interviews = await Interview.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Fetch recent feedback for readiness score
    const interviewIds = interviews.map(i => i._id.toString());
    const feedbacks = await Feedback.find({ interviewId: { $in: interviewIds } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Last session info
    const lastInterview = interviews[0] || null;
    const lastFeedback = feedbacks[0] || null;

    // Sessions remaining for weekly goal
    const sessionsRemaining = Math.max(
      0,
      (user.weeklyGoal ?? 5) - (user.weeklySessionsCompleted ?? 0)
    );

    // Average score across recent feedbacks
    const avgScore = feedbacks.length
      ? Math.round(feedbacks.reduce((acc, f) => acc + (f.totalScore || 0), 0) / feedbacks.length)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        user: {
          xp: user.xp ?? 0,
          level: user.level ?? 1,
          streak: user.streak ?? 0,
          longestStreak: user.longestStreak ?? 0,
          badges: user.badges ?? [],
          activityLog: user.activityLog ?? [],
          readinessScore: user.readinessScore ?? 0,
          weeklyGoal: user.weeklyGoal ?? 5,
          weeklySessionsCompleted: user.weeklySessionsCompleted ?? 0,
          sessionsRemaining,
          onboardingCompleted: user.onboardingCompleted ?? false,
          targetRole: user.targetRole,
          targetCompanies: user.targetCompanies ?? [],
          experienceLevel: user.experienceLevel,
          totalInterviews: user.totalInterviews ?? 0,
          totalCodeSessions: user.totalCodeSessions ?? 0,
          totalGDSessions: user.totalGDSessions ?? 0,
        },
        lastSession: lastInterview ? {
          id: lastInterview._id,
          type: lastInterview.type,
          role: lastInterview.role,
          level: lastInterview.level,
          createdAt: lastInterview.createdAt,
          finalized: lastInterview.finalized,
          feedback: lastFeedback ? {
            totalScore: lastFeedback.totalScore,
            finalAssessment: lastFeedback.finalAssessment,
          } : null,
        } : null,
        recentFeedbacks: feedbacks.slice(0, 5).map(f => ({
          interviewId: f.interviewId,
          totalScore: f.totalScore,
          categoryScores: f.categoryScores,
          strengths: f.strengths,
          areasForImprovement: f.areasForImprovement,
          finalAssessment: f.finalAssessment,
          createdAt: f.createdAt,
        })),
        avgScore,
        totalSessions: (user.totalInterviews ?? 0) + (user.totalCodeSessions ?? 0) + (user.totalGDSessions ?? 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/stats/complete-session
 * Called after a user completes any kind of session to update XP, streak, readiness.
 */
export const completeSession = async (req: any, res: Response) => {
  try {
    const { type, score } = req.body as { type: 'interview' | 'code' | 'gd'; score?: number };
    const userId = req.user.id;

    if (!['interview', 'code', 'gd'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid session type' });
    }

    // Calculate XP gain
    let xpGain = XP_REWARDS.CODE_SESSION;
    if (type === 'interview') xpGain = XP_REWARDS.INTERVIEW_COMPLETED;
    if (type === 'gd') xpGain = XP_REWARDS.GD_SESSION;
    if (score !== undefined && score >= 90) xpGain += XP_REWARDS.PERFECT_SCORE;

    // Fetch recent interview scores for readiness computation
    const recentFeedbacks = await Feedback.find({ userId }).sort({ createdAt: -1 }).limit(5);
    const recentScores = recentFeedbacks.map(f => f.totalScore || 0);
    if (score !== undefined) recentScores.unshift(score);

    const updatedUser = await recordActivity(userId, type, xpGain, recentScores);

    return res.status(200).json({
      success: true,
      data: {
        xp: updatedUser?.xp,
        level: updatedUser?.level,
        streak: updatedUser?.streak,
        badges: updatedUser?.badges,
        readinessScore: updatedUser?.readinessScore,
        weeklySessionsCompleted: updatedUser?.weeklySessionsCompleted,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/stats/onboarding
 * Save onboarding data and mark as completed.
 */
export const completeOnboarding = async (req: any, res: Response) => {
  try {
    const { targetRole, targetCompanies, experienceLevel, weeklyGoal } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        targetRole,
        targetCompanies: targetCompanies || [],
        experienceLevel,
        weeklyGoal: weeklyGoal || 5,
        onboardingCompleted: true,
      },
      { new: true }
    );

    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/stats/leaderboard
 * Returns top users sorted by XP.
 */
export const getLeaderboard = async (req: any, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const topUsers = await User.find({})
      .sort({ xp: -1 })
      .limit(limit)
      .select('name avatar xp level streak badges totalInterviews')
      .lean();

    const leaderboard = topUsers.map((u, idx) => ({
      rank: idx + 1,
      id: u._id,
      name: u.name,
      avatar: u.avatar,
      xp: u.xp ?? 0,
      level: u.level ?? 1,
      streak: u.streak ?? 0,
      badges: u.badges ?? [],
      totalInterviews: u.totalInterviews ?? 0,
      isCurrentUser: u._id.toString() === currentUserId,
    }));

    // Also get current user's rank if not in top list
    let currentUserRank = null;
    if (currentUserId && !leaderboard.find(u => u.isCurrentUser)) {
      const currentUser = await User.findById(currentUserId).lean();
      if (currentUser) {
        const rank = (await User.countDocuments({ xp: { $gt: currentUser.xp ?? 0 } })) + 1;
        currentUserRank = {
          rank,
          name: currentUser.name,
          avatar: currentUser.avatar,
          xp: currentUser.xp ?? 0,
          level: currentUser.level ?? 1,
          streak: currentUser.streak ?? 0,
          isCurrentUser: true,
        };
      }
    }

    res.status(200).json({ success: true, data: { leaderboard, currentUserRank } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
