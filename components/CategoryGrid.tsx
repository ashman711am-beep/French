
import React from 'react';
import { Link } from 'react-router-dom';
import { SubCategory, CategoryType } from '../types';

interface CategoryGridProps {
  categories: SubCategory[];
  type: CategoryType;
  stats: Record<string, number>;
}

const MASTERY_SCORE = 500; // Define 500 points as 100% mastery for the power rating

const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, type, stats }) => {
  const pathPrefix = type === CategoryType.VOCABULARY ? '/vocabulary' : '/grammar';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {categories.map((cat) => {
        const points = stats[cat.name] || 0;
        const powerRating = Math.min(Math.round((points / MASTERY_SCORE) * 100), 100);
        
        return (
          <Link 
            key={cat.id} 
            to={`${pathPrefix}/${cat.id}`}
            className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-400 overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`${cat.color} w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transform group-hover:scale-110 transition-transform`}>
                {cat.icon}
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-gray-400 uppercase tracking-tighter">Points</div>
                <div className="text-2xl font-black text-blue-600">⭐ {points}</div>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-1">{cat.name}</h3>
            <p className="text-gray-500 mb-6 text-sm line-clamp-2">{cat.description}</p>
            
            {/* Power Rating UI */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-black text-gray-400 uppercase">Power Rating</span>
                <span className="text-xs font-black text-blue-500">{powerRating}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                <div 
                  className={`h-full transition-all duration-1000 ${cat.color} opacity-80`} 
                  style={{ width: `${powerRating}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center text-blue-600 font-bold group-hover:translate-x-2 transition-transform">
              Start Learning ➜
            </div>
            
            <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 -mr-12 -mt-12 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
          </Link>
        );
      })}
    </div>
  );
};

export default CategoryGrid;
