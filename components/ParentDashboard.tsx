
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { HistoryItem } from '../types';

interface ParentDashboardProps {
  history: HistoryItem[];
}

const ParentDashboard: React.FC<ParentDashboardProps> = ({ history }) => {
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-800">Parent Dashboard 📊</h1>
          <p className="text-gray-500">Track your child's French learning journey</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-4xl shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-700 mb-6">Weekly Progress</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-4xl shadow-sm border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-700 mb-6">Subject Proficiency</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 6, fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50">
          <h3 className="text-2xl font-bold text-gray-700">Recent Activity</h3>
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
              {history.slice().reverse().map((item, idx) => (
                <tr key={idx} className="hover:bg-blue-50 transition-colors">
                  <td className="px-8 py-4 font-medium text-gray-600">{item.date}</td>
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.category === 'VOCABULARY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-8 py-4 font-bold text-gray-800">{item.subcategory}</td>
                  <td className="px-8 py-4">
                    <span className="flex items-center space-x-1 font-bold text-green-600">
                      <span>+{item.score}</span>
                      <span className="text-xs">⭐</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
