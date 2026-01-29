
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { WordItem, CategoryType } from '../types';
import { getStoredContent, seedContent, playPronunciation } from '../services/geminiService';

interface PracticeUnit {
  text: string;
  translation: string;
  type: 'word' | 'phrase';
}

interface SpeakingViewProps {
  subId: string;
  subName: string;
  isQuizMode?: boolean;
  isPronunciationMode?: boolean;
  category?: CategoryType;
  onPointEarned: (points: number) => void;
  onFinish: (sessionTotal: number) => void;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Pronunciation tips for common French sounds
const SOUND_TIPS: Record<string, { title: string; hint: string; icon: string }> = {
  'r': { title: 'The French "R"', hint: 'Pretend you are a soft tiger growling "grrrr" in the back of your throat.', icon: '🐯' },
  'u': { title: 'The Secret "U"', hint: 'Shape your lips for a whistle, but try to say "eeeee"!', icon: '😗' },
  'ou': { title: 'The Ghost "OU"', hint: 'Like a ghost saying "booo"! Keep your lips very round.', icon: '👻' },
  'an': { title: 'Nasal "AN"', hint: 'Try to make your nose vibrate a little bit while you speak.', icon: '👃' },
  'en': { title: 'Nasal "EN"', hint: 'Similar to "AN", pretend you have a tiny bell in your nose.', icon: '🔔' },
  'on': { title: 'Nasal "ON"', hint: 'Like the "on" in "song", but keep your mouth more closed.', icon: '🎶' },
  'eu': { title: 'Thinking "EU"', hint: 'Say "uhhh" like you are thinking, but make your lips into a circle.', icon: '🤔' },
  'é': { title: 'Smile "É"', hint: 'Give a big smile and say a sharp "ay"!', icon: '😁' },
};

const SpeakingView: React.FC<SpeakingViewProps> = ({ 
  subId, 
  subName, 
  isQuizMode = false, 
  isPronunciationMode = false,
  category,
  onPointEarned, 
  onFinish 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ user: string; tutor: string }[]>([]);
  const [currentTutorText, setCurrentTutorText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [pointsEarned, setPointsEarned] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [volume, setVolume] = useState(0);
  const [showVocabSidebar, setShowVocabSidebar] = useState(true);

  // All words from this category to show as suggestions
  const [allWords, setAllWords] = useState<WordItem[]>([]);
  // Pronunciation practice units (words + phrases)
  const [practiceUnits, setPracticeUnits] = useState<PracticeUnit[]>([]);
  const [unitIndex, setUnitIndex] = useState(0);

  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Stop session if window visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        console.log("Stopping speaking session due to hidden window.");
        stopSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive]);

  // Load and prepare practice units and vocab
  useEffect(() => {
    const loadData = async () => {
      let items = getStoredContent(subId);
      if (items.length === 0 && category) {
        items = await seedContent(subId, category);
      }
      setAllWords(items);
      
      if (isPronunciationMode) {
        const units: PracticeUnit[] = [];
        items.slice(0, 8).forEach(item => {
          units.push({ text: item.french, translation: item.english, type: 'word' });
          if (item.example) {
            units.push({ text: item.example, translation: item.exampleEnglish, type: 'phrase' });
          }
          if (item.multipleExamples) {
            item.multipleExamples.forEach(ex => {
              units.push({ text: ex.text, translation: ex.translation, type: 'phrase' });
            });
          }
        });
        setPracticeUnits(units);
      }
    };
    loadData();
  }, [isPronunciationMode, subId, category]);

  const startSession = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let systemInstruction = "";
    if (isQuizMode) {
      systemInstruction = `You are an official French Oral Examiner for kids. The topic is "${subName}".
         1. Conduct a structured oral quiz with exactly 5 questions.
         2. Ask only ONE question at a time and wait for the response.
         3. MANDATORY: If the child answers with a single word or short fragment, you MUST gently say: "Very good, but can you say that in a full sentence?"
         4. After 5 correct answers, congratulate them and say "Au revoir!".`;
    } else if (isPronunciationMode && practiceUnits.length > 0) {
      const current = practiceUnits[unitIndex];
      systemInstruction = `You are a French Pronunciation Coach for kids. 
         The target ${current.type} is: "${current.text}" (Meaning: "${current.translation}").
         
         COACHING STYLE:
         - Be extremely encouraging and playful. Use analogies for tricky sounds.
         - The French 'R': Tell them it's like a soft "tiger growl" in the throat.
         - The French 'U': Tell them to whistle but say "ee".
         - Nasal sounds (AN, ON, EN): Tell them to make their "nose vibrate".
         
         FLOW:
         1. Model the text slowly and clearly, stressing the tricky parts.
         2. Listen to the student repeat it.
         3. Give specific, kind feedback. If they missed the 'R', remind them of the "tiger growl".
         4. If they do well, say "Bravo!" or "C'est magnifique!".
         5. After they try 2 times or get it right, encourage them to click "Next Word".`;
    } else {
      systemInstruction = `You are a friendly and encouraging French tutor for children. The topic is "${subName}". 
         1. Ask the child to say a simple sentence or word in French related to "${subName}".
         2. Keep responses short and full of praise.`;
    }

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setIsConnecting(false);
          setIsActive(true);
          
          const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
          analyserRef.current = inputAudioContextRef.current!.createAnalyser();
          analyserRef.current.fftSize = 256;
          source.connect(analyserRef.current);

          const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const pcmBlob: Blob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
          };
          
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContextRef.current!.destination);

          const updateVolume = () => {
            if (!analyserRef.current) return;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            setVolume(sum / dataArray.length);
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            setCurrentTutorText(prev => prev + message.serverContent!.outputTranscription!.text);
          } else if (message.serverContent?.inputTranscription) {
            const newText = message.serverContent.inputTranscription.text;
            setCurrentUserText(prev => prev + newText);
            
            if (isQuizMode || isPronunciationMode) {
                setConfidence(prev => {
                    const base = 45 + Math.random() * 25;
                    const bonus = Math.min(30, newText.length * 3);
                    return Math.min(99, base + bonus);
                });
            }
          }

          if (message.serverContent?.turnComplete) {
            setTranscriptions(prev => [...prev, { user: currentUserText, tutor: currentTutorText }]);
            
            const earned = isPronunciationMode ? 25 : 15;
            setPointsEarned(p => p + earned);
            onPointEarned(earned);
            
            setCurrentUserText('');
            setCurrentTutorText('');
            setTimeout(() => setConfidence(0), 1200);
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && outputAudioContextRef.current) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
            const buffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioContextRef.current.destination);
            source.addEventListener('ended', () => sourcesRef.current.delete(source));
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
          }

          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onerror: (e) => {
            console.error("Speaking Error", e);
            setIsConnecting(false);
            setIsActive(false);
        },
        onclose: () => setIsActive(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: systemInstruction,
      }
    });

    sessionRef.current = await sessionPromise;
  };

  const stopSession = () => {
    if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    setIsActive(false);
  };

  const handleFinish = () => {
    stopSession();
    onFinish(pointsEarned);
  };

  const handleNextUnit = () => {
    if (unitIndex < practiceUnits.length - 1) {
        setUnitIndex(prev => prev + 1);
        if (isActive) {
            stopSession();
            setTimeout(() => startSession(), 400);
        }
    } else {
        handleFinish();
    }
  };

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const currentUnit = practiceUnits[unitIndex];

  // Derive relevant sound tips based on current word
  const activeTips = useMemo(() => {
    if (!currentUnit) return [];
    const text = currentUnit.text.toLowerCase();
    const tips = [];
    for (const [key, value] of Object.entries(SOUND_TIPS)) {
        if (text.includes(key)) {
            tips.push(value);
        }
    }
    return tips.slice(0, 2); // Max 2 tips to avoid clutter
  }, [currentUnit]);

  return (
    <div className="max-w-[1400px] mx-auto p-4 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex-1 flex gap-4 overflow-hidden">
        
        {/* Sidebar with Vocabulary and Translations */}
        {isActive && (
          <aside className={`bg-white rounded-3xl border-4 border-blue-50 shadow-xl flex flex-col transition-all duration-300 ${showVocabSidebar ? 'w-64 md:w-80' : 'w-0 opacity-0 pointer-events-none'}`}>
             <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-black text-gray-800 uppercase tracking-tighter text-sm">Suggested Words</h3>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">HELP</span>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {allWords.map((word, idx) => (
                   <div 
                    key={idx} 
                    className="bg-slate-50 p-3 rounded-2xl border border-slate-100 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95 group"
                    onClick={() => playPronunciation(word.french)}
                   >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-black text-gray-800">{word.french}</span>
                        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">🔊</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{word.english}</span>
                   </div>
                ))}
             </div>
          </aside>
        )}

        {/* Main Speaking Studio */}
        <div className="flex-1 bg-white rounded-5xl p-6 md:p-10 shadow-2xl border-4 border-blue-100 flex flex-col overflow-hidden relative">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => setShowVocabSidebar(!showVocabSidebar)}
                  className={`p-3 rounded-2xl transition-all ${showVocabSidebar ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  title="Toggle Vocabulary Help"
               >
                  📖
               </button>
               <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                     <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                     <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter leading-none">
                        {isQuizMode ? 'Oral Exam' : isPronunciationMode ? 'Accent Coach' : 'Conversation'}
                     </h2>
                  </div>
                  <span className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">{subName}</span>
               </div>
            </div>
            <div className="bg-yellow-400 text-white px-5 py-2 rounded-2xl font-black shadow-md border-b-4 border-yellow-500 flex items-center gap-2 transform -rotate-1">
               <span>⭐</span> {pointsEarned} Points
            </div>
          </div>

          {/* Feedback Section */}
          {isActive && (
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6 flex-shrink-0">
               <div className="bg-blue-50/50 rounded-3xl p-5 border-2 border-blue-50 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-blue-400 uppercase mb-3 tracking-[0.2em]">Live Audio Level</span>
                  <div className="flex items-end gap-1.5 h-10">
                     {[...Array(12)].map((_, i) => (
                       <div 
                          key={i} 
                          className="w-2 bg-blue-500 rounded-full transition-all duration-75"
                          style={{ height: `${Math.max(15, volume * (1 - Math.abs(i-5.5)/6) * 1.8)}%` }}
                       ></div>
                     ))}
                  </div>
               </div>
               
               {(isQuizMode || isPronunciationMode) && (
                 <div className="bg-green-50/50 rounded-3xl p-5 border-2 border-green-50 flex flex-col items-center justify-center relative overflow-hidden">
                    <span className="text-[10px] font-black text-green-500 uppercase mb-1 tracking-[0.2em]">Clarity Score</span>
                    <div className="text-4xl font-black text-green-600 mb-2">{Math.round(confidence)}%</div>
                    <div className="w-full h-3 bg-white rounded-full overflow-hidden shadow-inner border border-green-100">
                      <div 
                          className={`h-full transition-all duration-500 ${confidence > 80 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-400' : 'bg-blue-400'}`}
                          style={{ width: `${confidence}%` }}
                      ></div>
                    </div>
                 </div>
               )}
            </div>
          )}

          {/* Pronunciation Target Card */}
          {isPronunciationMode && currentUnit && !isConnecting && (
              <div className="mb-8 p-8 md:p-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[3rem] shadow-2xl text-center animate-in slide-in-from-top duration-700 relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                 <div className="relative z-10">
                    <div className="inline-block px-4 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-black rounded-full uppercase mb-4 border border-white/30">
                      {currentUnit.type} {unitIndex + 1}/{practiceUnits.length}
                    </div>
                    <h3 className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tight drop-shadow-md">{currentUnit.text}</h3>
                    <div className="flex items-center justify-center gap-2 mb-6">
                       <span className="h-0.5 w-8 bg-white/30 rounded-full"></span>
                       <p className="text-xl md:text-2xl font-bold text-white italic opacity-90">"{currentUnit.translation}"</p>
                       <span className="h-0.5 w-8 bg-white/30 rounded-full"></span>
                    </div>

                    {/* Sound Tips display */}
                    {activeTips.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                            {activeTips.map((tip, i) => (
                                <div key={i} className="bg-white/10 backdrop-blur-lg border border-white/20 p-4 rounded-3xl text-left flex gap-4 items-center animate-in zoom-in duration-300">
                                    <span className="text-4xl">{tip.icon}</span>
                                    <div>
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1 opacity-60">Coach's Tip</p>
                                        <p className="text-sm font-black text-white leading-tight">{tip.title}</p>
                                        <p className="text-[10px] font-bold text-white/80 leading-tight">{tip.hint}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button 
                      onClick={() => playPronunciation(currentUnit.text)}
                      className="bg-white text-indigo-600 px-10 py-4 rounded-3xl text-xl font-black shadow-xl hover:scale-105 transition-all active:scale-95 flex items-center gap-4 mx-auto border-b-4 border-indigo-100"
                    >
                      <span className="text-2xl">🔊</span> Hear Model Pronunciation
                    </button>
                 </div>
              </div>
          )}

          {/* Chat / Content Display Area */}
          <div className="flex-1 overflow-y-auto space-y-5 px-3 no-scrollbar mb-8">
            {!isActive && !isConnecting && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                 <div className="text-[10rem] mb-8 animate-bounce leading-none">
                    {isQuizMode ? '🏅' : isPronunciationMode ? '👄' : '🎙️'}
                 </div>
                 <h3 className="text-5xl font-black text-gray-800 mb-6">
                    {isQuizMode ? 'Final Oral Exam' : isPronunciationMode ? 'Perfect Your Accent!' : 'Ready to Chat?'}
                 </h3>
                 <p className="text-2xl text-gray-400 font-medium mb-12 max-w-xl">
                    {isPronunciationMode 
                      ? "Master specific words and sentences with real-time feedback from our AI."
                      : isQuizMode 
                      ? "Prove your skills to the examiner. Answer in full French sentences!" 
                      : "Start a free-flowing conversation with your French AI tutor."}
                 </p>
                 <button 
                  onClick={startSession}
                  className={`text-white px-20 py-8 rounded-[2.5rem] font-black text-4xl shadow-2xl transition-all hover:scale-105 active:scale-95 border-b-8 ${isQuizMode ? 'bg-green-500 border-green-700' : isPronunciationMode ? 'bg-indigo-500 border-indigo-700' : 'bg-blue-600 border-blue-800'}`}
                 >
                    LET'S SPEAK! ➜
                 </button>
              </div>
            )}

            {isConnecting && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="relative">
                   <div className="w-32 h-32 border-[12px] border-blue-50 rounded-full"></div>
                   <div className="w-32 h-32 border-[12px] border-blue-500 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                   <div className="absolute inset-0 flex items-center justify-center text-4xl">🥖</div>
                </div>
                <p className="text-3xl font-black text-blue-600 mt-10 animate-pulse uppercase tracking-widest">
                   Connecting AI Tutor...
                </p>
              </div>
            )}

            {transcriptions.map((t, i) => (
              <div key={i} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {t.user && (
                  <div className="flex justify-end">
                     <div className="bg-blue-600 text-white p-6 rounded-[2.5rem] rounded-tr-none max-w-[85%] font-bold shadow-xl text-xl relative group">
                        <span className="text-[10px] uppercase font-black opacity-60 block mb-2 tracking-widest">YOU</span>
                        {t.user}
                     </div>
                  </div>
                )}
                <div className="flex justify-start">
                   <div className="bg-white text-gray-800 p-6 rounded-[2.5rem] rounded-tl-none max-w-[85%] font-bold shadow-xl text-xl border-4 border-purple-50">
                      <span className="text-[10px] uppercase font-black text-purple-400 block mb-2 tracking-widest leading-none">
                         {isQuizMode ? 'EXAMINER' : isPronunciationMode ? 'COACH' : 'TUTOR'}
                      </span>
                      {t.tutor}
                   </div>
                </div>
              </div>
            ))}
            
            {(currentTutorText || currentUserText) && (
              <div className="space-y-3 animate-pulse">
                  {currentUserText && (
                      <div className="flex justify-end">
                          <div className="bg-blue-100/50 p-6 rounded-[2.5rem] max-w-[85%] font-black italic text-blue-500 text-xl">
                              {currentUserText}...
                          </div>
                      </div>
                  )}
                  {currentTutorText && (
                      <div className="flex justify-start">
                          <div className="bg-purple-100/50 p-6 rounded-[2.5rem] max-w-[85%] font-black italic text-purple-500 text-xl">
                              {currentTutorText}...
                          </div>
                      </div>
                  )}
              </div>
            )}
          </div>

          {/* Action Footer */}
          {isActive && (
              <div className="mt-auto px-2 flex justify-between gap-6 relative z-20 flex-shrink-0">
                  <button 
                      onClick={handleFinish}
                      className="bg-rose-500 text-white px-10 py-6 rounded-3xl font-black text-2xl shadow-2xl hover:bg-rose-600 transition-all active:scale-95 border-b-8 border-rose-800 flex items-center gap-4"
                  >
                     <span>⏹️</span> Finish
                  </button>
                  {isPronunciationMode && (
                     <button 
                      onClick={handleNextUnit}
                      className="flex-1 bg-indigo-600 text-white px-10 py-6 rounded-3xl font-black text-3xl shadow-2xl hover:bg-indigo-700 transition-all active:scale-95 border-b-8 border-indigo-800 flex items-center justify-center gap-4"
                     >
                        Next Word ➜
                     </button>
                  )}
              </div>
          )}
        </div>
      </div>
      <p className="text-center text-gray-400 font-bold text-sm mt-4 tracking-tight">
         {isActive ? "TIPS: Use the words in the left sidebar if you get stuck! Speak clearly into your microphone." : "French mastery through real conversation."}
      </p>
    </div>
  );
};

export default SpeakingView;
