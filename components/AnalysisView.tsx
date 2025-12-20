
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Hypothesis } from '../types';

interface AnalysisViewProps {
  hypotheses: Hypothesis[];
  summary: string;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const AnalysisView: React.FC<AnalysisViewProps> = ({ hypotheses, summary }) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
          <i className="fas fa-brain mr-2 text-indigo-600"></i>
          Executive Summary
        </h2>
        <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed whitespace-pre-wrap">
          {summary || "Finalizing global dataset patterns..."}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hypotheses.map((h) => (
          <div key={h.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded mb-2 inline-block ${
                  h.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {h.status}
                </span>
                <h3 className="text-lg font-bold text-slate-800">{h.title}</h3>
              </div>
              <div className="text-slate-400">
                <i className={`fas ${h.status === 'completed' ? 'fa-check-circle text-green-500' : 'fa-spinner fa-spin'}`}></i>
              </div>
            </div>
            
            <p className="text-sm text-slate-500 mb-6 italic">"{h.description}"</p>

            {h.chartData && h.status === 'completed' && (
              <div className="h-64 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  {h.chartType === 'bar' ? (
                    <BarChart data={h.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                      <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : h.chartType === 'line' ? (
                    <LineChart data={h.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  ) : h.chartType === 'pie' ? (
                    <PieChart>
                      <Pie
                        data={h.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {h.chartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  ) : (
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" dataKey="x" name="X-axis" fontSize={12} />
                      <YAxis type="number" dataKey="y" name="Y-axis" fontSize={12} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter name="Data Points" data={h.chartData} fill="#4f46e5" />
                    </ScatterChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-auto">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Automated Insight</h4>
              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {h.finding || "Analysis in progress..."}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
