
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { HistoryItem } from '../types';
import { analyzeHistory } from '../services/geminiService';

interface ParentDashboardProps {
  history: HistoryItem[];
}

const ParentDashboard: React.FC<ParentDashboardProps> = ({ history }) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleAnalyze = async () => {
    if (history.length < 3) {
      alert("We need at least a few learning sessions to generate meaningful insights!");
      return;
    }
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
          <p className="text-gray-500 font-medium">Track your child's French learning journey and get AI tips.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{history.length}</div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lessons</div>
          </div>
          <div className="h-10 w-px bg-gray-100"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {history.reduce((sum, item) => sum + item.score, 0)}
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Points</div>
          </div>
        </div>
      </div>

      {/* AI Performance Insights Section */}
      <section className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-[3rem] p-8 md:p-12 border-4 border-indigo-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-indigo-900 flex items-center gap-3">
              <span className="text-4xl">✨</span> AI Performance Insights
            </h2>
            {!insights && !isAnalyzing && (
              <button 
                onClick={handleAnalyze}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all hover:-translate-y-1"
              >
                Analyze Trends
              </button>
            )}
          </div>

          {isAnalyzing ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="animate-spin text-6xl">🍭</div>
              <p className="text-xl font-bold text-indigo-600 animate-pulse">Our AI Tutor is reviewing the history book...</p>
            </div>
          ) : insights ? (
            <div className="bg-white/80 backdrop-blur-md rounded-4xl p-8 shadow-inner prose prose-indigo max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 font-medium leading-relaxed">
                {insights}
              </div>
              <button 
                onClick={() => setInsights(null)} 
                className="mt-8 text-indigo-400 font-black hover:text-indigo-600 flex items-center gap-2"
              >
                Refresh Analysis ⟳
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 font-bold mb-6 text-xl">Get a deep dive into strengths, weaknesses, and weekly growth!</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-40">
                <div className="p-6 bg-white rounded-3xl border-2 border-dashed border-indigo-200">
                  <div className="text-3xl mb-2">💪</div>
                  <div className="h-4 bg-indigo-50 rounded-full w-3/4 mx-auto mb-2"></div>
                  <div className="h-4 bg-indigo-50 rounded-full w-1/2 mx-auto"></div>
                </div>
                <div className="p-6 bg-white rounded-3xl border-2 border-dashed border-indigo-200">
                  <div className="text-3xl mb-2">📈</div>
                  <div className="h-4 bg-indigo-50 rounded-full w-2/3 mx-auto mb-2"></div>
                  <div className="h-4 bg-indigo-50 rounded-full w-3/4 mx-auto"></div>
                </div>
                <div className="p-6 bg-white rounded-3xl border-2 border-dashed border-indigo-200">
                  <div className="text-3xl mb-2">💡</div>
                  <div className="h-4 bg-indigo-50 rounded-full w-1/2 mx-auto mb-2"></div>
                  <div className="h-4 bg-indigo-50 rounded-full w-2/3 mx-auto"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-4xl shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-700 mb-6 flex items-center gap-2">
            Weekly Progress <span className="text-sm bg-blue-50 text-blue-500 px-3 py-1 rounded-full uppercase">Last 7 Days</span>
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
            Subject Proficiency <span className="text-sm bg-purple-50 text-purple-500 px-3 py-1 rounded-full uppercase">Lifetime</span>
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
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-700">Recent Activity Log</h3>
          <span className="text-sm font-bold text-gray-400">{history.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Category</th>
                <th className="px-8 py-4">Subcategory</th>
                <th className="px-8 py-4">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-gray-400 font-bold italic">No magic logs yet. Start your journey!</td>
                </tr>
              ) : (
                history.slice().reverse().map((item, idx) => (
                  <tr key={idx} className="hover:bg-blue-50 transition-colors">
                    <td className="px-8 py-4 font-medium text-gray-600">{item.date}</td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black tracking-tighter ${item.category === 'VOCABULARY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-bold text-gray-800">{item.subcategory}</td>
                    <td className="px-8 py-4">
                      <span className="flex items-center space-x-1 font-black text-green-600">
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
