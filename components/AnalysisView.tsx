
import React, { useState, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Hypothesis, ChatMessage, Dataset } from '../types';
import { generateBriefingAudio, decodeBase64ToUint8Array, decodeAudioData, transcribeAudio } from '../services/geminiService';

interface AnalysisViewProps {
  dataset: Dataset;
  hypotheses: Hypothesis[];
  summary: string;
  chat: ChatMessage[];
  onSendMessage: (msg: string) => void;
  isProcessingChat: boolean;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const AnalysisView: React.FC<AnalysisViewProps> = ({ dataset, hypotheses, summary, chat, onSendMessage, isProcessingChat }) => {
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          try {
            const transcription = await transcribeAudio(base64Audio, 'audio/webm');
            if (transcription) {
              setChatInput(prev => prev ? `${prev} ${transcription}` : transcription);
            }
          } catch (error) {
            console.error("Transcription failed", error);
          } finally {
            setIsTranscribing(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied", error);
    }
  };

  const playBriefing = async () => {
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    try {
      setIsAudioLoading(true);
      const base64 = await generateBriefingAudio(summary);
      if (!base64) throw new Error("Audio generation failed");

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioData = decodeBase64ToUint8Array(base64);
      const buffer = await decodeAudioData(audioData, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      
      sourceNodeRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio error:", err);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessingChat) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const isComplete = summary.length > 0;

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Verdict Section */}
      <div className={`bg-white p-8 rounded-[2rem] shadow-xl border-2 transition-all duration-1000 ${
        isComplete ? 'border-indigo-100' : 'border-slate-100'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-colors duration-1000 ${
               isComplete ? 'bg-indigo-600' : 'bg-slate-300'
             }`}>
               <i className={`fas ${isComplete ? 'fa-gavel' : 'fa-brain'}`}></i>
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-900 leading-none">
                  {isComplete ? "The Council's Verdict" : "Reasoning in Progress..."}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Final Synthesis & Objective Resolution
                </p>
             </div>
          </div>
          
          {isComplete && (
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleCopy}
                className="p-2.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
                title="Copy Report to Clipboard"
              >
                <i className={`fas ${copied ? 'fa-check text-green-600' : 'fa-copy'}`}></i>
              </button>
              <button 
                onClick={playBriefing}
                disabled={isAudioLoading}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-full transition-all ${
                  isPlaying ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                } hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm`}
              >
                {isAudioLoading ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : isPlaying ? (
                  <i className="fas fa-stop"></i>
                ) : (
                  <i className="fas fa-volume-up"></i>
                )}
                <span className="text-xs font-black uppercase tracking-wider">
                  {isPlaying ? 'Stop' : isAudioLoading ? 'Synthesizing...' : 'Hear Audio Briefing'}
                </span>
              </button>
            </div>
          )}
        </div>
        
        {isPlaying && (
          <div className="flex items-end space-x-1.5 h-12 mb-6 px-4 bg-indigo-50/30 rounded-2xl border border-indigo-50 items-center justify-center">
            {[...Array(24)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-indigo-500 rounded-full animate-pulse" 
                style={{ 
                  height: `${20 + Math.random() * 60}%`, 
                  animationDelay: `${i * 0.05}s`,
                  animationDuration: `${0.5 + Math.random()}s`
                }}
              ></div>
            ))}
          </div>
        )}

        <div className={`prose prose-indigo max-w-none text-slate-600 leading-relaxed whitespace-pre-wrap transition-opacity duration-1000 ${
          isComplete ? 'opacity-100' : 'opacity-40 animate-pulse'
        }`}>
          {summary || "The Council of Agents is currently synthesizing all findings to provide a final answer to your mission objective..."}
        </div>
      </div>

      {/* Hypotheses Grid */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center">
          <span className="w-8 h-[2px] bg-slate-200 mr-3"></span>
          Supporting Evidence & Tests
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hypotheses.map((h) => (
            <div key={h.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm ${
                      h.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {h.status}
                    </span>
                    {h.status === 'completed' && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-1 rounded shadow-sm">
                        Tested
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{h.title}</h3>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${h.status === 'completed' ? 'text-green-500 bg-green-50' : 'text-amber-500 bg-amber-50'}`}>
                  <i className={`fas ${h.status === 'completed' ? 'fa-check-circle' : 'fa-spinner fa-spin'}`}></i>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 mb-6 italic border-l-2 border-slate-100 pl-3">"{h.description}"</p>

              {h.chartData && h.status === 'completed' && (
                <div className="h-56 w-full mb-6 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
                  <ResponsiveContainer width="100%" height="100%">
                    {h.chartType === 'bar' ? (
                      <BarChart data={h.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : h.chartType === 'line' ? (
                      <LineChart data={h.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : h.chartType === 'pie' ? (
                      <PieChart>
                        <Pie
                          data={h.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {h.chartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    ) : (
                      <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" dataKey="x" name="X" fontSize={10} />
                        <YAxis type="number" dataKey="y" name="Y" fontSize={10} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Data Points" data={h.chartData} fill="#4f46e5" />
                      </ScatterChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-auto">
                <div className="flex items-center space-x-2 mb-2">
                   <i className="fas fa-lightbulb text-amber-500 text-[10px]"></i>
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statistical Finding</h4>
                </div>
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 leading-snug font-medium">
                  {h.finding || "Analysis in progress..."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Council Chat */}
      {isComplete && (
        <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
             <i className="fas fa-comments text-9xl"></i>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h2 className="text-2xl font-black mb-1 flex items-center">
                    <i className="fas fa-comment-dots mr-3 text-indigo-400"></i>
                    Deep Dive Inquiry
                  </h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Interrogate the Council on these findings</p>
               </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto mb-8 scrollbar-hide pr-2">
              {chat.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-600">
                     <i className="fas fa-question text-2xl"></i>
                  </div>
                  <p className="text-slate-500 italic text-sm">The Council has finished the primary mission. What else should we investigate?</p>
                </div>
              )}
              {chat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-5 rounded-3xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-900/40' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                  }`}>
                    <p className="font-black text-[9px] uppercase tracking-[0.2em] mb-2 opacity-40">
                      {msg.role === 'user' ? 'Investigator' : 'The Council'}
                    </p>
                    {msg.content}
                  </div>
                </div>
              ))}
              {(isProcessingChat || isTranscribing) && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 p-5 rounded-3xl rounded-bl-none border border-slate-700">
                    <div className="flex space-x-2">
                      <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce"></div>
                      <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                    {isTranscribing && (
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Listening to your voice...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitChat} className="flex space-x-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50">
              <button 
                type="button"
                onClick={toggleRecording}
                disabled={isProcessingChat || isTranscribing}
                className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
              </button>
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isTranscribing ? "Transcribing..." : "Ask for more details, another chart, or a new theory..."}
                className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none transition-all text-white placeholder-slate-500"
              />
              <button 
                type="submit"
                disabled={isProcessingChat || !chatInput.trim() || isTranscribing}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-8 py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center space-x-2"
              >
                <span className="font-black text-xs uppercase tracking-widest">Inquire</span>
                <i className="fas fa-arrow-right"></i>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
