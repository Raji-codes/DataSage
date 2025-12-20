
import React, { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { Dataset, AnalysisState, Hypothesis } from './types';
import { profileDataset, generateHypotheses, testHypothesis } from './services/geminiService';

const App: React.FC = () => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isProcessing: false,
    stage: 'idle',
    logs: [],
    hypotheses: [],
    summary: '',
  });

  const addLog = (message: string) => {
    setAnalysis(prev => ({
      ...prev,
      logs: [...prev.logs, `${new Date().toLocaleTimeString()} - ${message}`]
    }));
  };

  const startAutonomousProcess = async (data: Dataset) => {
    setDataset(data);
    setAnalysis({
      isProcessing: true,
      stage: 'cleaning',
      logs: [`Started analyzing ${data.name}...`],
      hypotheses: [],
      summary: '',
    });

    try {
      // Step 1: Profile and Clean
      addLog("Profiling dataset structure and quality...");
      const profile = await profileDataset(data);
      addLog("Data profile generated successfully.");
      
      // Step 2: Generate Hypotheses
      setAnalysis(prev => ({ ...prev, stage: 'hypothesizing' }));
      addLog("Generating autonomous hypotheses based on patterns...");
      const hypotheses = await generateHypotheses(data, profile);
      setAnalysis(prev => ({ ...prev, hypotheses }));
      addLog(`Created ${hypotheses.length} hypotheses for testing.`);

      // Step 3: Analyze each Hypothesis
      setAnalysis(prev => ({ ...prev, stage: 'analyzing' }));
      const updatedHypotheses = [...hypotheses];
      
      for (let i = 0; i < updatedHypotheses.length; i++) {
        const h = updatedHypotheses[i];
        addLog(`Testing hypothesis: ${h.title}...`);
        
        setAnalysis(prev => ({
          ...prev,
          hypotheses: prev.hypotheses.map((hyp, idx) => 
            idx === i ? { ...hyp, status: 'analyzing' } : hyp
          )
        }));

        const result = await testHypothesis(data, h);
        
        setAnalysis(prev => ({
          ...prev,
          hypotheses: prev.hypotheses.map((hyp, idx) => 
            idx === i ? { ...hyp, ...result, status: 'completed' } as Hypothesis : hyp
          )
        }));
        
        addLog(`Analysis complete for: ${h.title}`);
      }

      // Final Reporting
      setAnalysis(prev => ({ 
        ...prev, 
        stage: 'reporting', 
        summary: profile, 
        isProcessing: false 
      }));
      addLog("All analysis completed. Final report ready.");

    } catch (error) {
      console.error(error);
      addLog("CRITICAL ERROR during analysis. Check console.");
      setAnalysis(prev => ({ ...prev, isProcessing: false, stage: 'idle' }));
    }
  };

  const reset = () => {
    setDataset(null);
    setAnalysis({
      isProcessing: false,
      stage: 'idle',
      logs: [],
      hypotheses: [],
      summary: '',
    });
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
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
                className="text-slate-500 hover:text-red-600 text-sm font-medium transition-colors"
              >
                Reset Analysis
              </button>
            )}
            <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full">
              <div className={`w-2 h-2 rounded-full ${analysis.isProcessing ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></div>
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {analysis.stage}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {!dataset ? (
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Turn raw data into <span className="text-indigo-600">decisions</span> instantly.</h2>
            <p className="text-lg text-slate-500 mb-10 leading-relaxed">
              Upload your dataset and let our autonomous analyst discover hidden patterns, test hypotheses, and generate visualizations without writing a single line of code.
            </p>
            <FileUpload onUpload={startAutonomousProcess} />
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {[
                { icon: 'fa-broom', title: 'Auto Clean', desc: 'Detects anomalies and formats data types automatically.' },
                { icon: 'fa-vial', title: 'Hypothesize', desc: 'Discovers interesting correlations and statistical trends.' },
                { icon: 'fa-chart-area', title: 'Visualize', desc: 'Picks the best charts to communicate complex insights.' }
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <i className={`fas ${item.icon} text-indigo-500 text-xl mb-4`}></i>
                  <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Stats & Logs */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-4">Dataset Stats</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold">{dataset.rows.length}</p>
                    <p className="text-xs text-indigo-200 uppercase font-semibold">Total Rows</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dataset.headers.length}</p>
                    <p className="text-xs text-indigo-200 uppercase font-semibold">Dimensions</p>
                  </div>
                  <div className="pt-4 border-t border-indigo-800">
                    <p className="text-xs text-indigo-200 mb-2">Primary Columns:</p>
                    <div className="flex flex-wrap gap-2">
                      {dataset.headers.slice(0, 5).map(h => (
                        <span key={h} className="text-[10px] bg-indigo-800 px-2 py-1 rounded">{h}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 text-slate-300 p-6 rounded-2xl shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Autonomous Logs</h3>
                <div className="h-64 overflow-y-auto space-y-2 text-[11px] font-mono scrollbar-hide">
                  {analysis.logs.map((log, i) => (
                    <div key={i} className="border-l-2 border-slate-700 pl-3 py-1">
                      {log}
                    </div>
                  ))}
                  {analysis.isProcessing && (
                    <div className="flex items-center space-x-2 pl-3 italic text-indigo-400">
                      <i className="fas fa-circle-notch fa-spin"></i>
                      <span>Agent is thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Analysis Display */}
            <div className="lg:col-span-3">
              <AnalysisView hypotheses={analysis.hypotheses} summary={analysis.summary} />
            </div>
          </div>
        )}
      </main>

      {/* Persistent Status Bar */}
      {analysis.isProcessing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-indigo-100 flex items-center space-x-4 animate-bounce">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse delay-75"></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse delay-150"></div>
          </div>
          <span className="text-sm font-bold text-slate-800 uppercase tracking-widest">
            Agent Working: <span className="text-indigo-600">{analysis.stage}...</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default App;
