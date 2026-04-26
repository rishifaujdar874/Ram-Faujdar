import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

export const ai = new GoogleGenAI({ apiKey });

export enum Model {
  FLASH = "gemini-3-flash-preview",
  TTS = "gemini-3.1-flash-tts-preview",
}
