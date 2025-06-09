
// import { GoogleGenAI, GenerateContentResponse } from "@google/genai"; // AI Disabled

// let ai: GoogleGenAI | null = null; // AI Disabled

/* // AI Disabled
const initializeAi = () => {
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) 
                 ? process.env.API_KEY 
                 : null;

  if (apiKey) {
    try {
      ai = new GoogleGenAI({ apiKey: apiKey });
    } catch (error) {
      console.error("Failed to initialize GoogleGenAI:", error);
      ai = null; 
    }
  } else {
    console.warn("API_KEY environment variable is not set or accessible. Gemini API features will be disabled.");
    ai = null;
  }
};

initializeAi();
*/

// const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)); // Not needed if AI is disabled

/* // AI Disabled
const extractBaseNameForPrompt = (fileName: string): string => {
  let baseName = fileName;
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex > 0) {
    baseName = fileName.substring(0, lastDotIndex);
  }
  return baseName.replace(/[^\w\s-]/gi, '').substring(0, 50); 
};
*/

export const suggestStickerName = async (originalFileName: string): Promise<string> => {
  // AI Naming is disabled. Always return an empty string immediately.
  // This ensures that any part of the application still calling this
  // will get a non-AI name behavior.
  console.log(`AI Naming for "${originalFileName}" is disabled. Returning empty suggestion.`);
  return Promise.resolve(""); 
};
