
import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../types';
import { generateQuiz } from '../services/geminiService';

interface QuizViewProps {
  subId: string;
  category: 'VOCABULARY' | 'GRAMMAR';
  onFinish: (score: number) => void;
}

const QuizView: React.FC<QuizViewProps> = ({ subId, category, onFinish }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const data = await generateQuiz(subId, category);
      setQuestions(data);
      setLoading(false);
    };
    fetch();
  }, [subId, category]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-bounce text-6xl mb-4">🎈</div>
        <p className="text-xl font-medium text-gray-600">Preparing your fun quiz...</p>
      </div>
    );
  }

  const current = questions[currentIndex];

  const handleOptionClick = (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);
    const correct = option === current.correctAnswer;
    setIsCorrect(correct);
    if (correct) setScore(s => s + 20);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsCorrect(null);
    } else {
      onFinish(score);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Quiz Time! 🚀</h2>
        <p className="text-gray-500">Show what you've learned</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-purple-100">
        <h3 className="text-2xl font-bold text-gray-700 mb-8">{current.question}</h3>
        
        <div className="space-y-4">
          {current.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleOptionClick(opt)}
              disabled={selectedOption !== null}
              className={`w-full text-left p-6 rounded-2xl text-xl font-bold transition-all border-b-4 active:border-b-0
                ${selectedOption === null ? 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-400' : ''}
                ${selectedOption === opt && isCorrect === true ? 'bg-green-100 border-green-500 text-green-700' : ''}
                ${selectedOption === opt && isCorrect === false ? 'bg-red-100 border-red-500 text-red-700' : ''}
                ${selectedOption !== opt && opt === current.correctAnswer && selectedOption !== null ? 'bg-green-100 border-green-500 text-green-700' : ''}
                ${selectedOption !== null && selectedOption !== opt && opt !== current.correctAnswer ? 'opacity-50 grayscale bg-gray-100' : ''}
              `}
            >
              {opt}
            </button>
          ))}
        </div>

        {selectedOption && (
          <div className={`mt-8 p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p className="font-black text-xl mb-2">{isCorrect ? 'BRAVO! 🎉' : 'Oups! Almost there! 💡'}</p>
            <p className="font-medium">{current.explanation}</p>
            <button 
              onClick={handleNext}
              className="mt-6 w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-xl shadow-md hover:bg-purple-700 transition-colors"
            >
              {currentIndex === questions.length - 1 ? 'Finish!' : 'Next Question ➜'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;
