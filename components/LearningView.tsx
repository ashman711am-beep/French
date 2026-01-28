
import React, { useState, useEffect } from 'react';
import { WordItem } from '../types';
import { generateLessons, playPronunciation } from '../services/geminiService';

interface LearningViewProps {
  subId: string;
  category: 'VOCABULARY' | 'GRAMMAR';
  onComplete: () => void;
}

const LearningView: React.FC<LearningViewProps> = ({ subId, category, onComplete }) => {
  const [items, setItems] = useState<WordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const data = await generateLessons(subId, category);
      setItems(data);
      setLoading(false);
    };
    fetch();
  }, [subId, category]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-xl font-medium text-gray-600">Magic birds are bringing your lesson... 🐦</p>
      </div>
    );
  }

  const current = items[currentIndex];

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-500" 
            style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
          ></div>
        </div>
        <div className="mt-2 text-right font-bold text-gray-400">
          {currentIndex + 1} / {items.length}
        </div>
      </div>

      <div className="bg-white rounded-4xl p-10 shadow-xl text-center relative border-4 border-blue-100">
        <div className="mb-6">
            <img 
                src={`https://picsum.photos/seed/${current.french}/400/250`} 
                alt={current.french}
                className="w-full h-48 object-cover rounded-2xl mb-8 border-4 border-white shadow-md"
            />
          <h2 className="text-5xl font-black text-blue-600 mb-2 capitalize">{current.french}</h2>
          <p className="text-2xl font-bold text-gray-400 mb-8 italic">{current.english}</p>
          
          <button 
            onClick={() => playPronunciation(current.french)}
            className="bg-blue-500 text-white p-4 rounded-full hover:bg-blue-600 transition-colors shadow-lg hover:scale-110 active:scale-95 mb-10"
          >
            🔊 Listen to Pronunciation
          </button>
        </div>

        <div className="bg-blue-50 rounded-2xl p-6 text-left border-2 border-blue-100">
          <h4 className="font-bold text-blue-700 mb-2">Example Sentence:</h4>
          <p className="text-xl font-medium text-gray-800 mb-1">{current.example}</p>
          <p className="text-gray-500">{current.exampleEnglish}</p>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button 
          onClick={handleNext}
          className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-2xl font-bold text-xl shadow-lg transition-all hover:-translate-y-1"
        >
          {currentIndex === items.length - 1 ? "Start Quiz! 🎯" : "Next Word ➜"}
        </button>
      </div>
    </div>
  );
};

export default LearningView;
