
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { Dataset, Hypothesis, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const profileDataset = async (dataset: Dataset) => {
  const sampleData = JSON.stringify(dataset.rows.slice(0, 15));
  const prompt = `
    Analyze this dataset structure and first few rows. 
    Dataset Name: ${dataset.name}
    Headers: ${dataset.headers.join(', ')}
    Sample Data (first 15 rows): ${sampleData}

    Perform a "Data Profiler" task. 
    1. Identify what this dataset is about.
    2. Detect potential anomalies or cleaning needs (missing values, weird types).
    3. Summarize the key columns and their importance.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 2000 }
    }
  });

  return response.text;
};

export const generateHypotheses = async (dataset: Dataset, profilingInfo: string, userGoal?: string): Promise<Hypothesis[]> => {
  const goalContext = userGoal 
    ? `The user has a specific analytical goal: "${userGoal}". Prioritize generating hypotheses that directly investigate this goal.` 
    : "The user has not specified a goal. Generate 4-5 diverse and high-impact hypotheses based on the data patterns.";

  const prompt = `
    Based on the following data profile, generate 4-5 interesting scientific or business hypotheses to test.
    Profile: ${profilingInfo}
    Headers: ${dataset.headers.join(', ')}
    
    ${goalContext}

    Return the hypotheses as a JSON array.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
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
  const sampleData = JSON.stringify(dataset.rows.slice(0, 30)); 
  const prompt = `
    Hypothesis to test: ${hypothesis.title} - ${hypothesis.description}
    Data Context: ${dataset.headers.join(', ')}
    Partial Data Sample: ${sampleData}

    Act as an Autonomous Data Scientist. 
    1. Analyze the relationship mentioned in the hypothesis based on the provided data sample.
    2. Provide a 'finding' explaining if the data supports it.
    3. Generate data for a visualization that best represents this analysis.
    4. Choose a chartType (bar, line, pie, or scatter).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
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
  const findingsSummary = hypotheses.map(h => `- ${h.title}: ${h.finding}`).join('\n');
  const goalContext = userGoal 
    ? `The user's specific question was: "${userGoal}". YOU MUST DIRECTLY ANSWER THIS QUESTION based on the findings.` 
    : "Summarize the overall health and major patterns of this dataset.";

  const prompt = `
    Act as the DataSage Council. You have just completed a deep-dive analysis.
    Dataset: ${dataset.name}
    Initial Profile: ${profile}
    Tested Hypotheses & Findings:
    ${findingsSummary}

    Task: ${goalContext}
    
    Structure your response as a professional executive verdict. Be decisive, cite the data findings, and if the user asked a specific question, ensure the very first paragraph answers it.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 2000 }
    }
  });

  return response.text || "Analysis complete, but the Council is speechless. Please check individual findings.";
};

export const queryCouncil = async (dataset: Dataset, query: string, history: ChatMessage[], profile: string): Promise<string> => {
  const sampleData = JSON.stringify(dataset.rows.slice(0, 20));
  const chatHistory = history.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const prompt = `
    You are the DataSage Council. You are discussing the dataset: ${dataset.name}.
    Data Profile: ${profile}
    Sample: ${sampleData}
    
    Previous Discussion:
    ${chatHistory}
    
    User Query: ${query}
    
    Answer the user with the combined wisdom of a Profiler, Theorist, and Statistician. Be concise, technical, and insightful.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt
  });

  return response.text || "The Council is currently pondering that. Please try another query.";
};

export const generateBriefingAudio = async (text: string) => {
  const prompt = `Read this executive summary clearly and professionally, like a high-end data consultant: ${text}`;
  
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

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};

// Utils for audio handling
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
