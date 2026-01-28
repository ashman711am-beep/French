
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import CategoryGrid from './components/CategoryGrid';
import LearningView from './components/LearningView';
import QuizView from './components/QuizView';
import ParentDashboard from './components/ParentDashboard';
import { VOCAB_SUBCATEGORIES, GRAMMAR_SUBCATEGORIES } from './constants';
import { CategoryType, HistoryItem, ViewMode } from './types';

// Home Component with playful UI
const Home = () => (
  <div className="p-8 text-center max-w-5xl mx-auto">
    <div className="mb-12 animate-in fade-in zoom-in duration-700">
        <h1 className="text-6xl md:text-8xl font-black text-gray-800 mb-6 leading-none">
          Salut! <span className="text-blue-600">Apprendre</span> le <span className="text-red-500">Français</span> 🥖
        </h1>
        <p className="text-2xl text-gray-500 max-w-2xl mx-auto font-medium">
          The most fun way for kids to master 100s of French words and grammar secrets!
        </p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      <button onClick={() => window.location.hash = '#/vocabulary'} className="group bg-white rounded-5xl p-12 shadow-xl border-4 border-blue-100 hover:border-blue-400 hover:shadow-2xl transition-all hover:-translate-y-2 text-left relative overflow-hidden">
        <div className="text-7xl mb-6 transform group-hover:scale-125 transition-transform duration-500">🦊</div>
        <h2 className="text-4xl font-black mb-4 text-gray-800">Vocabulaire</h2>
        <p className="text-xl text-gray-500 mb-8">Master the Top 100 Animals, Foods, and more!</p>
        <div className="inline-block bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xl shadow-lg group-hover:bg-blue-700">
          Start Journey ➜
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
      </button>

      <button onClick={() => window.location.hash = '#/grammar'} className="group bg-white rounded-5xl p-12 shadow-xl border-4 border-purple-100 hover:border-purple-400 hover:shadow-2xl transition-all hover:-translate-y-2 text-left relative overflow-hidden">
        <div className="text-7xl mb-6 transform group-hover:scale-125 transition-transform duration-500">🧩</div>
        <h2 className="text-4xl font-black mb-4 text-gray-800">Grammaire</h2>
        <p className="text-xl text-gray-500 mb-8">Learn Past, Present & Future like a pro!</p>
        <div className="inline-block bg-purple-600 text-white px-8 py-4 rounded-2xl font-black text-xl shadow-lg group-hover:bg-purple-700">
          Master Tenses ➜
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
      </button>
    </div>
  </div>
);

const SubCategoryPage = ({ type, stats, addLivePoints, recordHistory }: { 
  type: CategoryType, 
  stats: Record<string, number>,
  addLivePoints: (p: number) => void,
  recordHistory: (p: number, sub: string, cat: string) => void 
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<ViewMode>('choice');

  const sub = [...VOCAB_SUBCATEGORIES, ...GRAMMAR_SUBCATEGORIES].find(s => s.id === id);

  if (!sub) return <div className="p-20 text-center text-3xl font-bold">Oh no! Category not found. 🎈</div>;

  const points = stats[sub.name] || 0;
  const powerRating = Math.min(Math.round((points / 500) * 100), 100);

  const handleFinishQuiz = (sessionTotal: number) => {
    recordHistory(sessionTotal, sub.name, type);
    navigate('/stats');
  };

  if (mode === 'choice') {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <button onClick={() => navigate(-1)} className="mb-10 text-gray-400 font-bold hover:text-blue-600 flex items-center gap-2 text-lg">
          ← Back to Map
        </button>
        
        <div className="mb-12">
          <div className={`${sub.color} w-32 h-32 rounded-4xl flex items-center justify-center text-6xl mx-auto mb-6 shadow-xl animate-bounce`}>
            {sub.icon}
          </div>
          <h1 className="text-5xl font-black text-gray-800 mb-2">{sub.name}</h1>
          <p className="text-xl text-gray-500 font-medium mb-6">{sub.description}</p>
          
          {/* Progress Summary */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 max-w-md mx-auto">
             <div className="flex justify-between items-center mb-2">
                <span className="font-black text-gray-400 uppercase tracking-tighter">Your Mastery</span>
                <span className="font-black text-blue-600">{powerRating}% Power</span>
             </div>
             <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full ${sub.color}`} 
                  style={{ width: `${powerRating}%` }}
                ></div>
             </div>
             <p className="text-sm font-bold text-gray-400">Total Points: ⭐ {points}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <button 
            onClick={() => setMode('learning')}
            className="bg-white border-4 border-blue-400 rounded-5xl p-10 shadow-xl hover:bg-blue-50 transition-all hover:scale-105"
          >
            <div className="text-5xl mb-4">📖</div>
            <h3 className="text-3xl font-black text-blue-600 mb-2">Learn</h3>
            <p className="text-gray-500 font-bold">Look at the Top 100 items!</p>
          </button>

          <button 
            onClick={() => setMode('quiz')}
            className="bg-white border-4 border-green-400 rounded-5xl p-10 shadow-xl hover:bg-green-50 transition-all hover:scale-105"
          >
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-3xl font-black text-green-600 mb-2">Quiz</h3>
            <p className="text-gray-500 font-bold">Test your skills & earn stars</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <button 
        onClick={() => setMode('choice')} 
        className="mb-6 text-gray-400 font-bold hover:text-blue-600 flex items-center gap-2"
      >
        ← Back to Options
      </button>

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
          onPointEarned={addLivePoints}
          onFinish={handleFinishQuiz} 
        />
      )}
    </div>
  );
};

const StatsPage = ({ stars }: { stars: number }) => {
    const navigate = useNavigate();
    return (
        <div className="p-10 text-center">
            <div className="bg-white rounded-full w-48 h-48 flex items-center justify-center text-7xl mx-auto mb-8 shadow-2xl border-8 border-yellow-100 animate-pulse">
                ⭐
            </div>
            <h1 className="text-5xl font-black mb-4 text-gray-800">You have {stars} Stars!</h1>
            <p className="text-2xl text-gray-500 mb-10">You're doing amazing! Every correct answer brings more sparkle!</p>
            
            <button 
                onClick={() => navigate('/')}
                className="bg-blue-600 text-white px-12 py-5 rounded-3xl font-black text-2xl shadow-xl hover:bg-blue-700 transition-all"
            >
                Continue Learning! 🚀
            </button>

            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[50, 100, 250, 500, 1000, 2500, 5000, 10000].map(goal => (
                    <div key={goal} className={`p-8 rounded-4xl border-4 transition-all ${stars >= goal ? 'bg-white border-yellow-400 scale-105 shadow-lg' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                        <div className="text-5xl mb-4">{stars >= goal ? '🏆' : '🔒'}</div>
                        <div className="font-black text-gray-800 text-xl">{goal} Stars</div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">
                            {stars >= goal ? 'Unlocked!' : 'Locked'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [stars, setStars] = useState(() => {
    const saved = localStorage.getItem('petits_stars');
    return saved ? parseInt(saved) : 0;
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('petits_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Calculate stats by subcategory for power ratings
  const subcategoryStats = useMemo(() => {
    return history.reduce((acc: Record<string, number>, item) => {
      acc[item.subcategory] = (acc[item.subcategory] || 0) + item.score;
      return acc;
    }, {});
  }, [history]);

  useEffect(() => {
    localStorage.setItem('petits_stars', stars.toString());
    localStorage.setItem('petits_history', JSON.stringify(history));
  }, [stars, history]);

  const addLivePoints = (points: number) => {
    setStars(prev => prev + points);
  };

  const recordHistory = (points: number, subName: string, catName: string) => {
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
      <div className="min-h-screen pb-20 bg-[#f8fafc]">
        <Navbar stars={stars} />
        <main className="container mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/vocabulary" element={
              <div className="p-8">
                <div className="px-6 mb-12">
                    <h2 className="text-5xl font-black text-gray-800 mb-4">Vocabulary World 🎒</h2>
                    <p className="text-xl text-gray-500 font-medium">Pick a topic to start your 100-word challenge!</p>
                </div>
                <CategoryGrid categories={VOCAB_SUBCATEGORIES} type={CategoryType.VOCABULARY} stats={subcategoryStats} />
              </div>
            } />
            <Route path="/vocabulary/:id" element={<SubCategoryPage type={CategoryType.VOCABULARY} stats={subcategoryStats} addLivePoints={addLivePoints} recordHistory={recordHistory} />} />
            <Route path="/grammar" element={
              <div className="p-8">
                <div className="px-6 mb-12">
                    <h2 className="text-5xl font-black text-gray-800 mb-4">Grammar Lab 🧪</h2>
                    <p className="text-xl text-gray-500 font-medium">Master the tenses and build perfect sentences!</p>
                </div>
                <CategoryGrid categories={GRAMMAR_SUBCATEGORIES} type={CategoryType.GRAMMAR} stats={subcategoryStats} />
              </div>
            } />
            <Route path="/grammar/:id" element={<SubCategoryPage type={CategoryType.GRAMMAR} stats={subcategoryStats} addLivePoints={addLivePoints} recordHistory={recordHistory} />} />
            <Route path="/parent" element={<ParentDashboard history={history} />} />
            <Route path="/stats" element={<StatsPage stars={stars} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
