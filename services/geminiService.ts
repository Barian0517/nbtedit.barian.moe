import { GoogleGenAI } from "@google/genai";
import { NBTTag, TagType } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Helper to serialize BigInt for JSON stringify
  private stringifyNBT(tag: NBTTag): string {
    return JSON.stringify(tag, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n';
      }
      return value;
    });
  }

  async explainTag(tag: NBTTag): Promise<string> {
    try {
      // Limit context size to avoid massive payloads for huge NBT files
      const context = this.stringifyNBT(tag).substring(0, 10000); 
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
          You are an expert Minecraft technical analyst.
          Analyze the following NBT (Named Binary Tag) data structure.
          Explain what this tag likely represents in the context of Minecraft (e.g., player inventory, level data, item attributes).
          Be concise and specific.
          
          Data:
          ${context}
        `,
        config: {
            systemInstruction: "You are a helpful assistant for a Minecraft NBT Editor tool.",
        }
      });
      
      return response.text || "Could not generate explanation.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Error connecting to AI assistant. Please check your API key or try again later.";
    }
  }
}

export const geminiService = new GeminiService();