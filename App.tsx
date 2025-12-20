
import React, { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { Dataset, AnalysisState, Hypothesis, ChatMessage } from './types';
import { profileDataset, generateHypotheses, testHypothesis, queryCouncil, generateExecutiveVerdict } from './services/geminiService';

const App: React.FC = () => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [userGoal, setUserGoal] = useState('');
  const [pendingDataset, setPendingDataset] = useState<Dataset | null>(null);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isProcessing: false,
    stage: 'idle',
    logs: [],
    hypotheses: [],
    summary: '',
    chat: [],
    isAudioPlaying: false,
  });

  const addLog = (message: string) => {
    setAnalysis(prev => ({
      ...prev,
      logs: [...prev.logs, `${new Date().toLocaleTimeString()} - ${message}`]
    }));
  };

  const handleDatasetReady = (data: Dataset) => {
    setPendingDataset(data);
  };

  const startProcess = async () => {
    if (!pendingDataset) return;
    
    const data = pendingDataset;
    setDataset(data);
    setAnalysis({
      isProcessing: true,
      stage: 'cleaning',
      logs: [`Initiating ${userGoal ? 'Directed' : 'Autonomous'} analysis for ${data.name}...`],
      hypotheses: [],
      summary: '',
      chat: [],
      isAudioPlaying: false,
    });

    try {
      addLog("Profiling dataset structure and quality...");
      const profile = await profileDataset(data);
      addLog("Data profile generated successfully.");
      
      setAnalysis(prev => ({ ...prev, stage: 'hypothesizing' }));
      if (userGoal) {
        addLog(`Crafting hypotheses based on goal: "${userGoal}"...`);
      } else {
        addLog("Generating autonomous hypotheses based on discovered patterns...");
      }
      
      const hypotheses = await generateHypotheses(data, profile, userGoal);
      setAnalysis(prev => ({ ...prev, hypotheses }));
      addLog(`Created ${hypotheses.length} hypotheses for testing.`);

      setAnalysis(prev => ({ ...prev, stage: 'analyzing' }));
      const updatedHypotheses: Hypothesis[] = [...hypotheses];
      
      const finishedHypotheses: Hypothesis[] = [];
      for (let i = 0; i < updatedHypotheses.length; i++) {
        const h = updatedHypotheses[i];
        addLog(`Testing hypothesis ${i+1}/${updatedHypotheses.length}: ${h.title}...`);
        
        setAnalysis(prev => ({
          ...prev,
          hypotheses: prev.hypotheses.map((hyp, idx) => 
            idx === i ? { ...hyp, status: 'analyzing' } : hyp
          )
        }));

        const result = await testHypothesis(data, h);
        const completedH = { ...h, ...result, status: 'completed' } as Hypothesis;
        finishedHypotheses.push(completedH);

        setAnalysis(prev => ({
          ...prev,
          hypotheses: prev.hypotheses.map((hyp, idx) => 
            idx === i ? completedH : hyp
          )
        }));
        
        addLog(`Analysis complete for: ${h.title}`);
      }

      setAnalysis(prev => ({ ...prev, stage: 'reporting' }));
      addLog("Council is synthesizing all findings into a final verdict...");
      
      const finalVerdict = await generateExecutiveVerdict(data, profile, finishedHypotheses, userGoal);
      
      setAnalysis(prev => ({ 
        ...prev, 
        summary: finalVerdict, 
        isProcessing: false 
      }));
      addLog("MISSION ACCOMPLISHED: Final report and answer are ready.");

    } catch (error) {
      console.error(error);
      addLog("CRITICAL ERROR during analysis. Check console.");
      setAnalysis(prev => ({ ...prev, isProcessing: false, stage: 'idle' }));
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!dataset) return;
    
    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date() };
    setAnalysis(prev => ({ ...prev, chat: [...prev.chat, userMsg] }));
    
    setIsProcessingChat(true);
    try {
      const response = await queryCouncil(dataset, content, analysis.chat, analysis.summary);
      const sageMsg: ChatMessage = { role: 'sage', content: response, timestamp: new Date() };
      setAnalysis(prev => ({ ...prev, chat: [...prev.chat, sageMsg] }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const reset = () => {
    setDataset(null);
    setPendingDataset(null);
    setUserGoal('');
    setAnalysis({
      isProcessing: false,
      stage: 'idle',
      logs: [],
      hypotheses: [],
      summary: '',
      chat: [],
      isAudioPlaying: false,
    });
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <i className="fas fa-microchip text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">DataSage</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Autonomous Data Scientist</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {dataset && (
              <button 
                onClick={reset}
                className="text-slate-500 hover:text-red-600 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Reset
              </button>
            )}
            <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <div className={`w-2 h-2 rounded-full ${analysis.isProcessing ? 'bg-indigo-500 animate-pulse' : (analysis.stage === 'reporting' ? 'bg-green-500' : 'bg-slate-300')}`}></div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                {analysis.stage === 'reporting' && !analysis.isProcessing ? 'mission complete' : analysis.stage}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {!dataset ? (
          <div className="max-w-2xl mx-auto text-center py-8">
            <h2 className="text-5xl font-black text-slate-900 mb-6 leading-tight">
              Turn raw data into <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">intelligence</span>.
            </h2>
            <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-lg mx-auto">
              Our autonomous Council of Agents cleans, theorizes, and visualizes your datasets in seconds.
            </p>

            <div className="space-y-6 bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
              <div className="text-left">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                  1. Load Dataset
                </label>
                <FileUpload onUpload={handleDatasetReady} />
                {pendingDataset && (
                   <div className="mt-3 flex items-center space-x-2 text-green-600 text-xs font-bold animate-fadeIn">
                     <i className="fas fa-check-circle"></i>
                     <span>{pendingDataset.name} ready ({pendingDataset.rows.length.toLocaleString()} rows)</span>
                   </div>
                )}
              </div>

              <div className="text-left">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                  2. Define Mission Objective (Optional)
                </label>
                <textarea 
                  value={userGoal}
                  onChange={(e) => setUserGoal(e.target.value)}
                  placeholder="e.g. 'I want to understand what drives customer churn' or 'How does seasonality affect sales?'"
                  className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none placeholder:text-slate-400"
                />
              </div>

              <button 
                onClick={startProcess}
                disabled={!pendingDataset}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center space-x-3 text-lg"
              >
                <i className="fas fa-rocket"></i>
                <span>{userGoal ? 'Begin Directed Analysis' : 'Begin Full Autonomous Analysis'}</span>
              </button>
            </div>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {[
                { icon: 'fa-broom', title: 'Scrutinizer', desc: 'Agentic cleaning and data profiling.' },
                { icon: 'fa-vial', title: 'Theorist', desc: 'Predictive hypothesis generation.' },
                { icon: 'fa-chart-area', title: 'Statistician', desc: 'Deep-dive visual experimentation.' }
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                    <i className={`fas ${item.icon} text-indigo-500`}></i>
                  </div>
                  <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">Council Intel</h3>
                <div className="space-y-6 relative z-10">
                  {userGoal && (
                    <div className="border-b border-slate-800 pb-3">
                       <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Mission Objective</span>
                       <p className="text-xs text-slate-300 leading-relaxed italic">"{userGoal}"</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-medium text-slate-400">Total Observations</span>
                    <span className="text-xl font-black text-white">{dataset.rows.length.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-medium text-slate-400">Dimensions</span>
                    <span className="text-xl font-black text-white">{dataset.headers.length}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Key Dimensions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dataset.headers.slice(0, 8).map(h => (
                        <span key={h} className="text-[9px] bg-slate-800 border border-slate-700 px-2 py-1 rounded-md text-slate-300">{h}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Autonomous Stream</h3>
                <div className="h-64 overflow-y-auto space-y-3 text-[11px] font-mono scrollbar-hide">
                  {analysis.logs.map((log, i) => (
                    <div key={i} className="flex space-x-2 text-slate-500">
                       <span className="text-indigo-400">»</span>
                       <span>{log}</span>
                    </div>
                  ))}
                  {analysis.isProcessing && (
                    <div className="flex items-center space-x-2 italic text-indigo-500 animate-pulse">
                      <i className="fas fa-circle-notch fa-spin"></i>
                      <span>Council is deliberating...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <AnalysisView 
                dataset={dataset}
                hypotheses={analysis.hypotheses} 
                summary={analysis.summary} 
                chat={analysis.chat}
                onSendMessage={handleSendMessage}
                isProcessingChat={isProcessingChat}
              />
            </div>
          </div>
        )}
      </main>

      {analysis.isProcessing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center space-x-6 z-50 animate-bounce">
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></div>
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse delay-75"></div>
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse delay-150"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Agent Status</span>
            <span className="text-xs font-bold uppercase tracking-widest">{analysis.stage}...</span>
          </div>
        </div>
      )}
      
      {!analysis.isProcessing && analysis.stage === 'reporting' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 z-50 animate-fadeIn transition-all">
          <i className="fas fa-check-circle text-xl"></i>
          <span className="font-bold uppercase tracking-widest text-sm">Mission Accomplished</span>
        </div>
      )}
    </div>
  );
};

export default App;
