import { apiClient } from "./fetchClient";

export const aiAssistantApi = {
  chat: (message: string, sessionContext?: { role: string; content: string }[]) =>
    apiClient.post<{ response: string; tokensUsed: number }>(`/ai/chat`, { message, sessionContext }),
  generateResume: (profile: Record<string, unknown>, achievements: string[], targetRole?: string) =>
    apiClient.post(`/ai/resume/generate`, { profile, achievements, targetRole }),
  improveResume: (resumeText: string, targetRole?: string) =>
    apiClient.post<{ suggestions: string; tokensUsed: number }>(`/ai/resume/improve`, { resumeText, targetRole }),
  careerGuidance: (question: string, interestArea?: string) =>
    apiClient.post<{ response: string; tokensUsed: number }>(`/ai/career-guidance`, { question, interestArea }),
  generateStudyPlan: (goal: string, currentLevel?: string, hoursPerWeek = 5) =>
    apiClient.post(`/ai/study-plan`, { goal, currentLevel, hoursPerWeek }),
  strengthWeakness: () =>
    apiClient.get<{ strengths: string[]; weaknesses: string[]; recommendation: string; careerReadinessScore: number }>(`/ai/strength-weakness`),
};
