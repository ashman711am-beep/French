
import React from 'react';
import { Link } from 'react-router-dom';
import { SubCategory, CategoryType } from '../types';

interface CategoryGridProps {
  categories: SubCategory[];
  type: CategoryType;
}

const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, type }) => {
  const pathPrefix = type === CategoryType.VOCABULARY ? '/vocabulary' : '/grammar';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {categories.map((cat) => (
        <Link 
          key={cat.id} 
          to={`${pathPrefix}/${cat.id}`}
          className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-400 overflow-hidden"
        >
          <div className={`${cat.color} w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 transform group-hover:scale-110 transition-transform`}>
            {cat.icon}
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">{cat.name}</h3>
          <p className="text-gray-500 mb-4">{cat.description}</p>
          <div className="flex items-center text-blue-600 font-bold group-hover:translate-x-2 transition-transform">
            Start Learning ➜
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 -mr-12 -mt-12 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
        </Link>
      ))}
    </div>
  );
};

export default CategoryGrid;
