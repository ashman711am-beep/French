
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
  return stored ? JSON.parse(stored) : [];
};

export const seedContent = async (subcategory: string, type: string, extraParam?: string): Promise<WordItem[]> => {
  const storageId = extraParam ? `${subcategory}_${extraParam}` : subcategory;
  const existing = getStoredContent(storageId);
  
  const isVerbTense = ['present', 'past', 'future'].includes(subcategory);
  const isArticles = subcategory === 'articles';
  const isAdjectives = subcategory === 'adjectives';
  const isPronouns = subcategory === 'pronouns';
  const isSpeaking = type === 'SPEAKING';
  const limit = (isArticles || isVerbTense || type === 'VOCABULARY' || isSpeaking) ? 50 : 20;
  
  if (existing.length >= limit) return existing;

  const ai = getAI();
  let prompt = "";

  if (isSpeaking) {
    prompt = `Generate a list of exactly 20 French phrases and key vocabulary items related to the speaking topic: "${subcategory}". 
    Focus on conversational phrases a child would use.
    Format: JSON array of objects {french, english, example, exampleEnglish}.`;
  } else if (type === 'GRAMMAR') {
    if (isVerbTense) {
      prompt = `Generate a list of exactly 50 most used French verbs in the ${subcategory} tense. 
      For each verb, provide:
      1. The infinitive (french)
      2. English translation (english)
      3. A simple kid-friendly example sentence (example)
      4. English translation of the example (exampleEnglish)
      5. The full conjugation for all 6 subjects: Je, Tu, Il/Elle/On, Nous, Vous, Ils/Elles.
      Format: JSON array of objects {french, english, example, exampleEnglish, conjugations: [{subject, form}]}.`;
    } else if (isArticles) {
      const targetArticle = extraParam || "le";
      prompt = `Generate exactly 50 common French noun phrases using the article "${targetArticle}". 
      IMPORTANT: The first item in the array MUST be a special "Overview" card for the article "${targetArticle}".
      For the Overview card: 
      - french: "${targetArticle.toUpperCase()}"
      - english: "Grammar Rule: When to use ${targetArticle}"
      - isOverview: true
      - example: "Brief rule explanation in French"
      - exampleEnglish: "Brief rule explanation in English"
      - multipleExamples: [ {text: "Full French example 1", translation: "English 1"}, ... (at least 3) ]

      The following 49 items should be standard noun phrases.
      Format: JSON array of objects {french, english, example, exampleEnglish, isOverview, multipleExamples: [{text, translation}]}.`;
    } else if (isAdjectives) {
      const adjectiveType = extraParam || "General";
      prompt = `Generate exactly 20 French adjectives specifically for the category: "${adjectiveType}".
      IMPORTANT: For each adjective, provide BOTH the masculine and feminine forms.
      Include common, useful words for kids.
      Format: JSON array of objects:
      {
        "french": "Masculine form",
        "feminine": "Feminine form",
        "english": "English translation",
        "example": "Simple sentence using one of the forms",
        "exampleEnglish": "Sentence translation"
      }`;
    } else if (isPronouns) {
      prompt = `Generate exactly 20 French pronouns for kids (subject, object, and possessive).
      Include the basics like "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles" and others like "moi", "toi", "lui".
      Format: JSON array of objects {french, english, example, exampleEnglish}.`;
    } else if (subcategory === 'prepositions') {
      prompt = `Generate a list of 20 French prepositions (sur, sous, dans, devant, etc.) for kids.
      For each item, provide:
      1. The preposition (french)
      2. English translation (english)
      3. A simple example sentence (example)
      4. Translation (exampleEnglish)
      Format: JSON array of objects {french, english, example, exampleEnglish}.`;
    } else {
      prompt = `Generate 20 items for the French grammar topic "${subcategory}". 
      Format: JSON array of objects {french, english, example, exampleEnglish}.`;
    }
  } else {
    prompt = `Generate exactly 50 frequently used French vocabulary items for the subcategory "${subcategory}". 
    Focus on common, essential objects and concepts for children.
    Format: JSON array of objects {french, english, example, exampleEnglish}.`;
  }

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
              french: { type: Type.STRING },
              feminine: { type: Type.STRING },
              english: { type: Type.STRING },
              example: { type: Type.STRING },
              exampleEnglish: { type: Type.STRING },
              articleType: { type: Type.STRING },
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

    const newItems: WordItem[] = JSON.parse(response.text || "[]");
    const updated = [...existing, ...newItems].slice(0, 100);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${storageId}`, JSON.stringify(updated));
    return updated;
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
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
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
    if (error?.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_RESET");
    }
  }
  return null;
};

export const generateQuiz = async (subcategory: string, type: string, difficulty: Difficulty = 'medium'): Promise<QuizQuestion[]> => {
  let content = getStoredContent(subcategory);
  if (content.length === 0) {
    content = await seedContent(subcategory, type);
  }

  const shuffled = [...content].sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 15).map(i => i.french).join(', ');
  
  const ai = getAI();
  const seed = Math.floor(Math.random() * 1000000);

  const prompt = `Create a unique, dynamic French quiz for kids based on the topic: ${subcategory} (${type}).
  Use these specific terms from the curriculum: ${selectedWords}.
  Difficulty: ${difficulty.toUpperCase()}.
  Seed: ${seed}.
  If it is grammar, focus on rules and correct usage in context.
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

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Quiz generation failed", error);
    return [];
  }
};

export const analyzeHistory = async (history: HistoryItem[]): Promise<string> => {
  const ai = getAI();
  const historySummary = history.map(h => `${h.date}: ${h.category}/${h.subcategory} - ${h.score} points`).join('\n');
  
  const prompt = `Analyze this French learning history for a child and provide encouraging, insightful feedback for a parent.
  Highlight:
  1. Consistent strengths.
  2. Areas for improvement.
  3. Learning trends.
  4. Practical tips to help them grow.
  
  History Data:
  ${historySummary}
  
  Keep the tone positive and supportive. Use Markdown for formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "I couldn't generate insights at this time.";
  } catch (error) {
    console.error("History analysis failed", error);
    return "Something went wrong while analyzing the history.";
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
