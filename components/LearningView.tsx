
import React, { useState, useEffect } from 'react';
import { WordItem } from '../types';
import { seedContent, playPronunciation, getStoredContent, getFunFact, generateMagicImage } from '../services/geminiService';

interface LearningViewProps {
  subId: string;
  category: 'VOCABULARY' | 'GRAMMAR';
  onComplete: () => void;
}

const LearningView: React.FC<LearningViewProps> = ({ subId, category, onComplete }) => {
  const [items, setItems] = useState<WordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [funFact, setFunFact] = useState<{ text: string, sources: any[] } | null>(null);
  const [factLoading, setFactLoading] = useState(false);
  
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgSize, setImgSize] = useState<'1K' | '2K' | '4K'>('1K');

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
    setFunFact(null);
    setGeneratedImg(null);
  }, [currentIndex]);

  const fetchFact = async () => {
    setFactLoading(true);
    const fact = await getFunFact(items[currentIndex].french);
    setFunFact(fact);
    setFactLoading(false);
  };

  const createMagicImg = async () => {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Proceeding assuming selection was okay
    }

    setImgLoading(true);
    try {
      const url = await generateMagicImage(items[currentIndex].french, imgSize);
      setGeneratedImg(url);
    } catch (err: any) {
      if (err.message === 'KEY_RESET') {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
    } finally {
      setImgLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4"></div>
        <p className="text-xl font-bold text-gray-500">Preparing magical words... ✨</p>
      </div>
    );
  }

  const current = items[currentIndex];
  const progressPercent = ((currentIndex + 1) / items.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
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
        <div className="lg:col-span-7 bg-white rounded-5xl p-8 shadow-2xl border-4 border-blue-100 flex flex-col items-center">
          <div className="w-full mb-8 rounded-3xl overflow-hidden border-4 border-blue-50 shadow-md aspect-video relative">
            <img 
              src={generatedImg || current.imageUrl || `https://picsum.photos/seed/${current.french}/800/600`} 
              alt={current.french}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoading ? 'opacity-30' : 'opacity-100'}`}
            />
            {imgLoading && (
              <div className="absolute inset-0 flex flex-center flex-col items-center justify-center bg-white/50 backdrop-blur-sm">
                <div className="animate-spin text-5xl mb-2">🎨</div>
                <p className="font-black text-blue-600">Painting your {imgSize} masterpiece...</p>
              </div>
            )}
          </div>

          <h2 className="text-6xl font-black text-gray-800 mb-2 capitalize tracking-tighter">{current.french}</h2>
          <p className="text-2xl font-bold text-blue-400 mb-8 uppercase tracking-widest">{current.english}</p>
          
          <button 
            onClick={() => playPronunciation(current.french)}
            className="bg-blue-600 text-white px-8 py-4 rounded-3xl font-bold text-xl shadow-lg hover:bg-blue-700 transition-transform hover:scale-105 mb-8 flex items-center gap-2"
          >
            <span>🔊</span> Listen
          </button>

          <div className="w-full bg-blue-50 rounded-3xl p-6 border-2 border-blue-100">
            <p className="text-sm font-black text-blue-400 uppercase mb-2">In a sentence:</p>
            <p className="text-2xl font-bold text-gray-800 leading-tight mb-2">{current.example}</p>
            <p className="text-lg text-gray-500">{current.exampleEnglish}</p>
          </div>
        </div>

        {/* Sidebar Generators */}
        <div className="lg:col-span-5 space-y-6">
          {/* Magic Image Generator */}
          <div className="bg-white rounded-4xl p-6 shadow-xl border-4 border-purple-100">
            <h4 className="text-xl font-black text-purple-600 mb-4 flex items-center gap-2">
              <span>🪄</span> Magic Creator
            </h4>
            <div className="flex gap-2 mb-4">
              {['1K', '2K', '4K'].map(s => (
                <button 
                  key={s} 
                  onClick={() => setImgSize(s as any)}
                  className={`flex-1 py-2 rounded-xl font-black border-2 transition-all ${imgSize === s ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'border-gray-100 text-gray-400 hover:border-purple-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button 
              onClick={createMagicImg}
              disabled={imgLoading}
              className="w-full bg-purple-500 text-white py-4 rounded-2xl font-black text-lg shadow-md hover:bg-purple-600 disabled:opacity-50 transition-all active:scale-95"
            >
              Generate Image! ✨
            </button>
            <p className="text-[10px] text-gray-400 mt-2 text-center uppercase font-bold">Requires Paid Gemini API Key</p>
          </div>

          {/* Fun Fact Generator */}
          <div className="bg-white rounded-4xl p-6 shadow-xl border-4 border-green-100">
            <h4 className="text-xl font-black text-green-600 mb-4 flex items-center gap-2">
              <span>💡</span> Fun Fact Finder
            </h4>
            {factLoading ? (
              <div className="py-8 text-center animate-pulse text-green-600 font-bold">Searching Google... 🔍</div>
            ) : funFact ? (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <p className="text-gray-700 font-bold mb-4 leading-relaxed">{funFact.text}</p>
                {funFact.sources.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Sources</p>
                    {funFact.sources.map((s, idx) => (
                      <a key={idx} href={s.uri} target="_blank" rel="noreferrer" className="block text-xs text-blue-500 hover:underline truncate">
                        🔗 {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={fetchFact}
                className="w-full bg-green-500 text-white py-4 rounded-2xl font-black text-lg shadow-md hover:bg-green-600 transition-all active:scale-95"
              >
                Find Cool Fact! 🌍
              </button>
            )}
          </div>
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
        Discovering the Top 100 French Secrets...
      </div>
    </div>
  );
};

export default LearningView;
