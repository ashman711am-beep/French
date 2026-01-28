
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

interface SpeakingViewProps {
  subId: string;
  subName: string;
  isQuizMode?: boolean;
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

const SpeakingView: React.FC<SpeakingViewProps> = ({ subId, subName, isQuizMode = false, onPointEarned, onFinish }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ user: string; tutor: string }[]>([]);
  const [currentTutorText, setCurrentTutorText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [pointsEarned, setPointsEarned] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [volume, setVolume] = useState(0);

  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startSession = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const systemInstruction = isQuizMode 
      ? `You are an official French Oral Examiner for kids. The topic is "${subName}".
         1. Conduct a structured oral quiz with exactly 5 questions.
         2. Ask only ONE question at a time and wait for the response.
         3. MANDATORY: If the child answers with a single word or short fragment (e.g., just "chat"), you MUST gently say: "Very good, but can you say that in a full sentence? For example: 'C'est un chat'."
         4. Only award the 'point' for the question once they answer in a complete sentence.
         5. After 5 correct full-sentence answers, congratulate them, give a final score, and say "Au revoir !". 
         6. Be encouraging and patient. Keep your own French simple.`
      : `You are a friendly and encouraging French tutor for children. 
         The topic is "${subName}". 
         1. Ask the child to say a simple sentence or word in French related to "${subName}".
         2. Listen to their pronunciation via the audio stream.
         3. If their pronunciation is correct, praise them enthusiastically!
         4. If they make a mistake or their pronunciation is off, gently correct them by saying "Almost! Try saying [Correct Word] like this..." and model the correct pronunciation.
         5. Keep your responses short, simple, and very positive. Avoid complex grammar talk.`;

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

          // Visualizer animation
          const updateVolume = () => {
            if (!analyserRef.current) return;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const avg = sum / dataArray.length;
            setVolume(avg);
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
            
            // Dynamic confidence jump while speaking
            if (isQuizMode) {
                setConfidence(prev => {
                    const base = 40 + Math.random() * 20;
                    const wordBonus = Math.min(40, (currentUserText.length + newText.length) * 2);
                    return Math.min(98, base + wordBonus);
                });
            }
          }

          if (message.serverContent?.turnComplete) {
            setTranscriptions(prev => [...prev, { user: currentUserText, tutor: currentTutorText }]);
            
            let earned = 0;
            const wordsCount = currentUserText.trim().split(/\s+/).length;
            if (wordsCount >= 3) {
              earned = 15;
            } else if (wordsCount >= 1) {
              earned = 5;
            }

            if (earned > 0) {
              setPointsEarned(p => p + earned);
              onPointEarned(earned);
            }
            
            setCurrentUserText('');
            setCurrentTutorText('');
            setConfidence(0);
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
        onerror: (e) => console.error("Speaking Error", e),
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
    if (sessionRef.current) sessionRef.current.close();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsActive(false);
    onFinish(pointsEarned);
  };

  useEffect(() => {
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col h-[75vh]">
      <div className="bg-white rounded-5xl p-8 shadow-2xl border-4 border-blue-100 flex-1 flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className={`w-4 h-4 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
             <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">
                {isQuizMode ? 'Speaking Quiz' : 'Practice'}: {subName}
             </h2>
          </div>
          <div className="bg-yellow-100 px-4 py-1 rounded-full text-yellow-700 font-bold border border-yellow-200">
             ⭐ {pointsEarned} Points earned
          </div>
        </div>

        {/* Real-time Feedback Section */}
        {isActive && (
          <div className="mb-6 grid grid-cols-2 gap-4">
             <div className="bg-gray-50 rounded-3xl p-4 border border-gray-100 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-gray-400 uppercase mb-2">Voice Activity</span>
                <div className="flex items-center gap-1 h-8">
                   {[...Array(8)].map((_, i) => (
                     <div 
                        key={i} 
                        className="w-1.5 bg-blue-500 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(10, volume * (1 - Math.abs(i-3.5)/4) * 0.8)}%` }}
                     ></div>
                   ))}
                </div>
             </div>
             
             {isQuizMode && (
               <div className="bg-gray-50 rounded-3xl p-4 border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-[10px] font-black text-gray-400 uppercase mb-1">Pronunciation Confidence</span>
                  <div className="text-2xl font-black text-blue-600 mb-1">{Math.round(confidence)}%</div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-300 ${confidence > 80 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${confidence}%` }}
                    ></div>
                  </div>
                  {confidence > 0 && (
                    <div className="absolute top-1 right-2 animate-bounce">
                        {confidence > 80 ? '✨' : confidence > 50 ? '👍' : '💬'}
                    </div>
                  )}
               </div>
             )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 px-2 no-scrollbar mb-6">
          {!isActive && !isConnecting && (
            <div className="h-full flex flex-col items-center justify-center text-center p-10">
               <div className="text-8xl mb-6">{isQuizMode ? '🏅' : '🎙️'}</div>
               <h3 className="text-3xl font-black text-gray-800 mb-4">
                  {isQuizMode ? 'Start Oral Quiz!' : 'Ready to practice?'}
               </h3>
               <p className="text-gray-500 font-medium mb-8 max-w-sm">
                  {isQuizMode 
                    ? "The examiner will ask you 5 questions. Remember to answer in FULL SENTENCES to get maximum stars!" 
                    : "Tap the button to start talking with your friendly French AI tutor! They'll help you with your pronunciation."}
               </p>
               <button 
                onClick={startSession}
                className={`text-white px-12 py-5 rounded-3xl font-black text-2xl shadow-xl transition-all hover:scale-105 active:scale-95 ${isQuizMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
               >
                  {isQuizMode ? 'I\'m Ready! ➜' : 'Start Talking! ➜'}
               </button>
            </div>
          )}

          {isConnecting && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-xl font-bold text-blue-600 animate-pulse uppercase tracking-widest">
                 Connecting to {isQuizMode ? 'the Examiner' : 'your Tutor'}...
              </p>
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              {t.user && (
                <div className="flex justify-end">
                   <div className="bg-blue-50 text-blue-800 p-4 rounded-3xl rounded-tr-none max-w-[80%] font-bold shadow-sm border border-blue-100">
                      <span className="text-[10px] uppercase font-black opacity-50 block mb-1">Vous</span>
                      {t.user}
                   </div>
                </div>
              )}
              <div className="flex justify-start">
                 <div className="bg-purple-50 text-purple-800 p-4 rounded-3xl rounded-tl-none max-w-[80%] font-bold shadow-sm border border-purple-100">
                    <span className="text-[10px] uppercase font-black opacity-50 block mb-1">
                       {isQuizMode ? 'Examinateur' : 'Tuteur'}
                    </span>
                    {t.tutor}
                 </div>
              </div>
            </div>
          ))}
          
          {(currentTutorText || currentUserText) && (
            <div className="space-y-2 animate-pulse">
                {currentUserText && (
                    <div className="flex justify-end">
                        <div className="bg-blue-50/50 p-4 rounded-3xl rounded-tr-none max-w-[80%] font-bold italic text-blue-400">
                            {currentUserText}...
                        </div>
                    </div>
                )}
                {currentTutorText && (
                    <div className="flex justify-start">
                        <div className="bg-purple-50/50 p-4 rounded-3xl rounded-tl-none max-w-[80%] font-bold italic text-purple-400">
                            {currentTutorText}...
                        </div>
                    </div>
                )}
            </div>
          )}
        </div>

        {isActive && (
            <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-center">
                <button 
                    onClick={stopSession}
                    className="bg-red-500 text-white px-10 py-4 rounded-3xl font-black text-lg shadow-xl hover:bg-red-600 transition-all active:scale-95 flex items-center gap-3"
                >
                   <span>⏹️</span> Stop Session & Finish
                </button>
            </div>
        )}
      </div>
      <p className="text-center text-gray-400 font-bold text-xs mt-4">
         {isQuizMode 
           ? "The Confidence Meter shows how clearly the AI can understand your French sentences!" 
           : "Your AI Tutor listens for correct French pronunciation and helps you get better!"}
      </p>
    </div>
  );
};

export default SpeakingView;
