

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { HistoryItem } from '../types';
import { analyzeHistory } from '../services/geminiService';

interface ParentDashboardProps {
  history: HistoryItem[];
}

const ParentDashboard: React.FC<ParentDashboardProps> = ({ history }) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Stats calculation for visual callouts
  const performanceStats = useMemo(() => {
    // Fix: Explicitly type the initial value of the accumulator to ensure subTotals is typed correctly
    const subTotals = history.reduce((acc: Record<string, number>, item) => {
      acc[item.subcategory] = (acc[item.subcategory] || 0) + item.score;
      return acc;
    }, {} as Record<string, number>);

    // Fix: Cast the second element of the entries to number to satisfy arithmetic operation requirements on line 22
    const sorted = Object.entries(subTotals).sort((a, b) => (b[1] as number) - (a[1] as number));
    return {
      strengths: sorted.slice(0, 2),
      weaknesses: sorted.length > 3 ? sorted.slice(-2).reverse() : []
    };
  }, [history]);

  // Aggregate data for charts
  const dailyData = history.reduce((acc: any[], item) => {
    const date = item.date;
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.score += item.score;
    } else {
      acc.push({ date, score: item.score });
    }
    return acc;
  }, []).slice(-7);

  const categoryData = history.reduce((acc: any[], item) => {
    const existing = acc.find(d => d.name === item.category);
    if (existing) {
      existing.value += item.score;
    } else {
      acc.push({ name: item.category, value: item.score });
    }
    return acc;
  }, []);

  const handleAnalyzeTrends = async () => {
    if (history.length === 0) return;
    setIsAnalyzing(true);
    const result = await analyzeHistory(history);
    setInsights(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-800 flex items-center gap-3">
            Parent Dashboard <span className="text-3xl">📊</span>
          </h1>
          <p className="text-gray-500 font-medium">Monitoring your child's progress & learning trends.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{history.length}</div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sessions</div>
          </div>
          <div className="h-10 w-px bg-gray-100"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {history.reduce((sum, item) => sum + item.score, 0)}
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Stars</div>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-green-50 rounded-4xl p-8 border-2 border-green-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-125 transition-transform duration-700"></div>
           <h3 className="text-xl font-black text-green-700 mb-4 flex items-center gap-2">
             <span className="text-2xl">💪</span> Consistent Strengths
           </h3>
           <div className="space-y-3 relative z-10">
             {performanceStats.strengths.length > 0 ? performanceStats.strengths.map(([name, score]) => (
               <div key={name} className="flex justify-between items-center bg-white/60 p-4 rounded-2xl">
                 <span className="font-bold text-gray-800">{name}</span>
                 <span className="text-sm font-black text-green-600 bg-green-100 px-3 py-1 rounded-full">{score} Stars</span>
               </div>
             )) : <p className="text-green-600/60 font-medium">Keep learning to discover strengths!</p>}
           </div>
        </div>

        <div className="bg-orange-50 rounded-4xl p-8 border-2 border-orange-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-125 transition-transform duration-700"></div>
           <h3 className="text-xl font-black text-orange-700 mb-4 flex items-center gap-2">
             <span className="text-2xl">💡</span> Focus Areas
           </h3>
           <div className="space-y-3 relative z-10">
             {performanceStats.weaknesses.length > 0 ? performanceStats.weaknesses.map(([name, score]) => (
               <div key={name} className="flex justify-between items-center bg-white/60 p-4 rounded-2xl">
                 <span className="font-bold text-gray-800">{name}</span>
                 <span className="text-sm font-black text-orange-600 bg-orange-100 px-3 py-1 rounded-full">{score} Stars</span>
               </div>
             )) : <p className="text-orange-600/60 font-medium">Unlock more categories to see growth areas.</p>}
           </div>
        </div>
      </div>

      {/* AI Trends Analysis */}
      <section className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-[3rem] p-10 border-4 border-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-indigo-900 flex items-center gap-3">
              <span className="text-4xl">✨</span> Smart Performance Review
            </h2>
            <p className="text-indigo-600 font-medium opacity-70">Deep analysis of learning trends and behavioral patterns.</p>
          </div>
          <button 
            onClick={handleAnalyzeTrends}
            disabled={isAnalyzing || history.length === 0}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing Journey..." : "Analyze All Trends"}
          </button>
        </div>

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
             <div className="animate-spin text-5xl">🍭</div>
             <p className="text-indigo-600 font-black animate-pulse uppercase tracking-widest text-sm">Consulting the AI Tutor...</p>
          </div>
        ) : insights ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-8 border border-white shadow-inner animate-in fade-in slide-in-from-bottom-4">
            <div className="prose prose-indigo max-w-none prose-p:font-medium prose-p:text-gray-700 prose-headings:font-black">
              <div className="whitespace-pre-wrap leading-relaxed">{insights}</div>
            </div>
            <button 
              onClick={() => setInsights(null)} 
              className="mt-6 text-indigo-400 font-bold hover:text-indigo-600 transition-colors"
            >
              Clear Review
            </button>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 font-bold italic">
            {history.length > 0 ? "Click above to get a customized learning report!" : "Complete a few lessons to unlock AI reports."}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-4xl shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-700 mb-6 flex items-center gap-2">
            Weekly Progress <span className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-full">LIVE</span>
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-4xl shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-700 mb-6 flex items-center gap-2">
            Mastery Evolution <span className="text-xs bg-purple-100 text-purple-600 px-3 py-1 rounded-full">LIFETIME</span>
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-700">Detailed Activity Journal</h3>
          <span className="text-sm font-black text-gray-400">{history.length} Sessions Logged</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Category</th>
                <th className="px-8 py-4">Topic</th>
                <th className="px-8 py-4 text-center">Mastery Level</th>
                <th className="px-8 py-4 text-right">Stars</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold italic">No magic sessions logged yet.</td>
                </tr>
              ) : (
                history.slice().reverse().map((item, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-8 py-4 font-medium text-gray-600">{item.date}</td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter ${item.category === 'VOCABULARY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-bold text-gray-800">{item.subcategory}</td>
                    <td className="px-8 py-4">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-black text-blue-500 mb-1">{item.powerRating || 0}% Mastery</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                           <div className="h-full bg-blue-400" style={{ width: `${item.powerRating || 0}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="inline-flex items-center space-x-1 font-black text-green-600">
                        <span>+{item.score}</span>
                        <span className="text-xs">⭐</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
