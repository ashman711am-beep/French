
export enum CategoryType {
  VOCABULARY = 'VOCABULARY',
  GRAMMAR = 'GRAMMAR'
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
  feminine?: string; // New field for adjective learning
  english: string;
  example: string;
  exampleEnglish: string;
  imageUrl?: string;
  conjugations?: { subject: string; form: string }[];
  articleType?: string; // e.g., 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de la', 'de l\''
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

export type ViewMode = 'choice' | 'learning' | 'quiz';
