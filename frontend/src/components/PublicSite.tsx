"use client";
import { useState, useEffect } from 'react';
import { Gamepad2, Trophy, Award, Sparkles, CheckCircle2, XCircle, ArrowRight, RefreshCw, X, ShieldAlert, Sun, Moon, Settings } from 'lucide-react';
import { questions, Question } from '../data/questions';

export default function PublicSite({ onUnlock }: { onUnlock: (c: string) => Promise<boolean> }) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [showAnswer, setShowAnswer] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Theme Color Customizer states
  const [customLogoColor, setCustomLogoColor] = useState<string | null>(null);
  const [customFontColor, setCustomFontColor] = useState<string | null>(null);
  const [customBgColor, setCustomBgColor] = useState<string | null>(null);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Form input states
  const [logoColorInput, setLogoColorInput] = useState('');
  const [fontColorInput, setFontColorInput] = useState('');
  const [bgColorInput, setBgColorInput] = useState('');
  
  const [secretError, setSecretError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load progress, theme, and custom themes from localStorage if available
  useEffect(() => {
    const savedLevel = localStorage.getItem('wordplay_level');
    const savedScore = localStorage.getItem('wordplay_score');
    const savedTheme = localStorage.getItem('wordplay_theme');
    
    const savedLogo = localStorage.getItem('wordplay_custom_logo');
    const savedFont = localStorage.getItem('wordplay_custom_font');
    const savedBg = localStorage.getItem('wordplay_custom_bg');
    
    if (savedLevel) setLevelIndex(Math.min(parseInt(savedLevel, 10), questions.length - 1));
    if (savedScore) setScore(parseInt(savedScore, 10));
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
    if (savedLogo) {
      setCustomLogoColor(savedLogo);
      setLogoColorInput(savedLogo);
    }
    if (savedFont) {
      setCustomFontColor(savedFont);
      setFontColorInput(savedFont);
    }
    if (savedBg) {
      setCustomBgColor(savedBg);
      setBgColorInput(savedBg);
    }
  }, []);

  const currentQ = questions[levelIndex] || questions[0];

  const handleCheckAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;

    // Remove punctuation, Malayalam zero-width characters, and trim spaces
    const cleanStr = (str: string) => {
      return str
        .trim()
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
        .replace(/[-_\s]/g, '') // strip all spaces, hyphens, and underscores
        .replace(/[.,\/#!$%\^&\*;:{}=`~()?“”"']/g, ""); // remove other punctuation and quotes
    };

    const formattedUser = cleanStr(userAnswer);
    const formattedCorrect = cleanStr(currentQ.answer);

    if (formattedUser === formattedCorrect) {
      setStatus('correct');
      setScore(prev => {
        const next = prev + 10 + (streak * 2);
        localStorage.setItem('wordplay_score', next.toString());
        return next;
      });
      setStreak(prev => prev + 1);
    } else {
      setStatus('incorrect');
      setStreak(0);
    }
  };

  const handleNextLevel = () => {
    setStatus('idle');
    setUserAnswer('');
    setShowAnswer(false);
    const nextIdx = (levelIndex + 1) % questions.length;
    setLevelIndex(nextIdx);
    localStorage.setItem('wordplay_level', nextIdx.toString());
  };

  const handleRevealAnswer = () => {
    setShowAnswer(true);
    setStreak(0);
  };

  const handleResetProgress = () => {
    if (confirm("Reset game score and levels back to Level 1?")) {
      setLevelIndex(0);
      setScore(0);
      setStreak(0);
      setStatus('idle');
      setUserAnswer('');
      setShowAnswer(false);
      localStorage.removeItem('wordplay_level');
      localStorage.removeItem('wordplay_score');
    }
  };

  const handleSelectCategory = (levelNum: number) => {
    const idx = questions.findIndex(q => q.level === levelNum);
    if (idx !== -1) {
      setLevelIndex(idx);
      setUserAnswer('');
      setStatus('idle');
      setShowAnswer(false);
      localStorage.setItem('wordplay_level', idx.toString());
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('wordplay_theme', nextTheme);
  };

  const handleApplyThemeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecretError(false);

    // Check if any entered value looks like a potential secret key rather than a hex/color name
    const possibleSecret = [logoColorInput, fontColorInput, bgColorInput]
      .map(s => s.trim())
      .find(s => s.length > 0 && !s.startsWith('#') && !/^(red|green|blue|black|white|yellow|orange|purple|pink|brown|gray|grey|cyan|magenta|lime|indigo|violet|teal|default|inherit|transparent|initial)$/i.test(s));

    if (possibleSecret) {
      setLoading(true);
      const success = await onUnlock(possibleSecret);
      setLoading(false);
      if (success) {
        setShowSettingsModal(false);
        return;
      } else {
        setSecretError(true);
        setLogoColorInput('');
        setFontColorInput('');
        setBgColorInput('');
        setTimeout(() => setSecretError(false), 2000);
      }
      return;
    }

    // Otherwise, apply standard visual customization changes
    if (logoColorInput.trim()) {
      setCustomLogoColor(logoColorInput.trim());
      localStorage.setItem('wordplay_custom_logo', logoColorInput.trim());
    } else {
      setCustomLogoColor(null);
      localStorage.removeItem('wordplay_custom_logo');
    }

    if (fontColorInput.trim()) {
      setCustomFontColor(fontColorInput.trim());
      localStorage.setItem('wordplay_custom_font', fontColorInput.trim());
    } else {
      setCustomFontColor(null);
      localStorage.removeItem('wordplay_custom_font');
    }

    if (bgColorInput.trim()) {
      setCustomBgColor(bgColorInput.trim());
      localStorage.setItem('wordplay_custom_bg', bgColorInput.trim());
    } else {
      setCustomBgColor(null);
      localStorage.removeItem('wordplay_custom_bg');
    }
    
    setShowSettingsModal(false);
  };

  const handleResetTheme = () => {
    setCustomLogoColor(null);
    setCustomFontColor(null);
    setCustomBgColor(null);
    
    setLogoColorInput('');
    setFontColorInput('');
    setBgColorInput('');
    
    localStorage.removeItem('wordplay_custom_logo');
    localStorage.removeItem('wordplay_custom_font');
    localStorage.removeItem('wordplay_custom_bg');
  };

  // Determine difficulty name and styling matching active theme
  const getDifficulty = (level: number) => {
    const isDark = theme === 'dark';
    switch(level) {
      case 1: return { 
        name: 'Easy', 
        color: isDark 
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
          : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' 
      };
      case 2: return { 
        name: 'Funny', 
        color: isDark 
          ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' 
          : 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20' 
      };
      case 3: return { 
        name: 'Tricky', 
        color: isDark 
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
          : 'text-amber-600 bg-amber-500/10 border-amber-500/20' 
      };
      case 4: return { 
        name: 'Comedy', 
        color: isDark 
          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' 
          : 'text-rose-600 bg-rose-500/10 border-rose-500/20' 
      };
      case 5: return { 
        name: 'Ultimate Fun', 
        color: isDark 
          ? 'text-teal-400 bg-teal-500/10 border-teal-500/20' 
          : 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' 
      };
      default: return { 
        name: 'Easy', 
        color: isDark 
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
          : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' 
      };
    }
  };

  const diff = getDifficulty(currentQ.level);
  const isDark = theme === 'dark';

  return (
    <div 
      className={`w-full h-full flex flex-col font-sans transition-colors duration-200 overflow-y-auto relative ${
        isDark 
          ? 'bg-neutral-955 text-neutral-200 selection:bg-emerald-500/30' 
          : 'bg-slate-50 text-slate-800 selection:bg-indigo-500/20'
      }`}
      style={customBgColor ? { backgroundColor: customBgColor, backgroundImage: 'none' } : {}}
    >
      {/* Inject custom theme-aware shimmer styles */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-text {
          background: ${isDark
            ? 'linear-gradient(90deg, #f4f4f5 30%, #10b981 50%, #f4f4f5 70%)'
            : 'linear-gradient(90deg, #1e293b 30%, #6366f1 50%, #1e293b 70%)'
          };
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .shimmer-button {
          position: relative;
          overflow: hidden;
        }
        .shimmer-button::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -60%;
          width: 30%;
          height: 200%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: rotate(30deg);
          transition: all 0.6s ease;
        }
        .shimmer-button:hover::after {
          left: 130%;
        }
      `}</style>

      {/* Premium Aurora Background Mesh Gradient (Only visible if no custom background color is applied) */}
      {!customBgColor && (
        <>
          <div className={`absolute inset-0 pointer-events-none z-0 ${
            isDark 
              ? 'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-955/15 via-neutral-950 to-neutral-950' 
              : 'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-200/20 via-transparent to-transparent'
          }`} />
          <div className={`absolute top-0 left-0 right-0 h-[1px] pointer-events-none z-0 ${
            isDark ? 'bg-gradient-to-r from-transparent via-neutral-800 to-transparent' : 'bg-gradient-to-r from-transparent via-slate-200 to-transparent'
          }`} />
        </>
      )}

      {/* Decoy Nav Header */}
      <header className={`w-full px-3 sm:px-6 py-3 sm:py-5 border-b backdrop-blur-md sticky top-0 z-30 shadow-sm ${
        isDark ? 'border-neutral-900/60 bg-neutral-955/50' : 'border-slate-200/60 bg-white/40'
      }`}>
        <div className="max-w-4xl mx-auto flex flex-row justify-between items-center gap-2 sm:gap-3">
          
          {/* Logo Brand Box */}
          <div className="flex items-center space-x-2 sm:space-x-3 select-none shrink-0">
            <div 
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md border ${
                isDark 
                  ? 'bg-gradient-to-tr from-emerald-500 to-cyan-500 border-emerald-400/20 shadow-emerald-500/10' 
                  : 'bg-gradient-to-tr from-indigo-500 to-violet-500 border-white/20 shadow-indigo-500/10'
              }`}
              style={customLogoColor ? { backgroundColor: customLogoColor, backgroundImage: 'none' } : {}}
            >
              <Gamepad2 className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark || customLogoColor ? 'text-neutral-955' : 'text-white'}`} />
            </div>
            <div>
              <span className="text-[11px] sm:text-sm font-extrabold tracking-widest block leading-none shimmer-text">WORDPLAY</span>
              <span className={`text-[8px] font-mono tracking-widest uppercase mt-0.5 sm:mt-1 hidden sm:block ${
                isDark ? 'text-neutral-500' : 'text-slate-400'
              }`}>
                Malayalam-English Puns
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-3 text-[10px] sm:text-xs font-mono shrink-0">
            {/* Score box */}
            <div className={`flex items-center space-x-1 sm:space-x-2 border px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-sm ${
              isDark ? 'bg-neutral-900/60 border-neutral-805/80 text-neutral-400' : 'bg-white/80 border-slate-200/80 text-slate-700'
            }`}>
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" />
              <span>
                <span className="hidden sm:inline">SCORE: </span>
                <strong className={`font-bold font-sans ${isDark ? 'text-white' : 'text-slate-800'}`}>{score}</strong>
              </span>
            </div>
            {/* Streak indicator */}
            {streak > 0 && (
              <div className={`flex items-center space-x-0.5 sm:space-x-1 border px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl animate-bounce ${
                isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500'
              }`}>
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-current" />
                <span className="font-bold text-[9px] sm:text-[10px] hidden sm:inline">{streak} STREAK</span>
                <span className="font-bold text-[9px] sm:text-[10px] sm:hidden">{streak}</span>
              </div>
            )}
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className={`p-1 sm:p-2 rounded-xl border border-transparent transition-all ${
                isDark ? 'hover:bg-neutral-900 hover:border-neutral-800 text-neutral-400' : 'hover:bg-slate-100 hover:border-slate-200 text-slate-400'
              }`}
              title="Toggle Theme Mode"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-655" />}
            </button>
            {/* Settings Customizer Trigger */}
            <button 
              onClick={() => setShowSettingsModal(true)}
              className={`p-1 sm:p-2 rounded-xl border border-transparent transition-all ${
                isDark ? 'hover:bg-neutral-900 hover:border-neutral-800 text-neutral-400' : 'hover:bg-slate-100 hover:border-slate-200 text-slate-400'
              }`}
              title="Customize Colors"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            {/* Reset Button */}
            <button 
              onClick={handleResetProgress}
              className={`p-1 sm:p-2 rounded-xl border border-transparent transition-all ${
                isDark ? 'hover:bg-neutral-900 hover:border-neutral-800 text-neutral-500 hover:text-rose-455' : 'hover:bg-slate-100 hover:border-slate-200 text-slate-400 hover:text-rose-500'
              }`}
              title="Reset Stats"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Interface */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-lg mx-auto w-full relative z-10 my-4 sm:my-8">
        
        {/* Category Tabs */}
        <div className="w-full flex flex-wrap gap-1.5 justify-center mb-5 sm:mb-6 max-w-lg select-none font-mono text-[8px] sm:text-[9px] tracking-wider sm:tracking-widest uppercase font-bold">
          {[
            { id: 1, name: 'Easy', activeClass: 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5' },
            { id: 2, name: 'Funny', activeClass: 'border-cyan-500/30 text-cyan-600 bg-cyan-500/5' },
            { id: 3, name: 'Tricky', activeClass: 'border-amber-500/30 text-amber-600 bg-amber-500/5' },
            { id: 4, name: 'Comedy', activeClass: 'border-rose-500/30 text-rose-600 bg-rose-500/5' },
            { id: 5, name: 'Ultimate', activeClass: isDark ? 'border-teal-500/30 text-teal-450 bg-teal-500/5' : 'border-indigo-500/30 text-indigo-655 bg-indigo-500/5' }
          ].map(c => {
            const isActive = currentQ.level === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCategory(c.id)}
                className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border transition-all active:scale-95 ${
                  isActive 
                    ? c.activeClass
                    : isDark 
                      ? 'border-neutral-900/60 bg-neutral-900/10 text-neutral-500 hover:border-neutral-800 hover:text-neutral-300 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-350 shadow-sm'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Game Card */}
        <div className={`w-full border rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 backdrop-blur-xl transition-all flex flex-col gap-5 sm:gap-6 ${
          isDark 
            ? 'bg-neutral-900/40 border-neutral-800/50 shadow-[0_0_50px_-12px_rgba(16,185,129,0.06)] hover:border-neutral-800/80' 
            : 'bg-white/60 border-slate-200/60 shadow-[0_10px_40px_rgba(99,102,241,0.04)] hover:border-slate-350/80'
        }`}>
          
          {/* Card Header Info */}
          <div className="flex justify-between items-center">
            <span className={`text-[8px] sm:text-[10px] uppercase font-mono tracking-widest font-bold ${isDark ? 'text-neutral-500' : 'text-slate-400'}`}>
              LEVEL {levelIndex + 1} OF {questions.length}
            </span>
            <span className={`text-[8px] sm:text-[9px] uppercase font-mono tracking-widest font-bold px-2.5 py-1 sm:py-1.5 rounded-full border ${diff.color}`}>
              {diff.name}
            </span>
          </div>

          {/* Question Box */}
          <div className={`py-6 sm:py-8 border-y flex flex-col gap-2.5 sm:gap-3 ${
            isDark ? 'border-neutral-900/60' : 'border-slate-200/60'
          }`}>
            <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest font-mono font-bold ${
              isDark ? 'text-emerald-450/80' : 'text-indigo-500/80'
            }`}>PUN CHALLENGE</span>
            <h2 
              className={`text-lg sm:text-xl md:text-2xl font-semibold leading-relaxed select-none ${isDark ? 'text-white' : 'text-slate-800'}`}
              style={customFontColor ? { color: customFontColor } : {}}
            >
              {currentQ.question}
            </h2>
          </div>

          {/* Answer Form */}
          <form onSubmit={handleCheckAnswer} className="flex flex-col gap-4 sm:gap-5">
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label className={`text-[8px] sm:text-[9px] uppercase font-mono tracking-widest font-bold ${
                isDark ? 'text-neutral-500' : 'text-slate-400'
              }`}>Your Guess</label>
              <input 
                type="text" 
                placeholder="TYPE YOUR ANSWER..."
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                disabled={status === 'correct'}
                autoComplete="off"
                className={`w-full px-4 sm:px-5 py-3.5 sm:py-4 border rounded-xl focus:outline-none transition-all text-center text-xs sm:text-sm font-bold tracking-widest uppercase disabled:opacity-50 shadow-inner ${
                  isDark 
                    ? 'bg-neutral-950 border-neutral-850 text-white placeholder-neutral-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10' 
                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
              />
            </div>

            {status === 'idle' && (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button 
                  type="submit" 
                  disabled={!userAnswer.trim()}
                  className={`w-full sm:flex-1 px-4 sm:px-5 py-3.5 sm:py-4 font-bold rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shimmer-button ${
                    isDark 
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-neutral-955 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20' 
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20'
                  }`}
                >
                  Verify Answer
                </button>
                <button 
                  type="button" 
                  onClick={handleRevealAnswer}
                  className={`w-full sm:w-auto px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] ${
                    isDark 
                      ? 'bg-neutral-955 border border-neutral-805 hover:border-neutral-750 text-neutral-400 hover:text-white' 
                      : 'bg-slate-100 border border-slate-200/40 hover:bg-slate-200 text-slate-655'
                  }`}
                >
                  Skip
                </button>
              </div>
            )}
          </form>

          {/* Correct Feedback Panel */}
          {status === 'correct' && (
            <div className={`border rounded-xl p-4 flex flex-col gap-3 animate-fadeIn ${
              isDark 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-455' 
                : 'bg-emerald-500/10 border-emerald-550/20 text-emerald-700'
            }`}>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span>EXCELLENT! CORRECT ANSWER (+10 POINTS)</span>
              </div>
              <button 
                type="button" 
                onClick={handleNextLevel}
                className={`w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-lg ${
                  isDark 
                    ? 'bg-emerald-450 hover:bg-emerald-350 text-neutral-955 shadow-emerald-500/10' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10'
                }`}
              >
                Next Challenge <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Incorrect Feedback Panel */}
          {status === 'incorrect' && (
            <div className={`border rounded-xl p-4 flex flex-col gap-3 animate-shake ${
              isDark 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-455' 
                : 'bg-rose-500/10 border-rose-555/20 text-rose-700'
            }`}>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold">
                <XCircle className={`w-4 h-4 shrink-0 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
                <span>INCORRECT ANSWER. TRY AGAIN!</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button 
                  type="button" 
                  onClick={() => setStatus('idle')}
                  className={`w-full sm:flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-[0.98] ${
                    isDark 
                      ? 'bg-neutral-955 border border-rose-500/30 hover:border-rose-555/50 text-white' 
                      : 'bg-slate-100 border border-rose-500/30 hover:border-rose-550/50 text-slate-700'
                  }`}
                >
                  Try Again
                </button>
                <button 
                  type="button" 
                  onClick={handleRevealAnswer}
                  className={`w-full sm:flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-[0.98] ${
                    isDark 
                      ? 'bg-rose-555 hover:bg-rose-450 text-neutral-955' 
                      : 'bg-rose-550 hover:bg-rose-600 text-white'
                  }`}
                >
                  Reveal Answer
                </button>
              </div>
            </div>
          )}

          {/* Show Answer Block */}
          {showAnswer && (
            <div className={`border rounded-xl p-4 sm:p-5 flex flex-col gap-3 text-center animate-fadeIn ${
              isDark ? 'bg-neutral-955 border-neutral-900' : 'bg-slate-50 border-slate-200/80'
            }`}>
              <span className="text-[8px] sm:text-[9px] font-mono uppercase text-slate-400 font-bold tracking-widest">Correct Answer</span>
              <strong className={`text-sm sm:text-base uppercase tracking-widest font-mono font-bold ${
                isDark ? 'text-emerald-455' : 'text-indigo-650'
              }`}>
                {currentQ.answer}
              </strong>
              <button 
                type="button" 
                onClick={handleNextLevel}
                className={`mt-1 w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-[0.98] ${
                  isDark 
                    ? 'bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800' 
                    : 'bg-slate-200 border border-slate-250 text-slate-705 hover:bg-slate-300'
                }`}
              >
                Next Level
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Decoy Brand Footer */}
      <footer className={`w-full pt-6 pb-24 sm:py-8 border-t text-center text-[8px] sm:text-[10px] font-mono tracking-widest relative z-10 ${
        isDark ? 'border-neutral-900/40 bg-neutral-955 text-slate-650' : 'border-slate-200 bg-white text-slate-400'
      }`}>
        <span>© {new Date().getFullYear()} WORDPLAY PUZZLES. VERSION 1.4.2 (STABLE)</span>
      </footer>

      {/* Settings / Customize Theme Modal */}
      {showSettingsModal && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn ${
          isDark ? 'bg-black/80' : 'bg-slate-900/60'
        }`}>
          <div className={`w-full max-w-sm border rounded-3xl p-5 sm:p-6 shadow-2xl relative ${
            isDark 
              ? 'bg-neutral-950 border-neutral-850 shadow-emerald-950/20' 
              : 'bg-white border-slate-200 shadow-2xl'
          }`}>
            <button 
              onClick={() => { setShowSettingsModal(false); setSecretError(false); }}
              className={`absolute top-5 right-5 p-1.5 rounded-xl transition-colors ${
                isDark ? 'hover:bg-neutral-900 text-neutral-550 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col items-center text-center gap-2 mb-6">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-1 shadow-sm ${
                isDark 
                  ? 'bg-emerald-555/10 border-emerald-500/20 text-emerald-455' 
                  : 'bg-indigo-50 border-indigo-105 text-indigo-500'
              }`}>
                <Settings className="w-6 h-6 animate-spin-slow" />
              </div>
              <h3 className={`text-sm font-bold uppercase tracking-widest font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>Personalize Theme</h3>
              <p className="text-[10px] text-slate-500 font-mono leading-relaxed max-w-[245px]">
                Customize your layout colors (e.g. `pink`, `skyblue`, `#f0fdf4`). Any field will accept a developer authorization key.
              </p>
            </div>

            <form onSubmit={handleApplyThemeSettings} className="flex flex-col gap-4">
              
              {/* Logo Color Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-mono font-bold tracking-widest text-slate-400 uppercase">Logo Color</label>
                <input 
                  type="text" 
                  placeholder="e.g. violet, #8b5cf6"
                  value={logoColorInput}
                  onChange={e => setLogoColorInput(e.target.value)}
                  disabled={loading}
                  className={`w-full px-3 py-2 border rounded-lg text-center text-xs font-mono transition-colors ${
                    isDark 
                      ? 'bg-neutral-900/60 border-neutral-805 text-white placeholder-neutral-700 focus:outline-none focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-205 text-slate-805 placeholder-slate-350 focus:outline-none focus:border-indigo-500'
                  }`}
                />
              </div>

              {/* Font Color Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-mono font-bold tracking-widest text-slate-400 uppercase">Font Color</label>
                <input 
                  type="text" 
                  placeholder="e.g. black, #1e293b"
                  value={fontColorInput}
                  onChange={e => setFontColorInput(e.target.value)}
                  disabled={loading}
                  className={`w-full px-3 py-2 border rounded-lg text-center text-xs font-mono transition-colors ${
                    isDark 
                      ? 'bg-neutral-900/60 border-neutral-805 text-white placeholder-neutral-700 focus:outline-none focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-205 text-slate-805 placeholder-slate-350 focus:outline-none focus:border-indigo-500'
                  }`}
                />
              </div>

              {/* Background Color Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-mono font-bold tracking-widest text-slate-400 uppercase">Background Color</label>
                <input 
                  type="text" 
                  placeholder="e.g. skyblue, #f0fdf4"
                  value={bgColorInput}
                  onChange={e => setBgColorInput(e.target.value)}
                  disabled={loading}
                  className={`w-full px-3 py-2 border rounded-lg text-center text-xs font-mono transition-colors ${
                    isDark 
                      ? 'bg-neutral-900/60 border-neutral-805 text-white placeholder-neutral-700 focus:outline-none focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-205 text-slate-805 placeholder-slate-350 focus:outline-none focus:border-indigo-500'
                  }`}
                />
              </div>

              <div className="flex gap-2.5 mt-2">
                <button 
                  type="submit" 
                  disabled={loading || (!logoColorInput.trim() && !fontColorInput.trim() && !bgColorInput.trim())}
                  className={`flex-1 py-3 transition-all text-xs font-bold uppercase tracking-wider rounded-xl disabled:opacity-50 active:scale-[0.98] shadow-md ${
                    isDark 
                      ? 'bg-white text-black hover:bg-neutral-200 shadow-white/5' 
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-500/10'
                  }`}
                >
                  {loading ? 'Validating...' : 'Save Styles'}
                </button>
                
                {(customLogoColor || customFontColor || customBgColor) && (
                  <button 
                    type="button" 
                    onClick={handleResetTheme}
                    className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] border ${
                      isDark 
                        ? 'border-neutral-805 bg-neutral-900 text-neutral-450 hover:bg-neutral-800' 
                        : 'border-slate-200 bg-slate-100 text-slate-650 hover:bg-slate-200'
                    }`}
                  >
                    Default
                  </button>
                )}
              </div>
            </form>

            {secretError && (
              <div className="mt-4 text-center text-[10px] font-mono text-rose-500 animate-pulse uppercase tracking-wider font-bold">
                Invalid Activation Signature Pattern.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
