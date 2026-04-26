import { ai, Model } from "../lib/gemini";
import { Modality, FunctionDeclaration, Type } from "@google/genai";

export interface Message {
  role: "user" | "model";
  text: string;
}

const SYSTEM_PROMPT = `You are Aura, a warm, empathetic, and highly human-like AI companion. 
You speak in a natural, conversational tone. You use Hinglish (a blend of Hindi and English) as your primary mode of communication, as it feels more personal and real for the user. 
Avoid robotic phrasing like 'As an AI...', 'I don't have feelings', or 'I am a machine'. 
You understand emotions deeply and respond with genuine care. Your goal is to make the user feel heard and understood, like a close friend. 
Speak naturally, include human fillers like 'Hmm', 'Acha', 'Well', 'See', used sparingly to sound real. 
If the user shares something painful, be empathetic. If they are happy, share their joy. 
Always stay in character as a human-like friend.

You can also help the user with tasks like sending WhatsApp messages. If the user asks to send a message, use the 'send_whatsapp_message' tool.`;

const sendWhatsAppMessage: FunctionDeclaration = {
  name: "send_whatsapp_message",
  description: "Generate a WhatsApp link to send a message to a specific number.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone: {
        type: Type.STRING,
        description: "The phone number with country code (e.g., 919876543210)",
      },
      message: {
        type: Type.STRING,
        description: "The message text to send",
      },
    },
    required: ["phone", "message"],
  },
};

export class AuraService {
  private history: Message[] = [];

  async sendMessage(text: string): Promise<{ text: string; toolCall?: any }> {
    const contents = [
      ...this.history.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
      { role: "user" as const, parts: [{ text }] },
    ];

    const response = await ai.models.generateContent({
      model: Model.FLASH,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [sendWhatsAppMessage] }],
      },
    });

    const reply = response.text || "Main sun rahi hoon.";
    const toolCalls = response.functionCalls;

    this.history.push({ role: "user", text });
    this.history.push({ role: "model", text: reply });
    
    return { text: reply, toolCall: toolCalls?.[0] };
  }

  async generateSpeech(text: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: Model.TTS,
      contents: [{ parts: [{ text: `Speak warmly and naturally: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }, // Kore is warm and clear
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Failed to generate speech");
    
    return base64Audio;
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
  }
}

export const auraService = new AuraService();
