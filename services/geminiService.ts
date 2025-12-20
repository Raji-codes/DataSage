
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Dataset, Hypothesis } from "../types";

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

export const generateHypotheses = async (dataset: Dataset, profilingInfo: string): Promise<Hypothesis[]> => {
  const prompt = `
    Based on the following data profile, generate 4-5 interesting scientific or business hypotheses to test.
    Profile: ${profilingInfo}
    Headers: ${dataset.headers.join(', ')}

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
  const sampleData = JSON.stringify(dataset.rows.slice(0, 30)); // Give a bit more context for analysis
  const prompt = `
    Hypothesis to test: ${hypothesis.title} - ${hypothesis.description}
    Data Context: ${dataset.headers.join(', ')}
    Partial Data Sample: ${sampleData}

    Act as an Autonomous Data Scientist. 
    1. Analyze the relationship mentioned in the hypothesis based on the provided data sample.
    2. Provide a 'finding' explaining if the data supports it (even if limited to the sample).
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
