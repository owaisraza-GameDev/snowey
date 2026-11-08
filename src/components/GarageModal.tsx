import React from 'react';
import {
  X,
  Shield,
  Gauge,
  Zap,
  Wind,
  Flame,
  Palette,
  Check,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { TruckUpgrades } from '../game/types';
import { UPGRADES_CONFIG, TRUCK_PAINTS } from '../game/levels';
import { soundEngine } from '../game/audio';

interface GarageModalProps {
  cash: number;
  upgrades: TruckUpgrades;
  onUpgrade: (newUpgrades: TruckUpgrades, newCash: number) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  cash,
  upgrades,
  onUpgrade,
  onClose,
}) => {
  const getIcon = (id: string) => {
    switch (id) {
      case 'bladeLevel':
        return <Shield className="w-5 h-5 text-amber-400" />;
      case 'engineLevel':
        return <Gauge className="w-5 h-5 text-cyan-400" />;
      case 'boostLevel':
        return <Zap className="w-5 h-5 text-amber-300" />;
      case 'blowerLevel':
        return <Wind className="w-5 h-5 text-blue-400" />;
      case 'saltLevel':
        return <Flame className="w-5 h-5 text-orange-500" />;
      default:
        return <Shield className="w-5 h-5 text-cyan-400" />;
    }
  };

  const handlePurchase = (upgradeId: keyof Omit<TruckUpgrades, 'paintColor'>) => {
    const config = UPGRADES_CONFIG.find((u) => u.id === upgradeId);
    if (!config) return;

    const currentLevel = upgrades[upgradeId];
    const nextLevelData = config.levels.find((l) => l.level === currentLevel + 1);

    if (!nextLevelData || cash < nextLevelData.cost) return;

    soundEngine.playUpgradeDing();
    const newCash = cash - nextLevelData.cost;
    const newUpgrades = {
      ...upgrades,
      [upgradeId]: currentLevel + 1,
    };
    onUpgrade(newUpgrades, newCash);
  };

  const handlePaintSelect = (hex: string, cost: number) => {
    if (upgrades.paintColor === hex) return;
    if (cost > 0 && cash < cost) return;

    soundEngine.playUpgradeDing();
    const newCash = cash - cost;
    const newUpgrades = {
      ...upgrades,
      paintColor: hex,
    };
    onUpgrade(newUpgrades, newCash);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                Depot Workshop
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-xs text-slate-400">Plow Fleet Tuning</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
              Truck Customization & Upgrades
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Cash readout */}
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl px-4 py-2 flex items-center gap-1.5 text-amber-400 font-black text-xl tabular-nums shadow-inner">
              <DollarSign className="w-5 h-5 -mr-1" />
              <span>{cash.toLocaleString()}</span>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upgrade Content List */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
          {UPGRADES_CONFIG.map((item) => {
            const currentLevel = upgrades[item.id];
            const maxLevel = item.levels[item.levels.length - 1].level;
            const isMaxed = currentLevel >= maxLevel;
            const nextLevelData = item.levels.find((l) => l.level === currentLevel + 1);
            const currentLevelData =
              item.levels.find((l) => l.level === currentLevel) || item.levels[0];
            const canAfford = nextLevelData && cash >= nextLevelData.cost;

            return (
              <div
                key={item.id}
                className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl shrink-0 mt-0.5">
                    {getIcon(item.id)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">{item.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-cyan-300 font-semibold tabular-nums">
                        Tier {currentLevel} / {maxLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-md">{item.description}</p>
                    <div className="text-xs text-amber-300 font-medium mt-1.5 flex items-center gap-1">
                      <span>Current:</span>
                      <span className="text-slate-200">{currentLevelData.title}</span>
                      <span className="text-slate-500">({currentLevelData.statsText})</span>
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <div className="shrink-0 self-end sm:self-center">
                  {isMaxed ? (
                    <div className="px-4 py-2 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>MAX TIER</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item.id)}
                      disabled={!canAfford}
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                        canAfford
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-amber-500/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-left">
                        <div className="text-[10px] uppercase tracking-wider opacity-80">Upgrade</div>
                        <div className="flex items-center gap-0.5 text-sm tabular-nums">
                          <span>${nextLevelData?.cost}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Paint & Color Customization */}
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white text-sm">Truck Paint & Finish</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {TRUCK_PAINTS.map((paint) => {
                const isSelected = upgrades.paintColor === paint.hex;
                return (
                  <button
                    key={paint.hex}
                    onClick={() => handlePaintSelect(paint.hex, 0)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                      isSelected
                        ? 'bg-purple-900/30 border-purple-400 text-white shadow-md'
                        : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/60'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg border border-white/20 shadow-inner shrink-0"
                      style={{ backgroundColor: paint.hex }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate">{paint.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {isSelected ? 'Equipped' : 'Select'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
          >
            RETURN TO PLOWING
          </button>
        </div>
      </div>
    </div>
  );
};
