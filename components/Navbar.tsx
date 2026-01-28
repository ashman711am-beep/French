
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  stars: number;
}

const Navbar: React.FC<NavbarProps> = ({ stars }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="flex items-center space-x-2">
        <span className="text-3xl">🥖</span>
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
          Petit Français
        </span>
      </Link>

      <div className="hidden md:flex items-center space-x-8">
        <Link to="/vocabulary" className={`font-semibold text-lg transition-colors ${isActive('/vocabulary') ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>
          Vocabulary
        </Link>
        <Link to="/grammar" className={`font-semibold text-lg transition-colors ${isActive('/grammar') ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>
          Grammar
        </Link>
        <Link to="/stats" className={`font-semibold text-lg transition-colors ${isActive('/stats') ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>
          My Stars
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        <div className="bg-yellow-100 px-4 py-2 rounded-full flex items-center space-x-2 border border-yellow-200">
          <span className="text-xl">⭐</span>
          <span className="font-bold text-yellow-700">{stars}</span>
        </div>
        <Link to="/parent" className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-bold hover:bg-purple-200 transition-colors">
          Parent Mode
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
