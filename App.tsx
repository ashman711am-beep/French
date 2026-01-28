
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import CategoryGrid from './components/CategoryGrid';
import LearningView from './components/LearningView';
import QuizView from './components/QuizView';
import ParentDashboard from './components/ParentDashboard';
import { VOCAB_SUBCATEGORIES, GRAMMAR_SUBCATEGORIES } from './constants';
import { CategoryType, HistoryItem } from './types';

// Page Components
const Home = () => (
  <div className="p-8 text-center max-w-4xl mx-auto">
    <h1 className="text-5xl md:text-7xl font-black text-gray-800 mb-6 leading-tight">
      Learn French while having <span className="text-blue-600">FUN!</span> 🎨
    </h1>
    <p className="text-xl md:text-2xl text-gray-500 mb-12 max-w-2xl mx-auto leading-relaxed">
      Unlock magic words, earn shining stars, and become a French Master! Which path will you choose today?
    </p>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white rounded-4xl p-10 shadow-xl border-4 border-blue-100 hover:scale-105 transition-all">
        <div className="text-6xl mb-6">🦁</div>
        <h2 className="text-3xl font-black mb-4">Vocabulary</h2>
        <p className="text-gray-500 mb-8">Animals, food, colors and more!</p>
        <button onClick={() => window.location.hash = '#/vocabulary'} className="bg-blue-600 text-white w-full py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-blue-700">
          Let's Go!
        </button>
      </div>
      <div className="bg-white rounded-4xl p-10 shadow-xl border-4 border-purple-100 hover:scale-105 transition-all">
        <div className="text-6xl mb-6">🏗️</div>
        <h2 className="text-3xl font-black mb-4">Grammar</h2>
        <p className="text-gray-500 mb-8">Learn how to build cool sentences!</p>
        <button onClick={() => window.location.hash = '#/grammar'} className="bg-purple-600 text-white w-full py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-purple-700">
          Build Now!
        </button>
      </div>
    </div>
  </div>
);

const SubCategoryPage = ({ type, addPoints }: { type: CategoryType, addPoints: (p: number, sub: string, cat: string) => void }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'learning' | 'quiz'>('learning');

  const sub = [...VOCAB_SUBCATEGORIES, ...GRAMMAR_SUBCATEGORIES].find(s => s.id === id);

  if (!sub) return <div>Not found</div>;

  const handleFinishQuiz = (score: number) => {
    addPoints(score, sub.name, type);
    alert(`Well done! You earned ${score} stars! ⭐`);
    navigate('/');
  };

  return (
    <div className="p-6">
      <button 
        onClick={() => navigate(-1)} 
        className="mb-6 text-gray-500 font-bold hover:text-blue-600 flex items-center gap-2"
      >
        ← Go Back
      </button>
      
      <div className="text-center mb-10">
        <span className="text-6xl mb-4 block">{sub.icon}</span>
        <h1 className="text-4xl font-black text-gray-800">{sub.name}</h1>
      </div>

      {mode === 'learning' ? (
        <LearningView 
          subId={sub.id} 
          category={type} 
          onComplete={() => setMode('quiz')} 
        />
      ) : (
        <QuizView 
          subId={sub.id} 
          category={type} 
          onFinish={handleFinishQuiz} 
        />
      )}
    </div>
  );
};

const StatsPage = ({ stars }: { stars: number }) => (
    <div className="p-10 text-center">
        <div className="bg-white rounded-full w-48 h-48 flex items-center justify-center text-7xl mx-auto mb-8 shadow-2xl border-8 border-yellow-100 animate-pulse">
            ⭐
        </div>
        <h1 className="text-5xl font-black mb-4 text-gray-800">You have {stars} Stars!</h1>
        <p className="text-2xl text-gray-500">Keep learning to fill your trophy room!</p>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className={`p-8 rounded-3xl border-2 flex flex-col items-center gap-2 ${stars > (i * 50) ? 'bg-white border-yellow-400' : 'bg-gray-100 border-gray-200 opacity-50'}`}>
                    <span className="text-4xl">{stars > (i * 50) ? '🏆' : '🔒'}</span>
                    <span className="font-bold text-gray-400">Level {i}</span>
                </div>
            ))}
        </div>
    </div>
);

const App: React.FC = () => {
  const [stars, setStars] = useState(() => {
    const saved = localStorage.getItem('petits_stars');
    return saved ? parseInt(saved) : 0;
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('petits_history');
    return saved ? JSON.parse(saved) : [
        { date: '2023-10-24', category: 'VOCABULARY', subcategory: 'Les Animaux', score: 100 },
        { date: '2023-10-25', category: 'GRAMMAR', subcategory: 'Le Présent', score: 80 },
    ];
  });

  useEffect(() => {
    localStorage.setItem('petits_stars', stars.toString());
    localStorage.setItem('petits_history', JSON.stringify(history));
  }, [stars, history]);

  const addPoints = (points: number, subName: string, catName: string) => {
    setStars(prev => prev + points);
    const today = new Date().toISOString().split('T')[0];
    setHistory(prev => [...prev, {
      date: today,
      category: catName,
      subcategory: subName,
      score: points
    }]);
  };

  return (
    <Router>
      <div className="min-h-screen pb-20">
        <Navbar stars={stars} />
        <main className="container mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/vocabulary" element={
              <div className="p-8">
                <h2 className="text-4xl font-black text-gray-800 mb-8 px-6">Explore Vocabulary 🎒</h2>
                <CategoryGrid categories={VOCAB_SUBCATEGORIES} type={CategoryType.VOCABULARY} />
              </div>
            } />
            <Route path="/vocabulary/:id" element={<SubCategoryPage type={CategoryType.VOCABULARY} addPoints={addPoints} />} />
            <Route path="/grammar" element={
              <div className="p-8">
                <h2 className="text-4xl font-black text-gray-800 mb-8 px-6">Master Grammar 🏗️</h2>
                <CategoryGrid categories={GRAMMAR_SUBCATEGORIES} type={CategoryType.GRAMMAR} />
              </div>
            } />
            <Route path="/grammar/:id" element={<SubCategoryPage type={CategoryType.GRAMMAR} addPoints={addPoints} />} />
            <Route path="/parent" element={<ParentDashboard history={history} />} />
            <Route path="/stats" element={<StatsPage stars={stars} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
