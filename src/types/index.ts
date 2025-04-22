export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
}

export interface Question {
  id: string;
  text: string;
  topic: string;
  difficulty: number;
}

export interface UserProgress {
  questionsAnswered: number;
  correctAnswers: number;
  timeSpent: number;
}

export interface FeedbackData {
  sessionId: string;
  rating: number;
  comments: string;
}
