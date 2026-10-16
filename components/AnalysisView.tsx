import React, { useState, useRef, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  ScatterChart, 
  Scatter 
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { Hypothesis, ChatMessage, Dataset } from '../types';
import { generateBriefingAudio, decodeBase64ToUint8Array, decodeAudioData, transcribeAudio } from '../services/geminiService';
import { encryptData } from '../services/securityService';

interface AnalysisViewProps {
  dataset: Dataset;
  hypotheses: Hypothesis[];
  summary: string;
  chat: ChatMessage[];
  onSendMessage: (msg: string) => void;
  isProcessingChat: boolean;
  logs?: string[];
}

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export const AnalysisView: React.FC<AnalysisViewProps> = ({ 
  dataset, 
  hypotheses, 
  summary, 
  chat, 
  onSendMessage, 
  isProcessingChat,
  logs = []
}) => {
  const [activeTab, setActiveTab] = useState<'verdict' | 'hypotheses' | 'data' | 'audit' | 'chat'>('verdict');
  const [hypothesisFilter, setHypothesisFilter] = useState<'all' | 'completed' | 'inconclusive'>('all');
  
  // Audio state
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Interactive Chat state
  const [chatInput, setChatInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Encryption state
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [encryptPassword, setEncryptPassword] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Raw data table pagination & search
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const isComplete = summary.length > 0;

  // Filtered rows for data explorer
  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return dataset.rows;
    const term = tableSearch.toLowerCase();
    return dataset.rows.filter(row => 
      Object.values(row).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      )
    );
  }, [dataset.rows, tableSearch]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage]);

  // Filtered hypotheses
  const displayedHypotheses = useMemo(() => {
    if (hypothesisFilter === 'completed') {
      return hypotheses.filter(h => h.status === 'completed');
    }
    if (hypothesisFilter === 'inconclusive') {
      return hypotheses.filter(h => h.status === 'failed' || h.status === 'pending');
    }
    return hypotheses;
  }, [hypotheses, hypothesisFilter]);

  const handleSecureExport = async () => {
    if (!encryptPassword) return;
    setIsEncrypting(true);
    try {
      const payload = JSON.stringify({ summary, hypotheses, timestamp: new Date(), dataset: dataset.name });
      const encrypted = await encryptData(payload, encryptPassword);
      
      const blob = new Blob([encrypted], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.name.replace(/\.[^/.]+$/, "")}_audit_report.sage`;
      a.click();
      setShowEncryptModal(false);
      setEncryptPassword('');
    } catch (e) {
      console.error("Encryption failed", e);
    } finally {
      setIsEncrypting(false);
    }
  };

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
      console.error("Audio briefing error:", err);
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

  const quickQuestions = [
    "What is the most statistically significant variable?",
    "Summarize the key operational takeaways in 3 bullet points.",
    "Are there potential confounding factors or sampling biases?"
  ];

  return (
    <div className="space-y-6">
      {/* Workspace Navigation Bar */}
      <div className="glass-panel glass-specular rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-4 backdrop-blur-xl">
        <div className="glass-pill p-1 rounded-xl flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('verdict')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'verdict'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            Executive Briefing
          </button>
          <button
            onClick={() => setActiveTab('hypotheses')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'hypotheses'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <span>Hypotheses & Tests</span>
            <span className="font-mono text-[11px] opacity-75">({hypotheses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'data'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            Data Explorer
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            Agent Audit Trail
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <span>Inquiry Console</span>
            {chat.length > 0 && (
              <span className="font-mono text-[11px] opacity-75">({chat.length})</span>
            )}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isComplete && (
            <>
              <button 
                onClick={playBriefing}
                disabled={isAudioLoading}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all backdrop-blur-md ${
                  isPlaying 
                    ? 'border-rose-300 bg-rose-50 text-rose-700 shadow-[0_0_12px_rgba(244,63,94,0.2)]' 
                    : 'glass-pill hover:bg-white text-slate-700 shadow-xs'
                }`}
                title="Synthesize audio narration of findings"
              >
                {isAudioLoading ? (
                  <i className="fas fa-circle-notch fa-spin text-xs"></i>
                ) : isPlaying ? (
                  <i className="fas fa-stop text-xs"></i>
                ) : (
                  <i className="fas fa-volume-high text-xs text-blue-600"></i>
                )}
                <span>{isPlaying ? 'Stop Audio' : isAudioLoading ? 'Synthesizing...' : 'Audio Briefing'}</span>
              </button>

              <button 
                onClick={handleCopy}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border glass-pill hover:bg-white text-slate-700 flex items-center gap-1.5 transition-all shadow-xs"
                title="Copy markdown briefing"
              >
                <i className={`fas ${copied ? 'fa-check text-emerald-600' : 'fa-copy text-slate-500'} text-xs`}></i>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button 
                onClick={() => setShowEncryptModal(true)}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white flex items-center gap-1.5 transition-all shadow-sm border border-white/20"
                title="Generate encrypted .sage artifact"
              >
                <i className="fas fa-shield-halved text-xs text-blue-400"></i>
                <span>Export (.sage)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: EXECUTIVE BRIEFING */}
      {activeTab === 'verdict' && (
        <div className="space-y-6">
          {/* Audio Player Active Waveform Indicator */}
          {isPlaying && (
            <div className="glass-dark glass-specular text-white p-4 rounded-2xl flex items-center justify-between border border-white/10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>
                <span className="text-xs font-semibold tracking-wide">DataSage Audio Briefing Active (Sample Rate 24kHz)</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[...Array(16)].map((_, i) => (
                  <span 
                    key={i} 
                    className="w-1 bg-gradient-to-t from-blue-400 to-indigo-300 rounded-full animate-pulse"
                    style={{ 
                      height: `${12 + (i % 4) * 6}px`, 
                      animationDelay: `${i * 0.08}s` 
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main Executive Report Card */}
          <div className="glass-card glass-specular rounded-2xl p-6 sm:p-8 backdrop-blur-xl">
            <div className="border-b border-slate-200/60 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50/80 border border-blue-200/80 text-blue-700 text-[11px] font-semibold mb-2">
                  <i className="fas fa-award text-[10px]"></i>
                  <span>Autonomous Synthesis</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isComplete ? "Executive Synthesis & Statistical Verdict" : "Investigative Analysis in Progress"}
                </h2>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>Dataset: <span className="font-mono font-medium text-slate-700">{dataset.name}</span></span>
                  <span>·</span>
                  <span>Evaluated against {hypotheses.length} candidate hypotheses</span>
                </div>
              </div>

              <div className="text-xs font-mono">
                {isComplete ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-400/30 font-semibold shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Empirically Validated</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 border border-blue-400/30 font-semibold animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Agents Deliberating...</span>
                  </span>
                )}
              </div>
            </div>

            <div className="prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed">
              {summary ? (
                <ReactMarkdown>{summary}</ReactMarkdown>
              ) : (
                <div className="py-14 text-center text-slate-400">
                  <i className="fas fa-circle-notch fa-spin text-3xl text-blue-500/60 mb-3"></i>
                  <p className="text-xs font-medium text-slate-600">Agents are synthesizing the statistical verdict. This will take a few moments...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HYPOTHESES & SIGNIFICANCE TESTING */}
      {activeTab === 'hypotheses' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="glass-pill p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setHypothesisFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  hypothesisFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                All Hypotheses ({hypotheses.length})
              </button>
              <button
                onClick={() => setHypothesisFilter('completed')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  hypothesisFilter === 'completed'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                Statistically Significant ({hypotheses.filter(h => h.status === 'completed').length})
              </button>
              <button
                onClick={() => setHypothesisFilter('inconclusive')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  hypothesisFilter === 'inconclusive'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                Inconclusive / Pending ({hypotheses.filter(h => h.status !== 'completed').length})
              </button>
            </div>

            <span className="text-xs text-slate-500 font-mono glass-pill px-3 py-1 rounded-full">
              Hypothesis Matrix: α = 0.05
            </span>
          </div>

          {/* Hypotheses Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayedHypotheses.map((h, idx) => (
              <div 
                key={h.id || idx} 
                className="glass-card glass-specular rounded-2xl p-6 sm:p-7 backdrop-blur-xl border border-white/80 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3.5">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-500 font-mono glass-pill px-2 py-0.5 rounded-md">
                          H{idx + 1}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-md ${
                          h.status === 'completed' 
                            ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-400/40 shadow-xs' 
                            : 'bg-amber-500/15 text-amber-800 border border-amber-400/40 shadow-xs'
                        }`}>
                          {h.status === 'completed' ? 'Empirically Supported' : 'Inconclusive / Testing'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {h.title}
                      </h3>
                    </div>

                    <div className="text-right text-xs text-slate-400 font-mono shrink-0 glass-pill px-2 py-1 rounded-md">
                      p &lt; 0.05
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mb-4 glass-subtle p-3 rounded-xl border border-white/80 leading-relaxed">
                    <span className="font-semibold text-slate-800">Null Hypothesis:</span> {h.description}
                  </p>

                  {/* Chart Rendering */}
                  {h.chartData && h.status === 'completed' && (
                    <div className="h-60 w-full mb-4 glass-subtle p-3 rounded-xl border border-white/80 shadow-inner">
                      <ResponsiveContainer width="100%" height="100%">
                        {h.chartType === 'line' ? (
                          <LineChart data={h.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.6)" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '12px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }} />
                            <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
                          </LineChart>
                        ) : h.chartType === 'pie' ? (
                          <PieChart>
                            <Pie
                              data={h.chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={65}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {h.chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '12px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }} />
                          </PieChart>
                        ) : h.chartType === 'scatter' ? (
                          <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(203, 213, 225, 0.6)" />
                            <XAxis type="number" dataKey="x" name="X" fontSize={10} />
                            <YAxis type="number" dataKey="y" name="Y" fontSize={10} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '12px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }} />
                            <Scatter name="Distribution" data={h.chartData} fill="#2563eb" />
                          </ScatterChart>
                        ) : (
                          <BarChart data={h.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.6)" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '12px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }} />
                            <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Finding note */}
                <div className="border-t border-slate-200/60 pt-3.5">
                  <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <i className="fas fa-square-poll-vertical text-blue-600 text-[11px]"></i>
                    <span>Statistical Finding:</span>
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    {h.finding ? (
                      <ReactMarkdown>{h.finding}</ReactMarkdown>
                    ) : (
                      <span className="italic text-slate-400">Analysis running...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DATA EXPLORER & SCHEMA */}
      {activeTab === 'data' && (
        <div className="glass-card glass-specular rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50/80 border border-blue-200/80 text-blue-700 text-[11px] font-semibold mb-2">
                <i className="fas fa-table-cells text-[10px]"></i>
                <span>Tabular Schema Viewer</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Dataset Schema & Sample Records
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {dataset.rows.length} total rows · {dataset.headers.length} attributes · Showing page {currentPage} of {totalPages}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none"></i>
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Filter table rows..."
                  className="glass-input text-xs rounded-xl pl-8 pr-3 py-2 w-52 sm:w-64 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200/70 rounded-xl glass-subtle backdrop-blur-md shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200/80 text-slate-700 backdrop-blur-md">
                <tr>
                  <th className="py-3 px-3.5 font-bold text-slate-500 font-mono">#</th>
                  {dataset.headers.map((h) => (
                    <th key={h} className="py-3 px-3.5 font-bold text-slate-800 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {paginatedRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">
                      {(currentPage - 1) * rowsPerPage + rIdx + 1}
                    </td>
                    {dataset.headers.map((h) => {
                      const val = row[h];
                      const isNum = typeof val === 'number';
                      return (
                        <td 
                          key={h} 
                          className={`py-2.5 px-3.5 whitespace-nowrap text-slate-800 ${
                            isNum ? 'font-mono tabular-nums text-slate-900 font-medium' : ''
                          }`}
                        >
                          {val !== null && val !== undefined ? String(val) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div>
              Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length} entries
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="glass-pill px-3 py-1.5 rounded-lg border border-slate-200/80 disabled:opacity-40 hover:bg-white text-slate-700 font-medium transition-all"
              >
                Previous
              </button>
              <span className="font-mono font-medium px-2 glass-pill py-1 rounded-lg text-slate-700">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="glass-pill px-3 py-1.5 rounded-lg border border-slate-200/80 disabled:opacity-40 hover:bg-white text-slate-700 font-medium transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AGENT AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="glass-card glass-specular rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-sm">
          <div className="flex items-center justify-between mb-5 border-b border-slate-200/60 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50/80 border border-blue-200/80 text-blue-700 text-[11px] font-semibold mb-2">
                <i className="fas fa-clock-rotate-left text-[10px]"></i>
                <span>Deterministic Trace</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Agent Execution Trace
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological pipeline trace across Profiler, Theorist, Statistician, and Council agents
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 glass-pill px-3 py-1 rounded-full">
              {logs.length} operations recorded
            </span>
          </div>

          <div className="space-y-2.5 font-mono text-xs max-h-[500px] overflow-y-auto pr-1">
            {logs.map((log, idx) => {
              const isError = log.includes('ERROR');
              return (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                    isError 
                      ? 'bg-rose-50/80 border-rose-200/90 text-rose-800' 
                      : 'glass-subtle hover:bg-white/90 border-white/80 text-slate-700 shadow-2xs'
                  }`}
                >
                  <span className="text-slate-400 select-none text-[11px] shrink-0 font-bold">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="leading-relaxed">
                    {log}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: INQUIRY CONSOLE */}
      {activeTab === 'chat' && (
        <div className="glass-card glass-specular rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-sm space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50/80 border border-blue-200/80 text-blue-700 text-[11px] font-semibold mb-2">
              <i className="fas fa-comments text-[10px]"></i>
              <span>Empirical Q&amp;A</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Interactive Analytical Inquiry
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Query the autonomous council on dataset distributions, confounders, or strategic recommendations.
            </p>
          </div>

          {/* Quick Questions */}
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage(q)}
                disabled={isProcessingChat}
                className="text-xs glass-pill hover:bg-white text-slate-700 px-3.5 py-2 rounded-xl transition-all border border-white/80 shadow-2xs disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
            {chat.length === 0 && (
              <div className="py-14 text-center text-slate-400 text-xs glass-subtle rounded-2xl border border-white/60">
                <i className="fas fa-message text-2xl text-slate-300 mb-2 block"></i>
                <span>No active inquiries. Type a question or use voice dictation below.</span>
              </div>
            )}

            {chat.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed backdrop-blur-xl ${
                  msg.role === 'user'
                    ? 'glass-dark text-white border border-white/10 shadow-md'
                    : 'glass-subtle border border-white/80 text-slate-800 shadow-2xs'
                }`}>
                  <div className="text-[10px] uppercase font-bold tracking-wider mb-1.5 opacity-70 flex items-center gap-1.5">
                    <i className={`fas ${msg.role === 'user' ? 'fa-user' : 'fa-brain'} text-[9px]`}></i>
                    <span>{msg.role === 'user' ? 'Analyst' : 'DataSage Council'}</span>
                  </div>
                  <div className={`prose prose-xs ${msg.role === 'user' ? 'prose-invert text-white' : 'text-slate-800'}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {(isProcessingChat || isTranscribing) && (
              <div className="flex justify-start">
                <div className="glass-subtle border border-white/80 p-4 rounded-2xl text-xs text-slate-700 flex items-center gap-2.5 shadow-2xs backdrop-blur-md">
                  <i className="fas fa-circle-notch fa-spin text-blue-600"></i>
                  <span>{isTranscribing ? 'Transcribing speech...' : 'Agents deliberating inquiry...'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmitChat} className="flex gap-2.5">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isProcessingChat || isTranscribing}
              className={`px-3.5 py-2.5 border rounded-xl text-xs flex items-center gap-1.5 transition-all backdrop-blur-md ${
                isRecording 
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-[0_0_12px_rgba(244,63,94,0.2)]' 
                  : 'glass-pill hover:bg-white border-white/80 text-slate-700 shadow-2xs'
              }`}
              title="Speak prompt with microphone"
            >
              <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
              <span>{isRecording ? 'Listening' : 'Voice'}</span>
            </button>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask an analytical question about these findings..."
              className="glass-input flex-1 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none"
            />

            <button
              type="submit"
              disabled={isProcessingChat || !chatInput.trim()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs border border-white/20 flex items-center gap-1.5"
            >
              <span>Send</span>
              <i className="fas fa-paper-plane text-[10px]"></i>
            </button>
          </form>
        </div>
      )}

      {/* Encrypt Modal */}
      {showEncryptModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card glass-specular rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-white/90 backdrop-blur-2xl">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-3 border border-blue-400/20">
              <i className="fas fa-shield-halved text-base"></i>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Export Encrypted Audit Report
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Enter a password to encrypt this research briefing with AES-GCM 256-bit using Web Crypto.
            </p>

            <input 
              type="password" 
              value={encryptPassword}
              onChange={(e) => setEncryptPassword(e.target.value)}
              placeholder="Report Master Password"
              className="glass-input w-full rounded-xl px-3.5 py-2.5 text-xs mb-4 focus:outline-none"
            />

            <div className="flex gap-2 justify-end">
              <button 
                type="button"
                onClick={() => setShowEncryptModal(false)}
                className="glass-pill px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSecureExport}
                disabled={!encryptPassword || isEncrypting}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-xs border border-white/20 transition-all"
              >
                {isEncrypting && <i className="fas fa-circle-notch fa-spin text-xs"></i>}
                <span>Encrypt &amp; Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
