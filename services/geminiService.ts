
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordItem, QuizQuestion, Difficulty, HistoryItem } from '../types';

// Helper to get a fresh AI instance (useful for key selection flow)
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const STORAGE_KEY_PREFIX = 'petits_content_';

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

export const getStoredContent = (subId: string): WordItem[] => {
  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${subId}`);
  return stored ? JSON.parse(stored) : [];
};

export const seedContent = async (subcategory: string, type: string): Promise<WordItem[]> => {
  const existing = getStoredContent(subcategory);
  if (existing.length >= 100) return existing;

  const ai = getAI();
  const prompt = `Generate exactly 20 frequently used French ${type.toLowerCase()} items for the subcategory "${subcategory}". 
  Focus on common objects/concepts for children.
  Format: JSON array of objects {french, english, example, exampleEnglish}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-latest', // Fast response
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              french: { type: Type.STRING },
              english: { type: Type.STRING },
              example: { type: Type.STRING },
              exampleEnglish: { type: Type.STRING },
            },
            required: ["french", "english", "example", "exampleEnglish"]
          }
        }
      }
    });

    const newItems: WordItem[] = JSON.parse(response.text);
    const updated = [...existing, ...newItems].slice(0, 100);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${subcategory}`, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error("Seeding failed", error);
    return existing;
  }
};

export const generateQuiz = async (subcategory: string, type: string, difficulty: Difficulty = 'medium'): Promise<QuizQuestion[]> => {
  let content = getStoredContent(subcategory);
  if (content.length === 0) {
    content = await seedContent(subcategory, type);
  }

  // Shuffle content to ensure dynamic question generation every time
  const shuffled = [...content].sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 15).map(i => i.french).join(', ');
  
  const ai = getAI();
  const seed = Math.floor(Math.random() * 1000000);

  const prompt = `Create a unique, dynamic French quiz for kids using these words: ${selectedWords}.
  Difficulty: ${difficulty.toUpperCase()}.
  Seed: ${seed} (Ensure questions are different from previous attempts).
  Return JSON array of objects {question, options, correctAnswer, explanation}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Quiz generation failed", error);
    return [];
  }
};

export const getFunFact = async (word: string) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find a fun, kid-friendly cultural fact or usage fact about the French word "${word}". Use Google Search for accuracy.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || 'Source',
      uri: chunk.web?.uri
    })).filter((s: any) => s.uri) || [];

    return {
      text: response.text,
      sources
    };
  } catch (error) {
    console.error("Fun fact fetch failed", error);
    return null;
  }
};

export const analyzeHistory = async (history: HistoryItem[]): Promise<string> => {
  const ai = getAI();
  const historySummary = history.map(h => `${h.date}: ${h.category}/${h.subcategory} - ${h.score} points`).join('\n');
  
  const prompt = `Analyze this French learning history for a child and provide encouraging, insightful feedback for a parent.
  Highlight:
  1. Consistent strengths (where they score high or participate most).
  2. Areas for improvement (where they struggle or have low frequency).
  3. Learning trends (improvement over time, variety of subjects).
  4. Practical tips to help them grow.
  
  History Data:
  ${historySummary}
  
  Keep the tone positive, professional, and supportive. Use Markdown for formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "I couldn't generate insights at this time. Keep learning to provide more data!";
  } catch (error) {
    console.error("History analysis failed", error);
    return "Something went wrong while analyzing the history. Please try again later.";
  }
};

export const generateMagicImage = async (prompt: string, size: '1K' | '2K' | '4K' = '1K') => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `A vibrant, high-quality, kid-friendly illustration of: ${prompt}. Artistic style: 3D render, Pixar-like, bright colors.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: size
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    if (error?.message?.includes("entity was not found")) {
      throw new Error("KEY_RESET");
    }
    throw error;
  }
};

export const playPronunciation = async (text: string) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say this clearly for a child: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1,
      );
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (e) {
    console.error("TTS failed", e);
  }
};
