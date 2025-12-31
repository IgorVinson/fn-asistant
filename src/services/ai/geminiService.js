import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from "../../../config/config.js";

// Initialize Gemini API
let genAI = null;
let model = null;

const MAX_TEXT_LENGTH = 2000;

function initializeAI() {
  if (CONFIG.AI && CONFIG.AI.ENABLED && CONFIG.AI.API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(CONFIG.AI.API_KEY);
      model = genAI.getGenerativeModel({ model: CONFIG.AI.MODEL });
    } catch (error) {
      console.error("Failed to initialize Gemini AI:", error);
    }
  }
}

function normalizeTextForAI(text, maxLength = MAX_TEXT_LENGTH) {
  if (typeof text !== "string") {
    return text;
  }

  const withoutScripts = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutStyles.replace(/<[^>]+>/g, " ");
  const collapsed = withoutTags.replace(/\s+/g, " ").trim();

  if (collapsed.length <= maxLength) {
    return collapsed;
  }

  return collapsed.slice(0, maxLength);
}

function buildAiPayload(rawData) {
  if (!rawData || typeof rawData !== "object") {
    return rawData;
  }

  return {
    platform: rawData.platform || null,
    id: rawData.id || null,
    company: rawData.company || null,
    title: rawData.title || null,
    schedule: {
      start: rawData.time?.start || null,
      end: rawData.time?.end || null,
      date: rawData.date || null,
      time: typeof rawData.time === "string" ? rawData.time : null,
    },
    pay: {
      range: rawData.payRange || null,
      hourlyRate: rawData.hourlyRate || null,
      totalPayment: rawData.totalPayment || null,
      originalAmount: rawData.originalAmount || null,
    },
    hours: {
      estLaborHours: rawData.estLaborHours || null,
      hoursOfWork: rawData.hoursOfWork || null,
    },
    distance: rawData.distance || null,
    description: normalizeTextForAI(rawData.description),
    text: normalizeTextForAI(rawData.text),
  };
}

export async function normalizeDataWithAI(rawData) {
  // Lazy initialization
  if (!genAI) {
    initializeAI();
  }

  if (!genAI || !model) {
    console.warn("AI service not initialized or disabled. Skipping AI normalization.");
    return null;
  }

  try {
    const aiPayload = buildAiPayload(rawData);
    const prompt = `
      You are an AI assistant that extracts structured data from work order texts.
      
      Your GOAL is to find the ACTUAL estimated labor hours.
      
      INPUT DATA ANALYSIS:
      1. Check structured hours fields in the provided JSON. For FieldNation these are under "hours.estLaborHours".
         For WorkMarket these are typically under "hours.hoursOfWork".
      2. If these fields are greater than 0, use that value.
      3. IF AND ONLY IF the structured hours are 0, missing, or null:
         - YOU MUST SEARCH THE "description" or "text" fields.
         - Look for specific phrases indicating duration, such as:
           - "1hr allotted"
           - "2 hours allotted"
           - "estimated time: 90 minutes"
           - "allow 3 hours"
         - EXTRACT that duration as a number (e.g., 1, 1.5, 2).
      
      WARNINGS:
      - The difference between start time and end time is the SERVICE WINDOW. This is NOT the labor duration.
      - NEVER return the service window duration unless the text explicitly says "Job takes full window".
      - If structured hours are 0 and you find NO duration in the text, return 0.
      
      Fields to extract:
      - estLaborHours: The extracted number based on the logic above.
      - startTime: ISO 8601 encoded string.
      - endTime: ISO 8601 encoded string.
      - payAmount: total payment amount.
      - isWorkMarket: boolean.
      
      Return ONLY valid JSON.
      
      Raw Data:
      ${JSON.stringify(aiPayload, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Error in AI normalization:", error);
    return null;
  }
}
