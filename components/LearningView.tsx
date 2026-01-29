
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

const getSubjectStyles = (subject: string) => {
  const s = subject.toLowerCase();
  if (s.includes('je')) return { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', sub: 'text-blue-400' };
  if (s.includes('tu')) return { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', sub: 'text-green-400' };
  if (s.includes('il') || s.includes('elle') || s.includes('on')) return { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', sub: 'text-rose-400' };
  if (s.includes('nous')) return { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', sub: 'text-indigo-400' };
  if (s.includes('vous')) return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', sub: 'text-amber-400' };
  if (s.includes('ils') || s.includes('elles')) return { bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-700', sub: 'text-teal-400' };
  return { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-700', sub: 'text-gray-400' };
};

const LearningView: React.FC<LearningViewProps> = ({ subId, category, onComplete }) => {
  const [items, setItems] = useState<WordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSubTopic, setSelectedSubTopic] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [customImages, setCustomImages] = useState<Record<string, string>>({});
  const [preparingAll, setPreparingAll] = useState(false);
  const [prepProgress, setPrepProgress] = useState({ current: 0, total: 0 });
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const isArticles = subId === 'articles';
  const isAdjectives = subId === 'adjectives';
  const stopPrepRef = useRef(false);

  useEffect(() => {
    if ((isArticles || isAdjectives) && !selectedSubTopic) { setLoading(false); return; }
    const loadData = async () => {
      setLoading(true);
      const storageId = (isArticles || isAdjectives) ? `${subId}_${selectedSubTopic}` : subId;
      let data = getStoredContent(storageId);
      if (data.length === 0) data = await seedContent(subId, category, selectedSubTopic || undefined);
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
    if (cached && !force) { setCustomImages(prev => ({ ...prev, [current.french]: cached })); return; }
    
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        if (index === currentIndex) setErrorStatus("KEY_REQUIRED");
        return;
      }

      if (index === currentIndex) {
        setGeneratingImage(true);
        setErrorStatus(null);
      }

      const result = await generateEducationalImage(current.french, current.english, current.isOverview);
      if (result) { 
        await saveStoredImage(current.french, result); 
        setCustomImages(prev => ({ ...prev, [current.french]: result })); 
      }
    } catch (error: any) {
      console.error(error);
      if (index === currentIndex) {
        if (error?.message === "API_KEY_RESET" || error?.message === "QUOTA_EXHAUSTED") {
          setErrorStatus(error.message);
        } else {
          setErrorStatus("GENERATION_FAILED");
        }
      }
    } finally { 
      if (index === currentIndex) setGeneratingImage(false); 
    }
  }, [items, currentIndex]);

  const handleOpenKeyDialog = async () => {
    await (window as any).aistudio.openSelectKey();
    setErrorStatus(null);
    handleGenerateImage(currentIndex, true);
  };

  const handlePrepareAll = async () => {
    if (items.length === 0 || preparingAll) return;
    if (!await (window as any).aistudio.hasSelectedApiKey()) { 
      await (window as any).aistudio.openSelectKey(); 
      if (!await (window as any).aistudio.hasSelectedApiKey()) return; 
    }
    setPreparingAll(true); stopPrepRef.current = false;
    for (let i = 0; i < items.length; i++) {
      if (stopPrepRef.current) break;
      if (!await getStoredImage(items[i].french)) {
        setPrepProgress({ current: i + 1, total: items.length });
        await handleGenerateImage(i);
        await new Promise(r => setTimeout(r, 600));
      }
    }
    setPreparingAll(false);
  };

  useEffect(() => {
    if (items.length > 0 && !loading) {
      const current = items[currentIndex];
      if (current) {
        getStoredImage(current.french).then(cached => { 
          if (cached) {
            setCustomImages(prev => ({ ...prev, [current.french]: cached })); 
            setErrorStatus(null);
          } else {
            handleGenerateImage(currentIndex); 
          }
        });
        if (currentIndex + 1 < items.length) {
          const next = items[currentIndex + 1];
          if (next) getStoredImage(next.french).then(cached => { if (!cached) handleGenerateImage(currentIndex + 1); });
        }
      }
    }
  }, [currentIndex, items, loading, handleGenerateImage]);

  if ((isArticles || isAdjectives) && !selectedSubTopic) {
    const groups = isArticles ? ARTICLE_GROUPS : ADJECTIVE_GROUPS;
    return (
      <div className="flex flex-col h-full p-4 overflow-hidden">
        <h2 className="text-xl font-black text-gray-800 text-center mb-4">Choose Category</h2>
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto no-scrollbar">
          {groups.map((group) => (
            <button key={group.id} onClick={() => setSelectedSubTopic(group.id)} className="group bg-white p-4 rounded-2xl shadow-sm border border-transparent hover:border-blue-300 flex flex-col items-center transition-all hover:scale-105">
              <div className={`${group.color} w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-1 text-white`}>{group.icon}</div>
              <span className="text-sm font-black text-gray-800 text-center">{group.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onComplete} className="mt-4 text-[10px] font-bold text-gray-400 self-center">← Back</button>
      </div>
    );
  }

  if (loading) return <div className="flex h-full items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent"></div></div>;

  if (items.length === 0) return <div className="flex h-full items-center justify-center text-gray-500 font-bold">No words found in this category.</div>;

  const current = items[currentIndex];
  if (!current) return null;

  const progressPercent = ((currentIndex + 1) / items.length) * 100;
  const hasConjugations = current.conjugations && current.conjugations.length > 0;
  const displayImage = customImages[current.french] || `https://picsum.photos/seed/${current?.french}/400/300`;

  if (current.isOverview) {
    return (
      <div className="flex flex-col h-full overflow-hidden p-2 sm:p-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Lesson Intro</span>
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 w-[5%]" /></div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 bg-white rounded-3xl p-6 shadow-xl border-4 border-blue-50 overflow-hidden animate-in zoom-in duration-500">
           <div className="flex-1 relative rounded-2xl overflow-hidden bg-gray-50 border-2 border-blue-100 shadow-inner group">
              {generatingImage && <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center text-sm font-black text-blue-600 animate-pulse">Creating Infographic...</div>}
              {errorStatus && <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-xs font-black text-red-500 mb-2">{errorStatus === 'QUOTA_EXHAUSTED' ? 'Model Quota Exceeded' : 'Key Selection Required'}</p>
                  <button onClick={handleOpenKeyDialog} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg">Select New API Key</button>
              </div>}
              <img src={displayImage} className="w-full h-full object-cover" alt="Article Rule" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                 <h2 className="text-4xl font-black text-white drop-shadow-lg">{current.french}</h2>
              </div>
           </div>

           <div className="flex-1 flex flex-col justify-center space-y-4">
              <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg transform -rotate-1">
                 <h3 className="text-sm font-black uppercase tracking-widest mb-1 opacity-80">Grammar Rule</h3>
                 <p className="text-lg font-bold leading-tight">{current.exampleEnglish}</p>
                 <p className="text-sm italic opacity-90 mt-2">{current.example}</p>
              </div>

              {category !== 'GRAMMAR' && (
                <div className="space-y-3">
                   <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Key Examples</h4>
                   <div className="space-y-2">
                      {current.multipleExamples?.map((ex, i) => (
                        <div 
                          key={i} 
                          onClick={() => playPronunciation(ex.text)}
                          className="bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-white hover:shadow-md transition-all active:scale-95 group flex justify-between items-center"
                        >
                           <div>
                              <p className="text-sm font-black text-blue-800">{ex.text}</p>
                              <p className="text-[10px] text-gray-500 font-bold">{ex.translation}</p>
                           </div>
                           <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity">🔊</span>
                        </div>
                      ))}
                   </div>
                </div>
              )}
           </div>
        </div>

        <button 
          onClick={() => setCurrentIndex(1)} 
          className="mt-4 flex-shrink-0 w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xl shadow-xl hover:bg-blue-700 transition-all active:scale-95"
        >
          I've Got It! Start Learning →
        </button>
      </div>
    );
  }

  const showUsageLab = category === 'VOCABULARY';
  const showGrammarSidebar = category === 'GRAMMAR' && hasConjugations;

  return (
    <div className="flex flex-col h-full overflow-hidden p-2 sm:p-4 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Step {currentIndex + 1}/{items.length}</span>
           <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${progressPercent}%` }} /></div>
        </div>
        <button onClick={handlePrepareAll} className="text-[9px] font-bold bg-white border border-gray-100 px-2 py-0.5 rounded text-blue-600 transition-colors hover:bg-blue-50">
           {preparingAll ? `⚡ ${prepProgress.current}/${prepProgress.total}` : "🪄 Prep All Images"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 overflow-hidden items-stretch">
        
        {/* Conjugations Side List */}
        {showGrammarSidebar && (
          <div className="md:w-[35%] lg:w-[30%] flex flex-col bg-white rounded-3xl p-4 shadow-sm border-2 border-purple-50 flex-shrink-0 order-2 md:order-1 overflow-hidden">
             <div className="flex items-center gap-2 mb-3 px-1 border-b border-purple-100 pb-2">
               <span className="text-xl">🧪</span>
               <h3 className="text-xs font-black text-purple-600 uppercase tracking-tight">Verb Forms</h3>
             </div>
             <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-0.5">
               {current.conjugations!.map((c, i) => {
                 const styles = getSubjectStyles(c.subject);
                 return (
                   <div 
                    key={i} 
                    className={`${styles.bg} ${styles.border} border-2 p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:shadow-md active:scale-95 group/conj`} 
                    onClick={() => playPronunciation(`${c.subject} ${c.form}`)}
                   >
                     <div className="leading-tight overflow-hidden">
                       <span className={`${styles.sub} text-[10px] font-black block uppercase leading-none mb-1 truncate`}>{c.subject}</span>
                       <span className={`font-black ${styles.text} text-base truncate`}>{c.form}</span>
                     </div>
                     <span className={`${styles.sub} text-xl opacity-20 group-hover/conj:opacity-100 transition-opacity`}>🔊</span>
                   </div>
                 );
               })}
             </div>
             <p className="mt-2 text-[10px] text-gray-400 font-bold italic text-center">Tap Subject to hear conjugation!</p>
          </div>
        )}

        {/* Main Content Card - Central Stage */}
        <div className={`flex flex-col bg-white rounded-3xl p-4 shadow-xl border-4 border-gray-50 overflow-hidden order-1 md:order-2 ${showGrammarSidebar ? 'flex-1' : 'max-w-3xl mx-auto w-full'}`}>
          {/* Reduced Picture Size Container for Grammar & Verbs */}
          <div className={`${hasConjugations ? 'h-32 sm:h-40 md:h-44' : 'h-40 sm:h-48 md:h-56'} relative rounded-2xl overflow-hidden bg-gray-100 mb-4 group shadow-inner border border-gray-100 flex-shrink-0`}>
            {generatingImage && <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-sm flex items-center justify-center text-sm font-black text-blue-600 animate-pulse">Creating educational visual...</div>}
            {errorStatus && <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-xs font-black text-red-500 mb-2">
                    {errorStatus === 'QUOTA_EXHAUSTED' ? 'Model Quota Full' : errorStatus === 'KEY_REQUIRED' ? 'Key Needed' : 'Key Expired'}
                  </p>
                  <button onClick={handleOpenKeyDialog} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg">Update API Key</button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-[9px] text-gray-400 mt-2 hover:underline">Billing Docs</a>
              </div>}
            <img src={displayImage} className="w-full h-full object-contain" alt={current.french} />
            <button 
              onClick={(e) => { e.stopPropagation(); handleGenerateImage(currentIndex, true); }} 
              className="absolute bottom-2 right-2 bg-white/95 p-2 rounded-full text-base opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 border border-gray-100"
              title="Redraw illustration"
            >🎨</button>
          </div>
          
          <div className="text-center flex-1 flex flex-col justify-center px-2">
            {current.feminine ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3">
                 <div className="bg-blue-50 border-2 border-blue-100 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm flex-1 max-w-[280px]">
                    <button onClick={() => playPronunciation(current.french)} className="text-blue-500 text-3xl flex-shrink-0 hover:scale-110 transition-transform">🔊</button>
                    <div className="text-left overflow-hidden">
                       <span className="text-[9px] font-black text-blue-400 uppercase block leading-none mb-0.5 tracking-tight">Masculin ♂️</span>
                       <span className="text-lg font-black text-gray-800 truncate block">{current.french}</span>
                    </div>
                 </div>
                 
                 <div className="bg-pink-50 border-2 border-pink-100 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm flex-1 max-w-[280px]">
                    <button onClick={() => playPronunciation(current.feminine!)} className="text-pink-500 text-3xl flex-shrink-0 hover:scale-110 transition-transform">🔊</button>
                    <div className="text-left overflow-hidden">
                       <span className="text-[9px] font-black text-pink-400 uppercase block leading-none mb-0.5 tracking-tight">Féminin ♀️</span>
                       <span className="text-lg font-black text-gray-800 truncate block">{current.feminine}</span>
                    </div>
                 </div>
              </div>
            ) : (
              <h2 className={`${hasConjugations ? 'text-3xl' : 'text-4xl'} font-black text-gray-800 leading-tight mb-1`}>{current.french}</h2>
            )}
            
            <p className={`${hasConjugations ? 'text-base' : 'text-lg'} font-bold text-blue-500 mb-3 uppercase tracking-widest`}>{current.english}</p>
            
            <div className="flex flex-col gap-3">
              {/* Show context example specifically for Grammar Adjectives and Verbs */}
              {(category !== 'GRAMMAR' || (category === 'GRAMMAR' && (isAdjectives || hasConjugations))) && (
                <div 
                  onClick={() => playPronunciation(current.example)}
                  className="bg-slate-50 p-3 rounded-xl text-left border-2 border-slate-100 cursor-pointer hover:bg-white hover:border-blue-200 transition-all group/ex relative active:scale-[0.98] shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Usage Example</p>
                    <span className="text-xl opacity-40 group-hover/ex:opacity-100 transition-opacity">🔊</span>
                  </div>
                  <p className="text-base font-black text-gray-800 leading-tight mb-0.5">{current.example}</p>
                  <p className="text-xs text-gray-500 italic font-medium leading-tight">{current.exampleEnglish}</p>
                </div>
              )}

              {!current.feminine && !isAdjectives && !hasConjugations && (
                <button onClick={() => playPronunciation(current.french)} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-sm font-black inline-flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                  <span>🔊</span> Pronounce Word
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Vocabulary Usage Lab Sidebar */}
        {showUsageLab && (
          <div className="md:w-[32%] lg:w-[28%] flex flex-col bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-indigo-100 flex-shrink-0 order-3 overflow-hidden animate-in slide-in-from-right duration-500">
            <div className="flex items-center gap-3 mb-6 px-1 border-b-2 border-indigo-50 pb-5 flex-shrink-0">
                <span className="text-4xl">📚</span>
                <div>
                    <h3 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Usage Lab</h3>
                    <p className="text-base font-black text-gray-800">In Context</p>
                </div>
            </div>
            
            <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar pr-1">
              {current.multipleExamples?.slice(0, 3).map((ex, i) => (
                  <div 
                    key={i} 
                    onClick={() => playPronunciation(ex.text)}
                    className="bg-indigo-50/40 p-6 rounded-[2.5rem] text-left border-2 border-transparent hover:border-indigo-300 hover:bg-white cursor-pointer transition-all group/ex relative active:scale-[0.98] shadow-sm flex flex-col min-h-0"
                  >
                    <div className="flex justify-between items-center mb-2 flex-shrink-0">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Example {i+1}</span>
                      <span className="text-3xl opacity-10 group-hover/ex:opacity-100 transition-opacity">🔊</span>
                    </div>
                    <p className="text-xl font-black text-gray-800 leading-tight mb-2 tracking-tight">{ex.text}</p>
                    <p className="text-sm text-gray-500 italic font-bold leading-tight">{ex.translation}</p>
                  </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center gap-4 mt-4 flex-shrink-0">
        <button 
          onClick={() => { stopPrepRef.current = true; setCurrentIndex(i => Math.max(0, i - 1)); }} 
          disabled={currentIndex === 0} 
          className="w-16 h-16 bg-white border-4 border-gray-100 rounded-3xl text-2xl disabled:opacity-20 flex items-center justify-center transition-all hover:bg-gray-50 hover:border-blue-200 shadow-sm active:scale-95"
        >←</button>
        <button 
          onClick={() => {
            stopPrepRef.current = true;
            currentIndex === items.length - 1 ? (isArticles || isAdjectives ? setSelectedSubTopic(null) : onComplete()) : setCurrentIndex(i => i + 1);
          }} 
          className="flex-1 bg-blue-600 text-white h-16 rounded-[2rem] font-black text-xl shadow-xl transition-all hover:bg-blue-700 hover:-translate-y-1 active:scale-95 border-b-8 border-blue-800"
        >
           {currentIndex === items.length - 1 ? "VOILÀ! FINISH 🏁" : "NEXT STEP →"}
        </button>
      </div>
    </div>
  );
};

export default LearningView;
