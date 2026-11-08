import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, ArrowRight, Wrench, RotateCcw, DollarSign, Snowflake, Flame } from 'lucide-react';
import { LevelConfig } from '../game/types';
import { soundEngine } from '../game/audio';

interface LevelCompleteModalProps {
  level: LevelConfig;
  stats: {
    snowClearedKg: number;
    cash: number;
    maxCombo: number;
    clearedPercent: number;
  };
  onNextLevel: () => void;
  onOpenGarage: () => void;
  onKeepPlowing: () => void;
  onRestart: () => void;
}

export const LevelCompleteModal: React.FC<LevelCompleteModalProps> = ({
  level,
  stats,
  onNextLevel,
  onOpenGarage,
  onKeepPlowing,
  onRestart,
}) => {
  useEffect(() => {
    soundEngine.playVictoryFanfare();

    // Trigger celebratory confetti burst
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00b4d8', '#90e0ef', '#ffd166', '#ffffff'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 text-center">
        {/* Victory Trophy Badge */}
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
          <Trophy className="w-9 h-9 text-slate-900" />
        </div>

        <div className="text-xs uppercase font-extrabold text-cyan-400 tracking-widest mb-1">
          Neighborhood Cleared!
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">
          {level.name}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          The roads and driveways are safe and clean for the cozy winter morning!
        </p>

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-left">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Snowflake className="w-3 h-3 text-cyan-400" />
              <span>Snow Plowed</span>
            </div>
            <div className="text-lg font-black text-white tabular-nums mt-0.5">
              {(stats.snowClearedKg / 1000).toFixed(2)} tons
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-left">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>Peak Combo</span>
            </div>
            <div className="text-lg font-black text-amber-300 tabular-nums mt-0.5">
              x{stats.maxCombo.toFixed(1)}
            </div>
          </div>

          <div className="col-span-2 bg-slate-800/80 border border-slate-700 rounded-xl p-3 flex justify-between items-center">
            <div className="text-left">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Completion Reward
              </div>
              <div className="text-xs text-emerald-400 font-semibold">
                Cleared {stats.clearedPercent}% of roads
              </div>
            </div>
            <div className="flex items-center gap-1 text-2xl font-black text-amber-400 tabular-nums">
              <DollarSign className="w-6 h-6 -mr-1 text-amber-400" />
              <span>+{level.rewardCash}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onNextLevel}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
          >
            <span>PROCEED TO NEXT NEIGHBORHOOD</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenGarage}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Garage Upgrades</span>
            </button>

            <button
              onClick={onRestart}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Replay Level</span>
            </button>
          </div>

          <button
            onClick={onKeepPlowing}
            className="text-xs text-slate-400 hover:text-slate-200 underline pt-1 block mx-auto"
          >
            Keep plowing remaining snowbanks (Free Roam)
          </button>
        </div>
      </div>
    </div>
  );
};
