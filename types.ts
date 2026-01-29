
export enum CategoryType {
  VOCABULARY = 'VOCABULARY',
  GRAMMAR = 'GRAMMAR',
  SPEAKING = 'SPEAKING'
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SubCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface WordItem {
  french: string;
  feminine?: string;
  english: string;
  example: string;
  exampleEnglish: string;
  imageUrl?: string;
  conjugations?: { subject: string; form: string }[];
  articleType?: string;
  isOverview?: boolean;
  multipleExamples?: { text: string; translation: string }[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface HistoryItem {
  date: string;
  category: string;
  subcategory: string;
  score: number;
  powerRating?: number;
}

export type ViewMode = 'choice' | 'learning' | 'quiz' | 'speaking' | 'pronunciation';
