
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordItem } from '../types';
import { seedContent, playPronunciation, getStoredContent, generateEducationalImage, getStoredImage, saveStoredImage } from '../services/geminiService';

interface LearningViewProps {
  subId: string;
  category: 'VOCABULARY' | 'GRAMMAR';
  onComplete: () => void;
}

const ARTICLE_GROUPS = [
  { id: 'le', label: 'Le', color: 'bg-blue-500', icon: '♂️' },
  { id: 'la', label: 'La', color: 'bg-pink-500', icon: '♀️' },
  { id: 'les', label: 'Les', color: 'bg-purple-500', icon: '👥' },
  { id: 'un', label: 'Un', color: 'bg-indigo-500', icon: '☝️' },
  { id: 'une', label: 'Une', color: 'bg-rose-500', icon: '☝️' },
  { id: 'des', label: 'Des', color: 'bg-emerald-500', icon: '🔢' },
  { id: 'du', label: 'Du', color: 'bg-orange-500', icon: '🥛' },
  { id: 'de la', label: 'De la', color: 'bg-amber-500', icon: '🍰' },
  { id: 'de l\'', label: 'De l\'', color: 'bg-teal-500', icon: '💧' },
];

const ADJECTIVE_GROUPS = [
  { id: 'colors_appearance', label: 'Appearance', color: 'bg-rose-500', icon: '🎨' },
  { id: 'size_quantity', label: 'Size', color: 'bg-blue-600', icon: '📐' },
  { id: 'feelings_emotions', label: 'Feelings', color: 'bg-yellow-500', icon: '😊' },
  { id: 'personality_character', label: 'Personality', color: 'bg-purple-600', icon: '🧠' },
  { id: 'tastes_senses', label: 'Senses', color: 'bg-green-500', icon: '👅' },
];

const LearningView: React.FC<LearningViewProps> = ({ subId, category, onComplete }) => {
  const [items, setItems] = useState<WordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSubTopic, setSelectedSubTopic] = useState<string | null>(null);
  
  // AI Image States
  const [generatingImage, setGeneratingImage] = useState(false);
  const [customImages, setCustomImages] = useState<Record<string, string>>({});
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [preparingAll, setPreparingAll] = useState(false);
  const [prepProgress, setPrepProgress] = useState({ current: 0, total: 0 });

  const isArticles = subId === 'articles';
  const isAdjectives = subId === 'adjectives';
  const stopPrepRef = useRef(false);

  // Load word items once and persist
  useEffect(() => {
    if ((isArticles || isAdjectives) && !selectedSubTopic) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      const storageId = (isArticles || isAdjectives) ? `${subId}_${selectedSubTopic}` : subId;
      let data = getStoredContent(storageId);
      if (data.length === 0) {
        data = await seedContent(subId, category, selectedSubTopic || undefined);
      }
      setItems(data);
      setCurrentIndex(0);
      setLoading(false);
    };
    loadData();
  }, [subId, category, selectedSubTopic, isArticles, isAdjectives]);

  const handleGenerateImage = useCallback(async (index: number, force = false) => {
    const current = items[index];
    if (!current) return;

    const cached = await getStoredImage(current.french);
    if (cached && !force) {
      setCustomImages(prev => ({ ...prev, [current.french]: cached }));
      return;
    }

    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setNeedsApiKey(true);
        return;
      }
      
      setNeedsApiKey(false);
      if (index === currentIndex) setGeneratingImage(true);
      
      const result = await generateEducationalImage(current.french, current.english);
      if (result) {
        await saveStoredImage(current.french, result);
        setCustomImages(prev => ({ ...prev, [current.french]: result }));
      }
    } catch (error: any) {
      if (error.message === "API_KEY_RESET") {
        setNeedsApiKey(true);
      }
    } finally {
      if (index === currentIndex) setGeneratingImage(false);
    }
  }, [items, currentIndex]);

  // "Pre-Prepare All" Batch Logic
  const handlePrepareAll = async () => {
    if (items.length === 0 || preparingAll) return;
    
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
      const retryKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!retryKey) return;
    }

    setPreparingAll(true);
    stopPrepRef.current = false;
    let count = 0;
    
    for (let i = 0; i < items.length; i++) {
      if (stopPrepRef.current) break;
      const cached = await getStoredImage(items[i].french);
      if (!cached) {
        setPrepProgress({ current: i + 1, total: items.length });
        await handleGenerateImage(i);
        // Small delay to avoid hammering the API too hard in one burst
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    setPreparingAll(false);
  };

  // Automatic Image Management Effect (Load Current + Pre-load Next)
  useEffect(() => {
    if (items.length > 0 && !loading) {
      const current = items[currentIndex];
      getStoredImage(current.french).then(cached => {
        if (cached) {
          setCustomImages(prev => ({ ...prev, [current.french]: cached }));
        } else {
          handleGenerateImage(currentIndex);
        }
      });

      // Background pre-load next item
      if (currentIndex + 1 < items.length) {
        const next = items[currentIndex + 1];
        getStoredImage(next.french).then(cached => {
          if (!cached) handleGenerateImage(currentIndex + 1);
        });
      }
    }
  }, [currentIndex, items, loading, handleGenerateImage]);

  const handleOpenKeySelector = async () => {
    await (window as any).aistudio.openSelectKey();
    setNeedsApiKey(false);
    handleGenerateImage(currentIndex);
  };

  if ((isArticles || isAdjectives) && !selectedSubTopic) {
    const groups = isArticles ? ARTICLE_GROUPS : ADJECTIVE_GROUPS;
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-8 animate-in fade-in duration-500">
        <h2 className="text-4xl font-black text-gray-800 mb-2 text-center">
          {isArticles ? 'Article Windows 🔡' : 'Adjective Explorer 🪄'}
        </h2>
        <p className="text-xl text-gray-500 text-center mb-10">
          Choose a "Window" to explore {isArticles ? '50' : '20'} examples! Total {isAdjectives ? '100' : '450'} for this topic.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedSubTopic(group.id)}
              className="group bg-white p-8 rounded-[2.5rem] shadow-lg border-4 border-transparent hover:border-blue-400 hover:shadow-2xl transition-all transform hover:-translate-y-2 flex flex-col items-center"
            >
              <div className={`${group.color} w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-4 text-white shadow-inner group-hover:rotate-12 transition-transform`}>
                {group.icon}
              </div>
              <span className="text-2xl font-black text-gray-800 text-center">{group.label}</span>
              <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">{isArticles ? '50' : '20'} Examples Inside</p>
            </button>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <button onClick={onComplete} className="text-gray-400 font-bold hover:text-blue-500 transition-colors">
            ← Back to Topic Choice
          </button>
        </div>
      </div>
    );
  }

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
        <button onClick={() => (isArticles || isAdjectives) ? setSelectedSubTopic(null) : onComplete()} className="bg-blue-600 text-white px-10 py-4 rounded-3xl font-black text-xl hover:bg-blue-700 shadow-xl">Back</button>
      </div>
    );
  }

  const current = items[currentIndex];
  const progressPercent = ((currentIndex + 1) / items.length) * 100;
  const hasConjugations = current.conjugations && current.conjugations.length > 0;
  
  const displayImage = customImages[current.french] || `https://picsum.photos/seed/${current?.french || 'default'}/800/600`;

  const getSubjectStyles = (idx: number) => {
    const styles = [
      { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: '👤' },
      { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: '👤' },
      { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: '👥' },
      { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', icon: '👫' },
      { text: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', icon: '👪' },
      { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', icon: '👫' },
    ];
    return styles[idx % styles.length];
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 animate-in slide-in-from-right-10 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {(isArticles || isAdjectives) ? (
          <button 
            onClick={() => { stopPrepRef.current = true; setSelectedSubTopic(null); }}
            className="flex items-center gap-2 text-blue-500 font-black hover:underline group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">🏘️</span> Back to {isArticles ? 'Article' : 'Adjective'} Windows
          </button>
        ) : <div />}

        <button 
          onClick={handlePrepareAll}
          disabled={preparingAll}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-md ${preparingAll ? 'bg-orange-100 text-orange-600 border-2 border-orange-200' : 'bg-white text-blue-600 border-2 border-blue-100 hover:border-blue-400'}`}
        >
          {preparingAll ? (
            <>
              <span className="animate-spin">🌀</span> Preparing Illustration {prepProgress.current}/{prepProgress.total}...
            </>
          ) : (
            <>
              <span>🪄</span> Prepare All Illustrations
            </>
          )}
        </button>
      </div>

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
        <div className={`${(category === 'GRAMMAR' && hasConjugations) ? 'lg:col-span-6' : 'lg:col-span-8'} flex flex-col items-center order-2 lg:order-1`}>
          <div className="w-full bg-white rounded-5xl p-8 shadow-2xl border-4 border-blue-100 flex flex-col items-center">
            <div className="w-full mb-8 rounded-3xl overflow-hidden border-4 border-blue-50 shadow-md aspect-video relative group/img">
              {generatingImage ? (
                <div className="absolute inset-0 bg-blue-50/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-in fade-in">
                  <div className="text-5xl animate-bounce mb-4">🪄</div>
                  <p className="text-blue-600 font-black text-center px-4">Creating your educational illustration...</p>
                </div>
              ) : needsApiKey ? (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-10 p-6 text-center">
                  <div className="text-5xl mb-4">🖼️</div>
                  <h4 className="text-xl font-black text-gray-800 mb-2">Unlock Illustrations</h4>
                  <button 
                    onClick={handleOpenKeySelector}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all"
                  >
                    Connect AI Illustrator
                  </button>
                </div>
              ) : null}
              
              <img 
                src={displayImage} 
                alt={current?.french || 'French word'}
                className="w-full h-full object-cover transition-all duration-500"
              />
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-white/50 flex flex-col gap-2">
                  <button 
                    onClick={() => handleGenerateImage(currentIndex, true)}
                    disabled={generatingImage}
                    className="bg-blue-600 text-white p-3 px-5 rounded-xl font-black text-xs hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group/btn"
                  >
                    <span className="group-hover/btn:rotate-12 transition-transform">🎨</span> Redraw Illustration
                  </button>
                </div>
              </div>
            </div>

            {isAdjectives && current.feminine ? (
              <div className="w-full flex flex-col items-center mb-4">
                <div className="flex items-center gap-8 mb-4">
                  <div className="flex flex-col items-center">
                    <span className="text-6xl font-black text-blue-600 capitalize tracking-tighter">{current.french}</span>
                    <span className="text-xs font-black text-blue-400 uppercase tracking-widest mt-1">Masculin ♂️</span>
                    <button onClick={() => playPronunciation(current.french)} className="mt-2 text-2xl hover:scale-110 transition-transform">🔊</button>
                  </div>
                  <div className="text-4xl font-black text-gray-200">/</div>
                  <div className="flex flex-col items-center">
                    <span className="text-6xl font-black text-pink-600 capitalize tracking-tighter">{current.feminine}</span>
                    <span className="text-xs font-black text-pink-400 uppercase tracking-widest mt-1">Féminin ♀️</span>
                    <button onClick={() => playPronunciation(current.feminine!)} className="mt-2 text-2xl hover:scale-110 transition-transform">🔊</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-6xl font-black text-gray-800 mb-2 capitalize tracking-tighter">{current?.french}</h2>
                <button 
                  onClick={() => playPronunciation(current?.french)}
                  className="bg-blue-600 text-white px-8 py-4 rounded-3xl font-bold text-xl shadow-lg hover:bg-blue-700 transition-transform hover:scale-105 mb-4 flex items-center gap-2"
                >
                  <span>🔊</span> Listen
                </button>
              </>
            )}

            <p className="text-2xl font-bold text-blue-400 mb-8 uppercase tracking-widest">{current?.english}</p>
            
            <div className="w-full bg-blue-50 rounded-3xl p-6 border-2 border-blue-100">
              <p className="text-sm font-black text-blue-400 uppercase mb-2">In a sentence:</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight mb-2">{current?.example}</p>
              <p className="text-lg text-gray-500">{current?.exampleEnglish}</p>
              <button 
                onClick={() => playPronunciation(current?.example)}
                className="mt-4 text-blue-600 font-bold flex items-center gap-2 hover:underline"
              >
                <span>🔊</span> Listen to sentence
              </button>
            </div>
          </div>
        </div>

        <div className={`${(category === 'GRAMMAR' && hasConjugations) ? 'lg:col-span-6' : 'lg:col-span-4'} flex flex-col gap-6 order-1 lg:order-2`}>
          {category === 'GRAMMAR' && hasConjugations && (
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-purple-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <span className="text-4xl">🧩</span>
                <div>
                  <h3 className="text-2xl font-black text-purple-600 leading-tight">Conjugation Lab</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Master the verb forms!</p>
                </div>
              </div>
              <div className="space-y-4 flex-grow">
                {current.conjugations!.map((conj, idx) => {
                  const style = getSubjectStyles(idx);
                  return (
                    <div key={idx} className={`${style.bg} ${style.border} border-2 p-3 sm:p-4 rounded-3xl flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-md group`}>
                      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm">
                        {style.icon}
                      </div>
                      <div className="flex-grow flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                        <span className={`text-sm sm:text-lg font-black uppercase tracking-tighter ${style.text}`}>
                          {conj.subject}
                        </span>
                        <span className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
                          {conj.form}
                        </span>
                      </div>
                      <button 
                        onClick={() => playPronunciation(`${conj.subject} ${conj.form}`)}
                        className="bg-white hover:bg-gray-50 p-3 rounded-2xl text-xl shadow-sm border border-gray-100 group-hover:text-blue-500 transition-colors"
                      >
                        🔊
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {category === 'GRAMMAR' && !hasConjugations && (
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-orange-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">{(isArticles || isAdjectives) ? (isArticles ? '🔡' : '🪄') : '🧪'}</span>
                <div>
                  <h3 className="text-2xl font-black text-orange-600 leading-tight">
                    {isArticles ? 'Article Master' : (isAdjectives ? 'Adjective Magic' : 'Grammar Guide')}
                  </h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {selectedSubTopic ? `Exploring "${selectedSubTopic.replace('_', ' ')}"` : 'The logic of the language!'}
                  </p>
                </div>
              </div>
              <div className="bg-orange-50 p-6 rounded-3xl border-2 border-orange-100 flex-grow">
                <p className="text-sm font-black text-orange-400 uppercase mb-3 tracking-widest">Rule Explorer:</p>
                <div className="text-xl font-bold text-gray-700 leading-snug">
                  {isAdjectives ? (
                    <>
                      Most adjectives change for <span className="text-pink-600 font-black">Feminine</span> items. 
                      Look at how <span className="text-blue-600 font-bold">{current.french}</span> becomes <span className="text-pink-600 font-bold">{current.feminine}</span>!
                    </>
                  ) : (
                    <>
                      You are viewing {currentIndex + 1} of {items.length} examples. 
                      Focus on the pattern and repeat!
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {category === 'VOCABULARY' && (
            <div className="bg-blue-600 text-white p-10 rounded-[2.5rem] shadow-xl text-center flex flex-col items-center justify-center flex-1">
               <div className="text-7xl mb-6">⭐</div>
               <h3 className="text-3xl font-black mb-2">Super Learner!</h3>
               <p className="text-lg font-bold opacity-80 uppercase tracking-widest">You're doing great!</p>
               <div className="mt-8 w-full h-2 bg-blue-400 rounded-full overflow-hidden">
                  <div className="h-full bg-white animate-pulse" style={{ width: '60%' }}></div>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button 
          onClick={() => { stopPrepRef.current = true; setCurrentIndex(i => Math.max(0, i - 1)); }}
          disabled={currentIndex === 0}
          className="w-full sm:w-auto px-8 py-5 rounded-3xl font-black text-xl bg-white text-gray-400 border-4 border-gray-100 disabled:opacity-50 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button 
          onClick={() => { 
            stopPrepRef.current = true;
            if (currentIndex === items.length - 1) {
              (isArticles || isAdjectives) ? setSelectedSubTopic(null) : onComplete();
            } else {
              setCurrentIndex(i => i + 1);
            }
          }}
          className="w-full sm:flex-1 bg-blue-600 text-white py-6 rounded-3xl font-black text-2xl shadow-2xl hover:bg-blue-700 transition-transform active:scale-95 border-b-8 border-blue-800"
        >
          {currentIndex === items.length - 1 ? "Finish Window! 🏁" : "Next Discovery ➜"}
        </button>
      </div>
      
      <div className="mt-8 text-center font-bold text-gray-400">
        {(isArticles || isAdjectives) ? `Exploring the magical examples of "${selectedSubTopic?.replace('_', ' ')}"` : (category === 'GRAMMAR' ? "Building Strong French Skills!" : "Learning Fun New Words!")}
      </div>
    </div>
  );
};

export default LearningView;
