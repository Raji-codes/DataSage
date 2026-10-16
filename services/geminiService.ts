import { Dataset, Hypothesis, ChatMessage } from '../types';

/**
 * Client-side Gemini service calling server-side API proxy endpoints.
 * Keeps browser free from direct API calls and permissions errors.
 */

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 45000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
};

const handleApiResponse = async (response: Response, defaultErrorMsg: string) => {
  if (!response.ok) {
    let errorDetail = defaultErrorMsg;
    try {
      const data = await response.json();
      if (data.error) {
        errorDetail = data.error;
      }
    } catch {
      // ignore json parse failure
    }
    throw new Error(errorDetail);
  }
  return response.json();
};

export const profileDataset = async (dataset: Dataset): Promise<string> => {
  const res = await fetchWithTimeout('/api/gemini/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset }),
  }, 45000);
  const data = await handleApiResponse(res, 'Failed to profile dataset');
  return data.profile || '';
};

export const generateHypotheses = async (
  dataset: Dataset,
  profilingInfo: string,
  userGoal?: string
): Promise<Hypothesis[]> => {
  const res = await fetchWithTimeout('/api/gemini/hypotheses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, profilingInfo, userGoal }),
  }, 45000);
  const data = await handleApiResponse(res, 'Failed to generate hypotheses');
  return data.hypotheses || [];
};

export const testHypothesis = async (
  dataset: Dataset,
  hypothesis: Hypothesis
): Promise<Partial<Hypothesis>> => {
  const res = await fetchWithTimeout('/api/gemini/test-hypothesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, hypothesis }),
  }, 45000);
  return handleApiResponse(res, 'Failed to test hypothesis');
};

export const generateExecutiveVerdict = async (
  dataset: Dataset,
  profile: string,
  hypotheses: Hypothesis[],
  userGoal?: string
): Promise<string> => {
  const res = await fetchWithTimeout('/api/gemini/verdict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, profile, hypotheses, userGoal }),
  }, 45000);
  const data = await handleApiResponse(res, 'Failed to synthesize executive report');
  return data.summary || '';
};

export const queryCouncil = async (
  dataset: Dataset,
  query: string,
  history: ChatMessage[],
  profile: string
): Promise<string> => {
  const res = await fetchWithTimeout('/api/gemini/query-council', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, query, history, profile }),
  }, 45000);
  const data = await handleApiResponse(res, 'Failed to query council');
  return data.response || 'No response returned from council.';
};

export const transcribeAudio = async (base64Data: string, mimeType: string): Promise<string> => {
  const res = await fetchWithTimeout('/api/gemini/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType }),
  }, 45000);
  const data = await handleApiResponse(res, 'Failed to transcribe audio');
  return data.text || '';
};

export const generateBriefingAudio = async (text: string): Promise<string | undefined> => {
  const res = await fetchWithTimeout('/api/gemini/briefing-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }, 45000);
  const data = await handleApiResponse(res, 'Failed to generate briefing audio');
  return data.audioBase64 || undefined;
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
  numChannels: number = 1
): Promise<AudioBuffer> => {
  // Check if standard WAV header is present (RIFF)
  if (data.length > 44 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    try {
      return await ctx.decodeAudioData(data.buffer.slice(0));
    } catch (e) {
      console.warn('Native WAV decoding failed, falling back to PCM slice', e);
      data = data.slice(44);
    }
  }

  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
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
