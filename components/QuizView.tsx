
import React, { useState, useEffect } from 'react';
import { QuizQuestion, Difficulty } from '../types';
import { generateQuiz, playPronunciation } from '../services/geminiService';

interface QuizViewProps {
  subId: string;
  category: 'VOCABULARY' | 'GRAMMAR';
  onPointEarned: (points: number) => void;
  onFinish: (sessionTotal: number) => void;
}

const QuizView: React.FC<QuizViewProps> = ({ subId, category, onPointEarned, onFinish }) => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!difficulty) return;

    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const data = await generateQuiz(subId, category, difficulty);
        setQuestions(data);
      } catch (err) {
        console.error("Failed to load quiz", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [subId, category, difficulty]);

  if (!difficulty) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h2 className="text-5xl font-black text-gray-800 mb-6">Choose Your Level! 🏆</h2>
        <p className="text-xl text-gray-500 mb-12 font-medium">Ready for a new set of questions?</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <button 
            onClick={() => setDifficulty('easy')}
            className="group bg-white border-4 border-green-200 hover:border-green-500 p-10 rounded-5xl transition-all hover:-translate-y-2 shadow-sm hover:shadow-2xl"
          >
            <div className="text-7xl mb-6 group-hover:scale-125 transition-transform">🐣</div>
            <h3 className="text-2xl font-black text-green-600 mb-2">Débutant</h3>
            <p className="text-gray-400 font-bold text-sm">Fresh easy words!</p>
          </button>

          <button 
            onClick={() => setDifficulty('medium')}
            className="group bg-white border-4 border-orange-200 hover:border-orange-500 p-10 rounded-5xl transition-all hover:-translate-y-2 shadow-sm hover:shadow-2xl"
          >
            <div className="text-7xl mb-6 group-hover:scale-125 transition-transform">🦊</div>
            <h3 className="text-2xl font-black text-orange-600 mb-2">Intermédiaire</h3>
            <p className="text-gray-400 font-bold text-sm">New challenges!</p>
          </button>

          <button 
            onClick={() => setDifficulty('hard')}
            className="group bg-white border-4 border-red-200 hover:border-red-500 p-10 rounded-5xl transition-all hover:-translate-y-2 shadow-sm hover:shadow-2xl"
          >
            <div className="text-7xl mb-6 group-hover:scale-125 transition-transform">🦁</div>
            <h3 className="text-2xl font-black text-red-600 mb-2">Expert</h3>
            <p className="text-gray-400 font-bold text-sm">Dynamic mastery!</p>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-bounce text-8xl mb-6">🎲</div>
        <p className="text-2xl font-black text-gray-600">Generating <span className="text-blue-600">Dynamic</span> Questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center p-20">
        <p className="text-3xl font-black text-gray-400 mb-8">Oops! The magic scroll is empty. 🥖</p>
        <button onClick={() => setDifficulty(null)} className="bg-blue-600 text-white px-10 py-4 rounded-3xl font-black text-xl hover:bg-blue-700 shadow-xl">Try Again!</button>
      </div>
    );
  }

  const current = questions[currentIndex];

  const handleOptionClick = (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);
    const correct = option === current.correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      const pointsMap = { easy: 10, medium: 20, hard: 35 };
      const earned = pointsMap[difficulty] || 10;
      setSessionScore(s => s + earned);
      onPointEarned(earned);
      playPronunciation(option);
    } else {
      playPronunciation(current.correctAnswer);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsCorrect(null);
    } else {
      onFinish(sessionScore);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8 px-4">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tight">Level: {difficulty.toUpperCase()} 🚀</h2>
          <p className="text-gray-500 font-black uppercase tracking-widest text-sm mt-1">Question {currentIndex + 1} of {questions.length}</p>
        </div>
        <div className="bg-yellow-400 text-white px-6 py-3 rounded-3xl font-black text-2xl shadow-lg border-4 border-white transform rotate-3 flex items-center gap-2">
          <span>⭐</span> <span>Session: {sessionScore}</span>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] p-8 sm:p-12 shadow-2xl border-4 border-purple-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-full -mr-24 -mt-24 opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-50 rounded-full -ml-16 -mb-16 opacity-50 pointer-events-none"></div>
        
        <div className="flex justify-between items-start mb-12 relative z-10 gap-4">
          <h3 className="text-3xl font-black text-gray-800 leading-tight flex-1">
            {current.question}
          </h3>
          <button 
            onClick={() => playPronunciation(current.question)}
            className="bg-blue-100 hover:bg-blue-200 p-3 rounded-2xl text-2xl shadow-sm transition-transform active:scale-90"
            title="Hear question"
          >🔊</button>
        </div>
        
        <div className="grid grid-cols-1 gap-5 relative z-10">
          {current.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleOptionClick(opt)}
              disabled={selectedOption !== null}
              className={`w-full text-left p-6 rounded-3xl text-xl font-bold transition-all border-b-8 active:border-b-0 group
                ${selectedOption === null ? 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-400 hover:-translate-y-1 !text-black' : ''}
                ${selectedOption === opt && isCorrect === true ? 'bg-green-100 border-green-500 !text-black scale-[1.02]' : ''}
                ${selectedOption === opt && isCorrect === false ? 'bg-red-100 border-red-500 !text-black' : ''}
                ${selectedOption !== opt && opt === current.correctAnswer && selectedOption !== null ? 'bg-green-50 border-green-500 !text-black' : ''}
                ${selectedOption !== null && selectedOption !== opt && opt !== current.correctAnswer ? 'opacity-30 grayscale bg-gray-100 !text-black' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>{opt}</span>
                  {selectedOption === null && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); playPronunciation(opt); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1.5 rounded-lg text-sm"
                    >🔊</button>
                  )}
                </div>
                {selectedOption === opt && (
                  <span className="text-3xl">{isCorrect ? '✅' : '❌'}</span>
                )}
                {selectedOption !== null && opt === current.correctAnswer && selectedOption !== opt && (
                  <span className="text-3xl animate-bounce">🌟</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {selectedOption && (
          <div className={`mt-12 p-10 rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-6 duration-700 shadow-inner cursor-pointer relative ${isCorrect ? 'bg-green-50 border-4 border-green-100 text-green-800' : 'bg-red-50 border-4 border-red-100 text-red-800'}`}
            onClick={() => playPronunciation(current.explanation)}
          >
            <p className="font-black text-3xl mb-3 flex items-center justify-between">
              <span>{isCorrect ? 'MAGNIFIQUE! 🎉' : 'Oups! 💡'}</span>
              <span className="text-sm opacity-40">🔊 Click to hear tip</span>
            </p>
            <p className="text-xl font-bold opacity-90 mb-8 leading-relaxed">{current.explanation}</p>
            <button 
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="w-full bg-purple-600 text-white py-6 rounded-3xl font-black text-2xl shadow-2xl hover:bg-purple-700 transition-all hover:scale-[1.03] active:scale-95 border-b-8 border-purple-800"
            >
              {currentIndex === questions.length - 1 ? 'Finish Adventure! 🏁' : 'Next Question ➜'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;
