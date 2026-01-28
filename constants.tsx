
import { CategoryType, SubCategory } from './types';

export const VOCAB_SUBCATEGORIES: SubCategory[] = [
  { id: 'animals', name: 'Les Animaux', icon: '🐾', description: 'Learn about your furry and feathered friends!', color: 'bg-orange-400' },
  { id: 'food', name: 'La Nourriture', icon: '🍕', description: 'Yummy words for food and drinks!', color: 'bg-red-400' },
  { id: 'colors', name: 'Les Couleurs', icon: '🎨', description: 'Paint the world with French colors!', color: 'bg-blue-400' },
  { id: 'family', name: 'La Famille', icon: '👨‍👩‍👧', description: 'Words for your loved ones.', color: 'bg-green-400' },
  { id: 'school', name: 'L\'École', icon: '🎒', description: 'Everything you find in your classroom.', color: 'bg-purple-400' },
  { id: 'body', name: 'Le Corps', icon: '👤', description: 'Learn parts of the body.', color: 'bg-pink-400' },
];

export const GRAMMAR_SUBCATEGORIES: SubCategory[] = [
  { id: 'present', name: 'Le Présent', icon: '⏳', description: 'Talking about what is happening now.', color: 'bg-indigo-400' },
  { id: 'past', name: 'Le Passé', icon: '⏪', description: 'Talking about things that already happened.', color: 'bg-teal-400' },
  { id: 'future', name: 'Le Futur', icon: '🚀', description: 'Talking about things that will happen.', color: 'bg-yellow-500' },
];
