
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordItem, QuizQuestion } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateLessons = async (subcategory: string, type: 'VOCABULARY' | 'GRAMMAR'): Promise<WordItem[]> => {
  const prompt = `Generate 5 essential French ${type.toLowerCase()} items for the subcategory "${subcategory}" suitable for kids. 
  Include the French word, English translation, a simple example sentence in French, and its English translation.
  Return as a JSON array.`;

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
            english: { type: Type.STRING },
            example: { type: Type.STRING },
            exampleEnglish: { type: Type.STRING },
          },
          required: ["french", "english", "example", "exampleEnglish"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateQuiz = async (subcategory: string, type: 'VOCABULARY' | 'GRAMMAR'): Promise<QuizQuestion[]> => {
  const prompt = `Generate 5 multiple choice questions for kids to test their knowledge of French ${type.toLowerCase()} in the "${subcategory}" category.
  Make it fun and simple. Return as a JSON array of objects with question, options (array of 4), correctAnswer, and a short fun explanation.`;

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
};

export const playPronunciation = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Pronounce clearly in French: ${text}` }] }],
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
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (error) {
    console.error("Error playing audio:", error);
  }
};
