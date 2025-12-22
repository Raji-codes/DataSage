
import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { Login } from './components/Login';
import { Dataset, AnalysisState, Hypothesis, ChatMessage } from './types';
import { profileDataset, generateHypotheses, testHypothesis, queryCouncil, generateExecutiveVerdict, transcribeAudio } from './services/geminiService';
import { maskSensitiveData } from './services/securityService';
import { isSessionActive, clearSession, getIdentity, UserIdentity } from './services/authService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(isSessionActive());
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(getIdentity());
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [userGoal, setUserGoal] = useState('');
  const [pendingDataset, setPendingDataset] = useState<Dataset | null>(null);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [analysis, setAnalysis] = useState<AnalysisState>({
    isProcessing: false,
    stage: 'idle',
    logs: [],
    hypotheses: [],
    summary: '',
    chat: [],
    isAudioPlaying: false,
  });

  // Re-sync identity when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      setUserIdentity(getIdentity());
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    clearSession();
    setIsAuthenticated(false);
    reset();
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
              setUserGoal(prev => prev ? `${prev} ${transcription}` : transcription);
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
    
    // UI TRANSITION: Switch to Dashboard Immediately
    let data = pendingDataset;
    if (privacyMode) {
      const maskedRows = maskSensitiveData(data.headers, data.rows);
      data = { ...data, rows: maskedRows };
    }
    
    setDataset(data);
    setAnalysis({
      isProcessing: true,
      stage: 'cleaning',
      logs: [`🚀 Igniting Sage Engine for ${data.name}...`],
      hypotheses: [],
      summary: '',
      chat: [],
      isAudioPlaying: false,
    });

    try {
      if (privacyMode) {
        addLog("🛡️ Privacy Shield Active: Masking sensitive PII columns...");
      } else {
        addLog("🔓 Processing raw data attributes...");
      }

      // Initial sanity check - if the client fails to init, it will throw here
      addLog("Profiling dataset structure and quality...");
      const profile = await profileDataset(data);
      addLog("✅ Data profile generated successfully.");
      
      setAnalysis(prev => ({ ...prev, stage: 'hypothesizing' }));
      addLog("Generating scientific hypotheses...");
      const hypotheses = await generateHypotheses(data, profile, userGoal);
      setAnalysis(prev => ({ ...prev, hypotheses }));
      
      setAnalysis(prev => ({ ...prev, stage: 'analyzing' }));
      addLog(`🔬 Initiating Parallel Analysis of ${hypotheses.length} hypotheses...`);
      
      const testPromises = hypotheses.map(async (h) => {
        try {
          const result = await testHypothesis(data, h);
          const completedH = { ...h, ...result, status: 'completed' } as Hypothesis;
          
          setAnalysis(prev => ({
            ...prev,
            hypotheses: prev.hypotheses.map(hyp => hyp.id === h.id ? completedH : hyp)
          }));
          return completedH;
        } catch (err) {
          console.error(`Hypothesis ${h.id} failed:`, err);
          return { ...h, status: 'failed' } as Hypothesis;
        }
      });

      const testedHypotheses = await Promise.all(testPromises);
      addLog("✅ All hypotheses analyzed concurrently.");

      setAnalysis(prev => ({ ...prev, stage: 'reporting' }));
      addLog("Synthesizing final executive verdict...");
      const finalVerdict = await generateExecutiveVerdict(data, profile, testedHypotheses, userGoal);
      setAnalysis(prev => ({ ...prev, summary: finalVerdict, isProcessing: false }));
      addLog("✨ MISSION ACCOMPLISHED.");
    } catch (error: any) {
      console.error("DataSage Engine Failure:", error);
      addLog(`❌ FAILURE: ${error.message || "Unknown error during analysis."}`);
      setAnalysis(prev => ({ ...prev, isProcessing: false, stage: 'idle' }));
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!dataset) return;
    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date() };
    setAnalysis(prev => ({ ...prev, chat: [...prev.chat, userMsg] }));
    setIsProcessingChat(true);
    try {
      // Create a profile string from current hypotheses if summary isn't ready
      const profileContext = analysis.summary || "In-progress dataset analysis";
      const response = await queryCouncil(dataset, content, analysis.chat, profileContext);
      const sageMsg: ChatMessage = { role: 'sage', content: response, timestamp: new Date() };
      setAnalysis(prev => ({ ...prev, chat: [...prev.chat, sageMsg] }));
    } catch (err: any) {
      console.error(err);
      addLog(`⚠️ Inquiry failed: ${err.message || "Communication error."}`);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const reset = () => {
    setDataset(null);
    setPendingDataset(null);
    setUserGoal('');
    setAnalysis({
      isProcessing: false, stage: 'idle', logs: [], hypotheses: [], summary: '', chat: [], isAudioPlaying: false,
    });
  };

  if (!isAuthenticated) {
    return <Login onAuthenticated={() => setIsAuthenticated(true)} />;
  }

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
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 bg-slate-100/50 px-4 py-1.5 rounded-2xl border border-slate-200 shadow-sm group">
               <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black border border-indigo-200 shadow-inner group-hover:scale-110 transition-transform">
                  {userIdentity?.username?.charAt(0).toUpperCase() || 'U'}
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-700 leading-none">Agent {userIdentity?.username || 'User'}</span>
                  <span className="text-[8px] font-bold text-slate-400 mt-0.5">{userIdentity?.phone || 'Secured Profile'}</span>
               </div>
            </div>

            <div className="flex items-center space-x-4">
              {privacyMode ? (
                <div className="flex items-center space-x-1.5 bg-green-50 px-2 py-1 rounded-md border border-green-100 animate-pulse">
                  <i className="fas fa-shield-alt text-green-600 text-[10px]"></i>
                  <span className="text-[8px] font-black uppercase text-green-700 tracking-wider">Privacy Active</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                  <i className="fas fa-lock-open text-amber-600 text-[10px]"></i>
                  <span className="text-[8px] font-black uppercase text-amber-700 tracking-wider">Raw Mode</span>
                </div>
              )}
              
              <button 
                onClick={handleLogout}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all group border border-slate-200 shadow-sm"
                title="End Secure Session"
              >
                <i className="fas fa-sign-out-alt text-xs group-hover:rotate-12 transition-transform"></i>
              </button>

              <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-full shadow-lg border border-slate-700">
                <div className={`w-1.5 h-1.5 rounded-full ${analysis.isProcessing ? 'bg-indigo-400 animate-pulse' : 'bg-green-400'}`}></div>
                <span className="text-[9px] font-black text-white uppercase tracking-widest">
                  {analysis.stage}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {!dataset ? (
          <div className="max-w-2xl mx-auto text-center py-8">
             <div className="mb-8 inline-block">
               <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border border-indigo-100">
                 Welcome Back, Investigator {userIdentity?.username.split(' ')[0]}
               </span>
             </div>
            <h2 className="text-5xl font-black text-slate-900 mb-6 leading-tight">
              Turn raw data into <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">intelligence</span>.
            </h2>
            <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-lg mx-auto">
              Our autonomous Council of Agents cleans, theorizes, and visualizes your datasets in seconds.
            </p>

            <div className="space-y-6 bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
              <div className="text-left">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    1. Load Dataset
                  </label>
                  <button 
                    onClick={() => setPrivacyMode(!privacyMode)}
                    className={`flex items-center space-x-2 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all ${
                      privacyMode ? 'bg-green-600 text-white border-green-700' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <i className={`fas ${privacyMode ? 'fa-lock' : 'fa-lock-open'}`}></i>
                    <span>Privacy Shield: {privacyMode ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>
                <FileUpload onUpload={handleDatasetReady} />
                {pendingDataset && (
                   <div className="mt-3 flex items-center space-x-2 text-green-600 text-xs font-bold animate-fadeIn">
                     <i className="fas fa-check-circle"></i>
                     <span>{pendingDataset.name} ready ({pendingDataset.rows.length.toLocaleString()} rows)</span>
                   </div>
                )}
              </div>

              <div className="text-left relative">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    2. Define Mission Objective (Optional)
                  </label>
                  <button 
                    onClick={toggleRecording}
                    className={`flex items-center space-x-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${
                      isRecording ? 'bg-red-50 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                    <span>{isRecording ? 'Recording...' : isTranscribing ? 'Converting...' : 'Use Voice'}</span>
                  </button>
                </div>
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
    </div>
  );
};

export default App;
