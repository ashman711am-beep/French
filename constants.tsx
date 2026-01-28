import { SubCategory } from './types';

export const VOCAB_SUBCATEGORIES: SubCategory[] = [
  { id: 'animals', name: 'Les Animaux', icon: '🐾', description: 'Learn about your furry and feathered friends!', color: 'bg-orange-400' },
  { id: 'food', name: 'La Nourriture', icon: '🍕', description: 'Yummy words for food and drinks!', color: 'bg-red-400' },
  { id: 'colors', name: 'Les Couleurs', icon: '🎨', description: 'Paint the world with French colors!', color: 'bg-blue-400' },
  { id: 'family', name: 'La Famille', icon: '👨‍👩‍👧', description: 'Words for your loved ones.', color: 'bg-green-400' },
  { id: 'school', name: 'L\'École', icon: '🎒', description: 'Everything you find in your classroom.', color: 'bg-purple-400' },
  { id: 'body', name: 'Le Corps', icon: '👤', description: 'Learn parts of the body.', color: 'bg-pink-400' },
  { id: 'home', name: 'À la Maison', icon: '🏠', description: 'Objects and rooms in your house.', color: 'bg-amber-400' },
  { id: 'directions', name: 'Les Directions', icon: '🧭', description: 'Left, right, and how to find your way!', color: 'bg-emerald-400' },
  { id: 'social', name: 'La Vie Sociale', icon: '🎈', description: 'Greetings and social situations.', color: 'bg-cyan-400' },
  { id: 'friends', name: 'Les Amis', icon: '🤝', description: 'Playing and sharing with friends.', color: 'bg-violet-400' },
  { id: 'hobbies', name: 'Les Loisirs', icon: '⚽', description: 'Sports, games, and fun things to do!', color: 'bg-rose-400' },
  { id: 'transport', name: 'Le Transport', icon: '🚲', description: 'Bikes, cars, and how we travel!', color: 'bg-sky-400' },
  { id: 'numbers', name: 'Les Nombres', icon: '🔢', description: 'Counting from zero to infinity!', color: 'bg-slate-400' },
  { id: 'places', name: 'Les Lieux', icon: '🏙️', description: 'Parks, cities, and the world around us.', color: 'bg-yellow-400' },
];

export const GRAMMAR_SUBCATEGORIES: SubCategory[] = [
  { id: 'present', name: 'Le Présent', icon: '⏳', description: 'Talking about what is happening now.', color: 'bg-indigo-400' },
  { id: 'past', name: 'Le Passé', icon: '⏪', description: 'Talking about things that already happened.', color: 'bg-teal-400' },
  { id: 'future', name: 'Le Futur', icon: '🚀', description: 'Talking about things that will happen.', color: 'bg-yellow-500' },
];
