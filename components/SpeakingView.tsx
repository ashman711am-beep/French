
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { WordItem, CategoryType } from '../types';
import { getStoredContent, seedContent, playPronunciation } from '../services/geminiService';

interface PracticeUnit {
  text: string;
  translation: string;
  phonetic?: string;
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
  const [masteryStars, setMasteryStars] = useState(0);

  const [allWords, setAllWords] = useState<WordItem[]>([]);
  const [practiceUnits, setPracticeUnits] = useState<PracticeUnit[]>([]);
  const [unitIndex, setUnitIndex] = useState(0);

  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        stopSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive]);

  useEffect(() => {
    const loadData = async () => {
      let items = getStoredContent(subId);
      if (items.length === 0 && category) {
        items = await seedContent(subId, category);
      }
      setAllWords(items);
      
      if (isPronunciationMode) {
        const units: PracticeUnit[] = [];
        items.slice(0, 10).forEach(item => {
          units.push({ text: item.french, translation: item.english, phonetic: item.phonetic, type: 'word' });
          if (item.example) {
            units.push({ text: item.example, translation: item.exampleEnglish, type: 'phrase' });
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
         Target: "${current.text}".
         
         COACHING STYLE:
         - Be extremely encouraging. Use analogies for tricky sounds.
         - Listen to the student repeat it.
         - Give specific, kind feedback. 
         - When they match correctly, say "Bravo!".`;
    } else {
      systemInstruction = `You are a friendly and encouraging French tutor for children. The topic is "${subName}". 
         Ask the child to say simple sentences in French related to "${subName}". Keep responses short and full of praise.`;
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
          }

          if (message.serverContent?.turnComplete) {
            setTranscriptions(prev => [...prev, { user: currentUserText, tutor: currentTutorText }]);
            
            const earned = isPronunciationMode ? 25 : 15;
            setPointsEarned(p => p + earned);
            onPointEarned(earned);
            
            // Check for match in pronunciation mode
            if (isPronunciationMode && practiceUnits[unitIndex]) {
               const target = practiceUnits[unitIndex].text.toLowerCase().replace(/[.,!?;:]/g, "");
               const input = currentUserText.toLowerCase().replace(/[.,!?;:]/g, "");
               if (input.includes(target) || target.includes(input)) {
                  setMasteryStars(s => Math.min(3, s + 1));
                  setConfidence(95);
               } else {
                  setConfidence(prev => Math.min(prev + 10, 85));
               }
            }

            setCurrentUserText('');
            setCurrentTutorText('');
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
    setUnitIndex(prev => prev + 1);
    setMasteryStars(0);
    setConfidence(0);
    if (isActive) {
        stopSession();
        setTimeout(() => startSession(), 400);
    }
  };

  useEffect(() => {
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const currentUnit = practiceUnits[unitIndex];

  // Logic for visual word highlighting
  const renderTranscriptionComparison = () => {
    if (!currentUnit || !currentUserText) return <p className="text-xl font-bold opacity-60 italic">Waiting for you to speak...</p>;
    
    const targetWords = currentUnit.text.toLowerCase().split(/\s+/);
    const inputWords = currentUserText.toLowerCase().split(/\s+/);
    
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {inputWords.map((word, i) => {
           const isMatch = targetWords.some(tw => tw.includes(word) || word.includes(tw));
           return (
             <span key={i} className={`px-2 py-1 rounded-xl text-xl font-black ${isMatch ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}`}>
                {word}
             </span>
           );
        })}
      </div>
    );
  };

  const activeTips = useMemo(() => {
    if (!currentUnit) return [];
    const text = currentUnit.text.toLowerCase();
    const tips = [];
    for (const [key, value] of Object.entries(SOUND_TIPS)) {
        if (text.includes(key)) tips.push(value);
    }
    return tips.slice(0, 2);
  }, [currentUnit]);

  return (
    <div className="max-w-[1400px] mx-auto p-4 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex-1 flex gap-4 overflow-hidden">
        
        {isActive && (
          <aside className={`bg-white rounded-3xl border-4 border-blue-50 shadow-xl flex flex-col transition-all duration-300 ${showVocabSidebar ? 'w-64 md:w-80' : 'w-0 opacity-0 pointer-events-none'}`}>
             <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-black text-gray-800 uppercase tracking-tighter text-sm">Learning List</h3>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {allWords.map((word, idx) => (
                   <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95 group" onClick={() => playPronunciation(word.french)}>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-black text-gray-800">{word.french}</span>
                        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">🔊</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{word.english}</span>
                   </div>
                ))}
             </div>
          </aside>
        )}

        <div className="flex-1 bg-white rounded-5xl p-6 md:p-10 shadow-2xl border-4 border-blue-100 flex flex-col overflow-hidden relative">
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
               <button onClick={() => setShowVocabSidebar(!showVocabSidebar)} className={`p-3 rounded-2xl transition-all ${showVocabSidebar ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>📖</button>
               <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                     <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                     <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter leading-none">
                        {isPronunciationMode ? 'Accent Coach' : 'Conversation'}
                     </h2>
                  </div>
               </div>
            </div>
            <div className="bg-yellow-400 text-white px-5 py-2 rounded-2xl font-black shadow-md border-b-4 border-yellow-500 flex items-center gap-2 transform -rotate-1">
               <span>⭐</span> {pointsEarned} Points
            </div>
          </div>

          {isPronunciationMode && currentUnit && !isConnecting && (
              <div className="mb-6 p-6 md:p-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[3rem] shadow-xl text-center relative overflow-hidden group">
                 <div className="relative z-10">
                    <div className="flex justify-center gap-2 mb-2">
                       {[...Array(3)].map((_, i) => (
                         <span key={i} className={`text-3xl transition-all duration-500 ${i < masteryStars ? 'scale-110 opacity-100' : 'opacity-20 grayscale'}`}>⭐</span>
                       ))}
                    </div>
                    
                    <h3 className="text-5xl font-black text-white mb-1 tracking-tight drop-shadow-md">{currentUnit.text}</h3>
                    {currentUnit.phonetic && (
                       <p className="text-xl font-bold text-indigo-100 mb-4 tracking-widest opacity-80 uppercase">({currentUnit.phonetic})</p>
                    )}
                    
                    <p className="text-xl font-bold text-white italic opacity-90 mb-6">"{currentUnit.translation}"</p>

                    <div className="flex items-center justify-center gap-4">
                       <button onClick={() => playPronunciation(currentUnit.text)} className="bg-white text-indigo-600 px-6 py-3 rounded-2xl text-lg font-black shadow-lg hover:scale-105 transition-all flex items-center gap-2">
                          <span>🔊</span> Normal
                       </button>
                       <button onClick={() => playPronunciation(currentUnit.text, true)} className="bg-indigo-100 text-indigo-800 px-6 py-3 rounded-2xl text-lg font-black shadow-lg hover:scale-105 transition-all flex items-center gap-2">
                          <span>🐢</span> Turtle Mode
                       </button>
                    </div>

                    {activeTips.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                            {activeTips.map((tip, i) => (
                                <div key={i} className="bg-white/10 backdrop-blur-lg border border-white/20 p-3 rounded-2xl text-left flex gap-3 items-center">
                                    <span className="text-3xl">{tip.icon}</span>
                                    <div>
                                        <p className="text-sm font-black text-white leading-tight">{tip.title}</p>
                                        <p className="text-[10px] font-bold text-white/80 leading-tight">{tip.hint}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
              </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-4 px-3 no-scrollbar mb-6 flex flex-col">
            {!isActive && !isConnecting && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                 <div className="text-[8rem] mb-6 animate-bounce">
                    {isPronunciationMode ? '👄' : '🎙️'}
                 </div>
                 <h3 className="text-4xl font-black text-gray-800 mb-4">
                    {isPronunciationMode ? 'Perfect Your Accent!' : 'Ready to Chat?'}
                 </h3>
                 <button onClick={startSession} className={`text-white px-16 py-6 rounded-3xl font-black text-3xl shadow-2xl transition-all hover:scale-105 active:scale-95 border-b-8 ${isPronunciationMode ? 'bg-indigo-500 border-indigo-700' : 'bg-blue-600 border-blue-800'}`}>
                    START STUDIO ➜
                 </button>
              </div>
            )}

            {isActive && isPronunciationMode && (
               <div className="bg-slate-50 rounded-[2.5rem] p-8 text-center border-4 border-blue-50 flex flex-col items-center justify-center min-h-[160px] animate-in fade-in zoom-in duration-500">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Transcription Matching</span>
                  {renderTranscriptionComparison()}
                  <div className="mt-6 flex items-center gap-4 w-full max-w-md">
                     <div className="flex-1 h-3 bg-white rounded-full overflow-hidden border border-blue-100">
                        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${confidence}%` }}></div>
                     </div>
                     <span className="text-sm font-black text-blue-500">{Math.round(confidence)}% Match</span>
                  </div>
               </div>
            )}

            {isConnecting && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-2xl font-black text-blue-600 mt-6 animate-pulse uppercase">Connecting Studio...</p>
              </div>
            )}

            {isActive && !isPronunciationMode && transcriptions.map((t, i) => (
              <div key={i} className="space-y-3">
                {t.user && (
                  <div className="flex justify-end">
                     <div className="bg-blue-600 text-white p-5 rounded-3xl rounded-tr-none max-w-[80%] font-bold shadow-lg">
                        {t.user}
                     </div>
                  </div>
                )}
                <div className="flex justify-start">
                   <div className="bg-white text-gray-800 p-5 rounded-3xl rounded-tl-none max-w-[80%] font-bold shadow-lg border-2 border-purple-50">
                      {t.tutor}
                   </div>
                </div>
              </div>
            ))}
          </div>

          {isActive && (
              <div className="mt-auto flex justify-between gap-4 relative z-20">
                  <button onClick={handleFinish} className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-black text-xl shadow-xl hover:bg-rose-600 border-b-4 border-rose-800">⏹️ Stop</button>
                  {isPronunciationMode && (
                     <button onClick={handleNextUnit} className="flex-1 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-2xl shadow-xl hover:bg-indigo-700 border-b-4 border-indigo-800">Next Word ➜</button>
                  )}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeakingView;
