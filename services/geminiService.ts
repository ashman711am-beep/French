
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordItem, QuizQuestion, Difficulty, HistoryItem } from '../types';

// Helper to get a fresh AI instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const STORAGE_KEY_PREFIX = 'petits_content_';
const DB_NAME = 'PetitFrancaisImages';
const STORE_NAME = 'illustrations';

/**
 * IndexedDB Wrapper for large image storage
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getStoredImage = async (word: string): Promise<string | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(word);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const saveStoredImage = async (word: string, base64: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(base64, word);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

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
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Corrupt local storage for", subId);
    return [];
  }
};

export const seedContent = async (subcategory: string, type: string, extraParam?: string): Promise<WordItem[]> => {
  const storageId = extraParam ? `${subcategory}_${extraParam}` : subcategory;
  const existing = getStoredContent(storageId);
  
  const isVerbTense = ['present', 'past', 'future'].includes(subcategory);
  const isArticles = subcategory === 'articles';
  const isAdjectives = subcategory === 'adjectives';
  const isPronouns = subcategory === 'pronouns';
  const isSpeaking = type === 'SPEAKING';
  
  // Adjusted limits: Verbs are "heavy" due to conjugations, so we request fewer per batch
  const limit = isVerbTense ? 12 : 15;
  
  if (existing.length >= limit) return existing;

  const ai = getAI();
  let prompt = "";

  const commonConstraints = "Keep examples and translations extremely short (under 5 words). Do not include unnecessary text.";

  if (isSpeaking) {
    prompt = `Generate exactly 15 French phrases for kids about: "${subcategory}". 
    Include simplified "phonetic" pronunciation. ${commonConstraints}
    Format: JSON array of objects {french, english, example, exampleEnglish, phonetic}.`;
  } else if (type === 'GRAMMAR') {
    if (isVerbTense) {
      prompt = `Generate exactly 12 common French verbs in "${subcategory}" tense. 
      Include "phonetic" for infinitive. ${commonConstraints}
      For each: infinitive (french), English (english), 6 subject conjugations (Je, Tu, Il/Elle/On, Nous, Vous, Ils/Elles).
      Format: JSON array of objects {french, english, example, exampleEnglish, phonetic, conjugations: [{subject, form}]}.`;
    } else if (isArticles) {
      const targetArticle = extraParam || "le";
      prompt = `Generate exactly 15 French noun phrases with "${targetArticle}". 
      Item 1 must be an "Overview" card. ${commonConstraints}
      Format: JSON array of objects {french, english, example, exampleEnglish, phonetic, isOverview, multipleExamples: [{text, translation}]}.`;
    } else if (isAdjectives) {
      prompt = `Generate exactly 15 French adjectives for: "${extraParam || "General"}".
      Provide masculine (french) and feminine forms. ${commonConstraints}
      Format: JSON array of objects: {french, feminine, english, example, exampleEnglish, phonetic}.`;
    } else {
      prompt = `Generate 15 French grammar items for "${subcategory}". ${commonConstraints}
      Format: JSON array of objects {french, english, example, exampleEnglish, phonetic}.`;
    }
  } else {
    prompt = `Generate exactly 15 essential French vocabulary items for "${subcategory}". 
    Include simplified child-friendly phonetic guide. ${commonConstraints}
    Format: JSON array of objects {french, english, example, exampleEnglish, phonetic}.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 6000, // Reduced to prevent truncation while ensuring complete JSON
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              french: { type: Type.STRING },
              feminine: { type: Type.STRING },
              english: { type: Type.STRING },
              example: { type: Type.STRING },
              exampleEnglish: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              isOverview: { type: Type.BOOLEAN },
              multipleExamples: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    translation: { type: Type.STRING }
                  },
                  required: ["text", "translation"]
                }
              },
              conjugations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    form: { type: Type.STRING }
                  },
                  required: ["subject", "form"]
                }
              }
            },
            required: ["french", "english", "example", "exampleEnglish"]
          }
        }
      }
    });

    const rawText = response.text || "[]";
    // Robust cleanup to handle common API formatting issues
    const cleanedText = rawText.trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
    
    try {
      const newItems: WordItem[] = JSON.parse(cleanedText);
      const updated = [...existing, ...newItems].slice(0, 40);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${storageId}`, JSON.stringify(updated));
      return updated;
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON output:", parseError, "Cleaned text length:", cleanedText.length);
      return existing;
    }
  } catch (error) {
    console.error("Seeding failed", error);
    return existing;
  }
};

export const generateEducationalImage = async (word: string, meaning: string, isOverview: boolean = false): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = isOverview 
    ? `A colorful, educational infographic style illustration for children representing the French grammatical concept of the article "${word}". Show multiple objects that use this article to help a child visualize the rule. Bright, clear, storybook style. No text except maybe the word "${word}" if necessary.`
    : `A clear, high-quality educational illustration for children explaining the French word "${word}" which means "${meaning}". The illustration should be simple, bright, and clearly depict the object or concept to help a child learn and remember the word. Avoid text in the image. Professional storybook style.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error: any) {
    console.error("Image generation failed", error);
    const errorMessage = error?.message || "";
    if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("API key not valid")) {
      throw new Error("API_KEY_RESET");
    }
    if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
      throw new Error("QUOTA_EXHAUSTED");
    }
    throw error;
  }
  return null;
};

export const generateQuiz = async (subcategory: string, type: string, difficulty: Difficulty = 'medium'): Promise<QuizQuestion[]> => {
  let content = getStoredContent(subcategory);
  if (content.length === 0) {
    content = await seedContent(subcategory, type);
  }

  const shuffled = [...content].sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 8).map(i => i.french).join(', ');
  
  const ai = getAI();
  const seed = Math.floor(Math.random() * 1000000);

  const prompt = `Create a unique French quiz for kids. Topic: ${subcategory}. 
  Words: ${selectedWords}. Difficulty: ${difficulty.toUpperCase()}. Seed: ${seed}.
  Return JSON array of 5 objects {question, options, correctAnswer, explanation}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 3000,
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

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Quiz generation failed", error);
    return [];
  }
};

export const analyzeHistory = async (history: HistoryItem[]): Promise<string> => {
  const ai = getAI();
  const historySummary = history.map(h => `${h.date}: ${h.category}/${h.subcategory} - ${h.score} points`).join('\n');
  
  const prompt = `Analyze this French learning history for a child and provide encouraging feedback.
  History:
  ${historySummary}
  Keep it positive and short. Use Markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        maxOutputTokens: 2000
      }
    });
    return response.text || "I couldn't generate insights at this time.";
  } catch (error) {
    console.error("History analysis failed", error);
    return "Something went wrong while analyzing the history.";
  }
};

export const playPronunciation = async (text: string, slow: boolean = false) => {
  const ai = getAI();
  const speedText = slow ? "very slowly" : "clearly";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say this ${speedText} for a child: ${text}` }] }],
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
