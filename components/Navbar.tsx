import React from 'react';
import { Camera, Moon, Sun, MessageSquare, Heart } from 'lucide-react';

interface NavbarProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onFeedbackClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isDarkMode, toggleDarkMode, onFeedbackClick }) => {
  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
              Photagg AI
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onFeedbackClick}
              className="hidden sm:flex items-center gap-2 p-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Feedback
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <a 
              href="https://ko-fi.com/alingradinaru" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-[#FF5E5B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff4642] transition-colors flex items-center gap-2 shadow-sm"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span className="hidden sm:inline">Donate</span>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;