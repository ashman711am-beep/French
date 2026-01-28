
import React, { useState, useEffect } from 'react';
import { WordItem } from '../types';
import { seedContent, playPronunciation, getStoredContent, getWordInsight } from '../services/geminiService';

interface LearningViewProps {
  subId: string;
  category: 'VOCABULARY' | 'GRAMMAR';
  onComplete: () => void;
}

const LearningView: React.FC<LearningViewProps> = ({ subId, category, onComplete }) => {
  const [items, setItems] = useState<WordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<{ text: string, sources: string[] } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      let data = getStoredContent(subId);
      if (data.length === 0) {
        data = await seedContent(subId, category);
      }
      setItems(data);
      setLoading(false);
    };
    loadData();
  }, [subId, category]);

  useEffect(() => {
    setInsight(null);
  }, [currentIndex]);

  const fetchInsight = async () => {
    if (!items[currentIndex]) return;
    setInsightLoading(true);
    const result = await getWordInsight(items[currentIndex].french);
    setInsight(result);
    setInsightLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4"></div>
        <p className="text-xl font-bold text-gray-500">Preparing magical words... ✨</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center p-20">
        <p className="text-3xl font-black text-gray-400 mb-8">Oh no! We couldn't find any words for this category. 🥖</p>
        <button onClick={onComplete} className="bg-blue-600 text-white px-10 py-4 rounded-3xl font-black text-xl hover:bg-blue-700 shadow-xl">Back to Options</button>
      </div>
    );
  }

  const current = items[currentIndex];
  const progressPercent = ((currentIndex + 1) / items.length) * 100;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      {/* Progress Section */}
      <div className="mb-10 relative">
        <div className="flex items-center justify-between mb-3 px-2">
          <span className="text-sm font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
            <span className="text-xl">🗺️</span> Adventure Progress
          </span>
          <span className="font-black text-white bg-blue-500 px-4 py-1 rounded-full text-sm">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow-inner">
          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Card */}
        <div className={`${category === 'GRAMMAR' ? 'lg:col-span-6' : 'lg:col-span-8'} flex flex-col items-center order-2 lg:order-1`}>
          <div className="w-full bg-white rounded-5xl p-8 shadow-2xl border-4 border-blue-100 flex flex-col items-center">
            <div className="w-full mb-8 rounded-3xl overflow-hidden border-4 border-blue-50 shadow-md aspect-video relative">
              <img 
                src={current?.imageUrl || `https://picsum.photos/seed/${current?.french || 'default'}/800/600`} 
                alt={current?.french || 'French word'}
                className="w-full h-full object-cover"
              />
            </div>

            <h2 className="text-6xl font-black text-gray-800 mb-2 capitalize tracking-tighter">{current?.french}</h2>
            <p className="text-2xl font-bold text-blue-400 mb-8 uppercase tracking-widest">{current?.english}</p>
            
            <button 
              onClick={() => playPronunciation(current?.french)}
              className="bg-blue-600 text-white px-8 py-4 rounded-3xl font-bold text-xl shadow-lg hover:bg-blue-700 transition-transform hover:scale-105 mb-8 flex items-center gap-2"
            >
              <span>🔊</span> Listen
            </button>

            <div className="w-full bg-blue-50 rounded-3xl p-6 border-2 border-blue-100">
              <p className="text-sm font-black text-blue-400 uppercase mb-2">In a sentence:</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight mb-2">{current?.example}</p>
              <p className="text-lg text-gray-500">{current?.exampleEnglish}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Sidebar Section */}
        <div className={`${category === 'GRAMMAR' ? 'lg:col-span-6' : 'lg:col-span-4'} flex flex-col gap-6 order-1 lg:order-2`}>
          
          {/* Conjugation Sidebar for Grammar */}
          {category === 'GRAMMAR' && current.conjugations && (
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-purple-100">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🧩</span>
                <h3 className="text-2xl font-black text-purple-600">Conjugation Table</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {current.conjugations.map((conj, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-purple-50 p-4 rounded-2xl border border-purple-100 hover:bg-white transition-colors">
                    <span className={`text-lg font-black uppercase tracking-tighter ${
                      idx === 0 ? 'text-blue-500' : 
                      idx === 1 ? 'text-green-500' : 
                      idx === 2 ? 'text-red-500' : 
                      idx === 3 ? 'text-orange-500' : 
                      idx === 4 ? 'text-pink-500' : 'text-indigo-500'
                    }`}>
                      {conj.subject}
                    </span>
                    <span className="text-xl font-bold text-gray-800 tracking-tight">
                      {conj.form}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Smart Insight (Shown in both, or as secondary in Grammar) */}
          <div className={`bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-orange-100 ${category === 'GRAMMAR' ? 'flex-shrink-0' : 'flex-1'}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🔍</span>
              <h3 className="text-xl font-black text-gray-800">Smart Insight</h3>
            </div>
            
            {insightLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="animate-spin text-3xl mb-3">📡</div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Searching Google...</p>
              </div>
            ) : insight ? (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <p className="text-gray-700 font-medium leading-relaxed mb-6 italic">
                  "{insight.text}"
                </p>
                {insight.sources.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Sources from the web:</p>
                    <div className="flex flex-col gap-1">
                      {insight.sources.slice(0, 3).map((url, i) => (
                        <a 
                          key={i} 
                          href={url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] text-blue-500 hover:underline truncate"
                        >
                          🔗 {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 font-bold text-sm mb-6 leading-tight">Want to know more about this word?</p>
                <button 
                  onClick={fetchInsight}
                  className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-orange-600 transition-all hover:scale-105 active:scale-95"
                >
                  Discover More!
                </button>
              </div>
            )}
          </div>

          {!category || category === 'VOCABULARY' ? (
            <div className="bg-blue-600 text-white p-6 rounded-[2.5rem] shadow-xl text-center">
               <div className="text-4xl mb-2">⭐</div>
               <p className="font-black">Keep going!</p>
               <p className="text-xs font-bold opacity-80 uppercase">You're becoming a pro!</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-12 flex items-center justify-between gap-4">
        <button 
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="px-8 py-5 rounded-3xl font-black text-xl bg-white text-gray-400 border-4 border-gray-100 disabled:opacity-50"
        >
          ← Back
        </button>
        <button 
          onClick={() => currentIndex === items.length - 1 ? onComplete() : setCurrentIndex(i => i + 1)}
          className="flex-1 bg-blue-600 text-white py-6 rounded-3xl font-black text-2xl shadow-2xl hover:bg-blue-700 transition-transform active:scale-95 border-b-8 border-blue-800"
        >
          {currentIndex === items.length - 1 ? "Finish Adventure! 🏁" : "Next Discovery ➜"}
        </button>
      </div>
      
      <div className="mt-8 text-center font-bold text-gray-400">
        {category === 'GRAMMAR' ? "Mastering the 50 Most Common Verbs!" : "Powered by Smart AI Discovery"}
      </div>
    </div>
  );
};

export default LearningView;
