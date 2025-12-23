
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { Dataset, Hypothesis, ChatMessage } from "../types";

/**
 * Helper to get the AI client.
 */
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Distributed sampling ensures the AI sees data from different parts of a large dataset.
 */
const getRepresentativeSample = (rows: any[], sampleSize: number = 30) => {
  if (rows.length <= sampleSize) return rows;
  const sample = [];
  const step = Math.floor(rows.length / sampleSize);
  for (let i = 0; i < rows.length; i += step) {
    if (sample.length < sampleSize) sample.push(rows[i]);
  }
  return sample;
};

export const profileDataset = async (dataset: Dataset) => {
  const ai = getAIClient();
  const sampleData = JSON.stringify(getRepresentativeSample(dataset.rows, 20));
  const prompt = `
    Analyze this dataset structure for an Organization's Data Science initiative.
    Dataset Name: ${dataset.name}
    Headers: ${dataset.headers.join(', ')}
    Representative Sample: ${sampleData}

    Perform a "Strategic Data Profile":
    1. Identify the core business/scientific domain.
    2. Assess data distribution and potential bias.
    3. Detect anomalies, missingness, or structural issues.
    4. Rank columns by analytical value (High/Medium/Low).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text;
};

export const generateHypotheses = async (dataset: Dataset, profilingInfo: string, userGoal?: string): Promise<Hypothesis[]> => {
  const ai = getAIClient();
  const goalContext = userGoal 
    ? `Objective: "${userGoal}".` 
    : "Objective: General Discovery and Optimization.";

  const prompt = `
    Based on this profile, act as a Council of Data Scientists. 
    Profile: ${profilingInfo}
    Headers: ${dataset.headers.join(', ')}
    ${goalContext}

    Generate 4-5 high-impact, testable hypotheses. 
    Focus on correlation, root-cause analysis, and predictive potential.

    Return the hypotheses as a JSON array.
  `;

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
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["title", "description", "reasoning"]
        }
      }
    }
  });

  const rawJson = JSON.parse(response.text || '[]');
  return rawJson.map((h: any, index: number) => ({
    ...h,
    id: `hyp-${index}`,
    status: 'pending'
  }));
};

export const testHypothesis = async (dataset: Dataset, hypothesis: Hypothesis): Promise<Partial<Hypothesis>> => {
  const ai = getAIClient();
  const sampleData = JSON.stringify(getRepresentativeSample(dataset.rows, 40));
  const prompt = `
    Hypothesis: ${hypothesis.title}
    Context: ${dataset.headers.join(', ')}
    Data Sample (Distributed): ${sampleData}

    Perform a statistical/logic test. 
    1. Does the sample support the hypothesis? Explain why (Finding).
    2. Represent the trend in a structured chart format.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 4000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          finding: { type: Type.STRING },
          chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'scatter'] },
          chartData: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.NUMBER },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              }
            }
          }
        },
        required: ["finding", "chartType", "chartData"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateExecutiveVerdict = async (dataset: Dataset, profile: string, hypotheses: Hypothesis[], userGoal?: string): Promise<string> => {
  const ai = getAIClient();
  const findingsSummary = hypotheses.map(h => `- **${h.title}**: ${h.finding}`).join('\n');
  
  const prompt = `
    Consolidate all findings into a "Council Executive Report".
    Dataset: ${dataset.name}
    Profile: ${profile}
    Test Results: ${findingsSummary}
    Objective: ${userGoal || "Exploratory Analysis"}

    Format: Professional Markdown. Use headings, bold highlights, and a "Strategic Roadmap" section.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 8000 }
    }
  });

  return response.text || "Report generation incomplete.";
};

export const queryCouncil = async (dataset: Dataset, query: string, history: ChatMessage[], profile: string): Promise<string> => {
  const ai = getAIClient();
  const sampleData = JSON.stringify(getRepresentativeSample(dataset.rows, 20));
  const chatHistory = history.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const prompt = `
    You are the DataSage Council (Statistician, Profiler, and Business Strategist).
    Dataset: ${dataset.name}
    Profile: ${profile}
    Sample: ${sampleData}
    History: ${chatHistory}
    Question: ${query}
    
    Answer as a collective intelligence. Be direct and data-driven.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt
  });

  return response.text || "Connection to the Council timed out.";
};

export const transcribeAudio = async (base64Data: string, mimeType: string): Promise<string> => {
  const ai = getAIClient();
  // Fixed: Using the recommended multi-part format for sending audio with a text prompt.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: "Transcribe the following data science request." },
        { inlineData: { data: base64Data, mimeType } }
      ]
    }
  });
  return response.text?.trim() || "";
};

export const generateBriefingAudio = async (text: string) => {
  const ai = getAIClient();
  const prompt = `Deliver this executive report summary with authority and clarity: ${text}`;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const decodeBase64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> => {
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
};
