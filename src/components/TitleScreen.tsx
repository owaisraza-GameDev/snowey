import React from 'react';
import { Play, Volume2, VolumeX, Music, Shield, Snowflake } from 'lucide-react';
import { LevelConfig } from '../game/types';
import { LEVELS } from '../game/levels';
import { soundEngine } from '../game/audio';

interface TitleScreenProps {
  onStartGame: (level: LevelConfig) => void;
  selectedLevel: LevelConfig;
  onSelectLevel: (level: LevelConfig) => void;
  onOpenGarage: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isMusicEnabled: boolean;
  onToggleMusic: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  selectedLevel,
  onSelectLevel,
  onOpenGarage,
  isMuted,
  onToggleMute,
  isMusicEnabled,
  onToggleMusic,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 md:p-12 z-20 select-none">
      {/* Top Header / Audio controls */}
      <div className="flex justify-between items-center pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-full px-4 py-1.5 text-xs font-medium text-slate-300 shadow-lg">
          <Snowflake className="w-4 h-4 text-cyan-300" />
          <span>v1.0 · Procedural 3D Winter Engine</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMusic}
            className={`p-2.5 rounded-full border transition-colors shadow-lg ${
              isMusicEnabled
                ? 'bg-slate-900/80 border-cyan-500/50 text-cyan-300 hover:bg-slate-800'
                : 'bg-slate-900/80 border-slate-700 text-slate-500 hover:bg-slate-800'
            }`}
            title="Toggle Ambient Synth Music"
          >
            <Music className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleMute}
            className={`p-2.5 rounded-full border transition-colors shadow-lg ${
              !isMuted
                ? 'bg-slate-900/80 border-cyan-500/50 text-cyan-300 hover:bg-slate-800'
                : 'bg-slate-900/80 border-slate-700 text-slate-500 hover:bg-slate-800'
            }`}
            title="Toggle Sound Effects"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Hero Title Lockup with inline SVG */}
      <div className="max-w-xl mx-auto text-center pointer-events-auto my-auto py-4">
        {/* Bespoke inline SVG Logo */}
        <div className="flex justify-center mb-4">
          <svg
            className="w-72 md:w-96 drop-shadow-[0_8px_20px_rgba(0,180,216,0.35)]"
            viewBox="0 0 420 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ice mountain silhouette backdrop */}
            <path
              d="M30 85L85 30L140 85M130 85L180 15L230 85M220 85L270 38L320 85"
              stroke="#00b4d8"
              strokeWidth="2.5"
              strokeOpacity="0.4"
            />
            {/* Main title text */}
            <text
              x="210"
              y="60"
              textAnchor="middle"
              className="font-black text-5xl tracking-widest fill-white"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.18em',
                fontWeight: 900,
              }}
            >
              FROSTPLOW
            </text>
            {/* 3D Gold Accent Badge */}
            <rect x="330" y="32" width="55" height="26" rx="6" fill="#e65100" />
            <text
              x="357"
              y="50"
              textAnchor="middle"
              className="text-xs font-extrabold fill-amber-100 tracking-wider"
              style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 800 }}
            >
              3D
            </text>
            {/* Sub-line */}
            <text
              x="210"
              y="85"
              textAnchor="middle"
              className="text-xs font-semibold fill-cyan-300 tracking-widest uppercase opacity-90"
              style={{ letterSpacing: '0.28em' }}
            >
              Cozy Winter Snow Plowing
            </text>
          </svg>
        </div>

        <p className="text-slate-200 text-sm md:text-base font-normal max-w-md mx-auto mb-6 drop-shadow-md">
          Hop into your heavy-duty plow truck, clear neighborhood driveways and alpine streets, chain massive snow combos, and upgrade your winter fleet.
        </p>

        {/* Level Selector Pills */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 mb-6 shadow-2xl">
          <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
            Select Neighborhood
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {LEVELS.map((lvl) => {
              const isSelected = lvl.id === selectedLevel.id;
              return (
                <button
                  key={lvl.id}
                  onClick={() => onSelectLevel(lvl)}
                  className={`px-3 py-2.5 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-700/70'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{lvl.name}</div>
                  <div className="text-[10px] text-cyan-300 opacity-80 mt-0.5">
                    {lvl.difficulty}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onStartGame(selectedLevel)}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-base"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START PLOWING [ENTER / SPACE]</span>
          </button>

          <button
            onClick={onOpenGarage}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span>GARAGE & UPGRADES</span>
          </button>
        </div>
      </div>

      {/* Flat Control Hints Footer */}
      <div className="text-center pointer-events-auto">
        <div className="inline-block bg-slate-900/80 border border-slate-700/60 rounded-full px-5 py-2 text-xs text-slate-300 shadow-md">
          <span className="font-semibold text-cyan-300">WASD / Arrows</span> Drive ·{' '}
          <span className="font-semibold text-cyan-300">X</span> Dump & Stack Snow ·{' '}
          <span className="font-semibold text-cyan-300">Q / E</span> Angle Blade ·{' '}
          <span className="font-semibold text-cyan-300">Space</span> Boost ·{' '}
          <span className="font-semibold text-cyan-300">V</span> Weather ·{' '}
          <span className="font-semibold text-cyan-300">C</span> Camera ·{' '}
          <span className="font-semibold text-cyan-300">U</span> Upgrades ·{' '}
          <span className="font-semibold text-cyan-300">Esc</span> Pause
        </div>
      </div>
    </div>
  );
};
