import React from 'react';
import {
  Play,
  RotateCcw,
  Wrench,
  Home,
  Volume2,
  VolumeX,
  Music,
  Map,
} from 'lucide-react';
import { LevelConfig } from '../game/types';
import { LEVELS } from '../game/levels';

interface PauseModalProps {
  currentLevel: LevelConfig;
  onResume: () => void;
  onRestart: () => void;
  onSelectLevel: (lvl: LevelConfig) => void;
  onOpenGarage: () => void;
  onExitToTitle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isMusicEnabled: boolean;
  onToggleMusic: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  currentLevel,
  onResume,
  onRestart,
  onSelectLevel,
  onOpenGarage,
  onExitToTitle,
  isMuted,
  onToggleMute,
  isMusicEnabled,
  onToggleMusic,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs uppercase font-extrabold text-cyan-400 tracking-wider">
              Game Paused
            </div>
            <h2 className="text-xl font-black text-white">{currentLevel.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMusic}
              className={`p-2 rounded-xl border transition-colors ${
                isMusicEnabled
                  ? 'bg-slate-800 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
              title="Toggle Music"
            >
              <Music className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleMute}
              className={`p-2 rounded-xl border transition-colors ${
                !isMuted
                  ? 'bg-slate-800 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
              title="Toggle Sound"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Level Selector */}
        <div className="my-4">
          <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <Map className="w-3.5 h-3.5 text-cyan-400" />
            <span>Switch Neighborhood</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {LEVELS.map((lvl) => {
              const isSelected = lvl.id === currentLevel.id;
              return (
                <button
                  key={lvl.id}
                  onClick={() => onSelectLevel(lvl)}
                  className={`p-2 rounded-xl text-left border text-xs transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className="truncate">{lvl.name}</div>
                  <div className="text-[10px] text-cyan-300 opacity-80">{lvl.difficulty}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls Reference */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 mb-5 text-xs text-slate-300 space-y-1.5">
          <div className="font-bold text-white text-xs mb-1">Controls Guide</div>
          <div className="flex justify-between">
            <span className="text-slate-400">Steer & Drive:</span>
            <span className="font-semibold text-cyan-300">W, A, S, D / Arrows</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Dump / Stack Snow:</span>
            <span className="font-semibold text-cyan-300">X</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Angle Plow Blade:</span>
            <span className="font-semibold text-cyan-300">Q / E</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Nitro Turbo Boost:</span>
            <span className="font-semibold text-amber-300">Spacebar</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Toggle Weather:</span>
            <span className="font-semibold text-cyan-300">V</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Switch Camera (Iso / Chase / Top):</span>
            <span className="font-semibold text-cyan-300">C</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Truck Upgrades / Garage:</span>
            <span className="font-semibold text-amber-300">U</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onResume}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME PLOWING [ESC]</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenGarage}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Depot Upgrades</span>
            </button>

            <button
              onClick={onRestart}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Restart Level</span>
            </button>
          </div>

          <button
            onClick={onExitToTitle}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
