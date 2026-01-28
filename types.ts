
export enum CategoryType {
  VOCABULARY = 'VOCABULARY',
  GRAMMAR = 'GRAMMAR'
}

export interface SubCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface WordItem {
  french: string;
  english: string;
  example: string;
  exampleEnglish: string;
  pronunciation?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface UserProgress {
  stars: number;
  completedLessons: string[];
  dailyScores: { date: string; score: number }[];
}

export interface HistoryItem {
  date: string;
  category: string;
  subcategory: string;
  score: number;
}
