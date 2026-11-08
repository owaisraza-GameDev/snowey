import React, { useState } from 'react';
import {
  Snowflake,
  DollarSign,
  Gauge,
  Zap,
  Wrench,
  Camera,
  Volume2,
  VolumeX,
  Music,
  Pause,
  ChevronDown,
  ChevronUp,
  Flame,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Archive,
  Compass,
  CloudSnow,
} from 'lucide-react';
import { BladeAngleMode, CameraViewMode, LevelConfig, WeatherMode } from '../game/types';

interface HUDProps {
  level: LevelConfig;
  stats: {
    speed: number;
    clearedPercent: number;
    snowClearedKg: number;
    cash: number;
    combo: number;
    boost: number;
    maxBoost: number;
    bladeLoadKg: number;
    maxBladeLoad: number;
    bladeAngle: BladeAngleMode;
    weather: WeatherMode;
    snowmanKg: number;
    snowmanGoalKg: number;
    dumpNotification: string | null;
  };
  cameraView: CameraViewMode;
  onCycleCamera: () => void;
  onOpenGarage: () => void;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isMusicEnabled: boolean;
  onToggleMusic: () => void;
  onBoostPress: () => void;
  onDumpSnow: () => void;
  onCycleBladeAngle: () => void;
  onSetBladeAngle: (angle: BladeAngleMode) => void;
  onCycleWeather: () => void;
  onTouchDirection: (dir: 'forward' | 'backward' | 'left' | 'right', active: boolean) => void;
}

export const HUD: React.FC<HUDProps> = ({
  level,
  stats,
  cameraView,
  onCycleCamera,
  onOpenGarage,
  onPause,
  isMuted,
  onToggleMute,
  isMusicEnabled,
  onToggleMusic,
  onBoostPress,
  onDumpSnow,
  onCycleBladeAngle,
  onSetBladeAngle,
  onCycleWeather,
  onTouchDirection,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024;
  });

  // Determine combo text & color tier
  const combo = stats.combo;
  let comboBadgeColor = 'border-cyan-400 text-cyan-300 bg-slate-900/90';
  let comboTierName = 'COMBO';

  if (combo >= 7.0) {
    comboBadgeColor = 'border-amber-400 text-amber-300 bg-slate-900/95 shadow-lg shadow-amber-500/30';
    comboTierName = 'BLIZZARD BEAST!';
  } else if (combo >= 4.0) {
    comboBadgeColor = 'border-purple-400 text-purple-300 bg-slate-900/95 shadow-md shadow-purple-500/20';
    comboTierName = 'SNOW FRENZY!';
  } else if (combo >= 2.0) {
    comboBadgeColor = 'border-blue-400 text-blue-300 bg-slate-900/90';
    comboTierName = 'SUPER SWEEP';
  }

  const isLevelGoalMet = stats.clearedPercent >= level.targetClearPct;
  const loadPercent = Math.min((stats.bladeLoadKg / stats.maxBladeLoad) * 100, 100);
  const isBladeFull = stats.bladeLoadKg >= stats.maxBladeLoad * 0.9;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-6 select-none">
      {/* TOP PERIMETER: Stats Clusters */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        {/* Top-Left: Neighborhood & Road Snow Clearance */}
        <div className="bg-slate-900/85 border border-slate-700/80 rounded-2xl p-3 md:p-4 text-white shadow-xl pointer-events-auto min-w-[220px] md:min-w-[280px]">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 truncate">
              <Snowflake className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{level.name}</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isLevelGoalMet
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              Goal {level.targetClearPct}%
            </span>
          </div>

          {/* Road Clearance Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium tabular-nums">
              <span className="text-slate-300">Road Cleared:</span>
              <span className={`font-bold ${isLevelGoalMet ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {stats.clearedPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/60 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isLevelGoalMet
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
                style={{ width: `${Math.min(stats.clearedPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-400 flex justify-between tabular-nums">
            <span>Total Plowed:</span>
            <span className="font-semibold text-slate-200">
              {stats.snowClearedKg.toLocaleString()} kg
            </span>
          </div>
        </div>

        {/* TOP-CENTER: Active Notifications & Combo Multiplier */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto mx-auto order-last md:order-none w-full md:w-auto">
          {/* Real-time Dump / Melt Notification Banner */}
          {stats.dumpNotification && (
            <div className="bg-slate-900/95 border-2 border-amber-400 text-amber-300 px-5 py-2 rounded-2xl shadow-2xl font-black text-sm tracking-wide animate-bounce flex items-center gap-2">
              <span>{stats.dumpNotification}</span>
            </div>
          )}

          {/* Community Snowman Sculpture Progress (if active on level) */}
          {stats.snowmanGoalKg > 0 && (
            <div className="bg-slate-900/85 border border-slate-700/80 rounded-full px-4 py-1.5 text-xs text-white flex items-center gap-2 shadow-lg">
              <span className="text-sm">⛄</span>
              <span className="font-semibold text-slate-300">Community Snowman:</span>
              <span className="font-bold text-cyan-300 tabular-nums">
                {stats.snowmanKg} / {stats.snowmanGoalKg} kg
              </span>
              <span className="text-[10px] text-amber-400 font-bold">
                ({Math.round((stats.snowmanKg / stats.snowmanGoalKg) * 100)}%)
              </span>
            </div>
          )}

          {/* Combo Multiplier Badge */}
          {combo > 1.1 && (
            <div
              className={`border rounded-2xl px-5 py-2 flex items-center gap-3 transition-transform duration-200 transform scale-100 ${comboBadgeColor}`}
            >
              <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
              <div>
                <div className="text-xl md:text-2xl font-black tabular-nums tracking-tight">
                  x{combo.toFixed(1)}
                </div>
                <div className="text-[10px] font-bold tracking-widest uppercase opacity-90">
                  {comboTierName}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Earnings & Weather Info */}
        <div className="bg-slate-900/85 border border-slate-700/80 rounded-2xl p-3 md:p-4 text-white shadow-xl pointer-events-auto text-right min-w-[150px]">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
            Earnings
          </div>
          <div className="flex items-center justify-end gap-1 text-xl md:text-2xl font-black text-amber-400 tabular-nums">
            <DollarSign className="w-5 h-5 -mr-1" />
            <span>{stats.cash.toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-medium mt-1">
            +${(stats.combo * 2.5).toFixed(1)}/sec
          </div>
        </div>
      </div>

      {/* BOTTOM PERIMETER: Speedometer, Blade Snow Load, Nitro & Collapsible Dock */}
      <div className="flex flex-col items-center gap-3">
        {/* On-screen touch D-Pad / Buttons (when enabled or on mobile) */}
        {showTouchControls && (
          <div className="w-full flex justify-between items-end pointer-events-auto px-2 pb-2 gap-4">
            {/* Virtual Steering D-Pad */}
            <div className="grid grid-cols-3 gap-2 w-40 h-40 bg-slate-900/60 p-2 rounded-3xl border border-slate-700/60 backdrop-blur-xs select-none">
              <div />
              <button
                onPointerDown={(e) => { e.preventDefault(); onTouchDirection('forward', true); }}
                onPointerUp={(e) => { e.preventDefault(); onTouchDirection('forward', false); }}
                onPointerLeave={(e) => { e.preventDefault(); onTouchDirection('forward', false); }}
                onPointerCancel={(e) => { e.preventDefault(); onTouchDirection('forward', false); }}
                className="bg-slate-800/90 active:bg-cyan-500 border border-slate-600 rounded-2xl flex items-center justify-center text-white shadow-md active:scale-95 transition-transform touch-none"
                aria-label="Drive Forward"
              >
                <ArrowUp className="w-7 h-7" />
              </button>
              <div />
              <button
                onPointerDown={(e) => { e.preventDefault(); onTouchDirection('left', true); }}
                onPointerUp={(e) => { e.preventDefault(); onTouchDirection('left', false); }}
                onPointerLeave={(e) => { e.preventDefault(); onTouchDirection('left', false); }}
                onPointerCancel={(e) => { e.preventDefault(); onTouchDirection('left', false); }}
                className="bg-slate-800/90 active:bg-cyan-500 border border-slate-600 rounded-2xl flex items-center justify-center text-white shadow-md active:scale-95 transition-transform touch-none"
                aria-label="Steer Left"
              >
                <ArrowLeft className="w-7 h-7" />
              </button>
              <div className="flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-600/50 border border-slate-500/40" />
              </div>
              <button
                onPointerDown={(e) => { e.preventDefault(); onTouchDirection('right', true); }}
                onPointerUp={(e) => { e.preventDefault(); onTouchDirection('right', false); }}
                onPointerLeave={(e) => { e.preventDefault(); onTouchDirection('right', false); }}
                onPointerCancel={(e) => { e.preventDefault(); onTouchDirection('right', false); }}
                className="bg-slate-800/90 active:bg-cyan-500 border border-slate-600 rounded-2xl flex items-center justify-center text-white shadow-md active:scale-95 transition-transform touch-none"
                aria-label="Steer Right"
              >
                <ArrowRight className="w-7 h-7" />
              </button>
              <div />
              <button
                onPointerDown={(e) => { e.preventDefault(); onTouchDirection('backward', true); }}
                onPointerUp={(e) => { e.preventDefault(); onTouchDirection('backward', false); }}
                onPointerLeave={(e) => { e.preventDefault(); onTouchDirection('backward', false); }}
                onPointerCancel={(e) => { e.preventDefault(); onTouchDirection('backward', false); }}
                className="bg-slate-800/90 active:bg-cyan-500 border border-slate-600 rounded-2xl flex items-center justify-center text-white shadow-md active:scale-95 transition-transform touch-none"
                aria-label="Reverse and Brake"
              >
                <ArrowDown className="w-7 h-7" />
              </button>
              <div />
            </div>

            {/* Android Touch Action Buttons */}
            <div className="flex flex-col gap-2.5 items-end">
              <div className="flex gap-2">
                {/* Touch Blade Angle Toggle */}
                <button
                  onClick={onCycleBladeAngle}
                  className="h-12 px-3 bg-slate-800/90 active:bg-slate-700 border border-slate-600 text-slate-200 rounded-2xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform touch-none text-[11px] font-bold"
                  title="Cycle Blade Angle"
                >
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span className="capitalize">{stats.bladeAngle}</span>
                </button>

                {/* Touch Camera Toggle */}
                <button
                  onClick={onCycleCamera}
                  className="w-12 h-12 bg-slate-800/90 active:bg-slate-700 border border-slate-600 text-slate-200 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform touch-none"
                  title="Switch Camera View"
                >
                  <Camera className="w-5 h-5 text-cyan-400" />
                </button>
              </div>

              <div className="flex gap-2.5">
                {/* Touch Dump Snow Button (Actionable & Glowing!) */}
                <button
                  onClick={onDumpSnow}
                  disabled={stats.bladeLoadKg < 1}
                  className={`w-24 h-18 font-bold rounded-2xl flex flex-col items-center justify-center shadow-2xl border-2 transition-all active:scale-95 touch-none ${
                    stats.bladeLoadKg >= 1
                      ? 'bg-gradient-to-tr from-cyan-500 to-teal-400 border-cyan-200 text-white shadow-cyan-500/40 animate-pulse'
                      : 'bg-slate-800/80 border-slate-700 text-slate-500 opacity-60'
                  }`}
                  aria-label="Dump Snow"
                >
                  <Archive className="w-5 h-5 mb-0.5" />
                  <span className="text-[11px] tracking-wider uppercase font-black">DUMP</span>
                  <span className="text-[10px] tabular-nums font-semibold opacity-95">
                    {stats.bladeLoadKg > 0 ? `${stats.bladeLoadKg} kg` : '0 kg'}
                  </span>
                </button>

                {/* Touch Boost Button */}
                <button
                  onClick={onBoostPress}
                  className="w-24 h-18 bg-gradient-to-tr from-amber-500 to-orange-500 active:from-amber-400 active:to-orange-400 active:scale-95 text-white font-bold rounded-2xl flex flex-col items-center justify-center shadow-2xl border-2 border-amber-300 touch-none shadow-amber-500/30"
                  aria-label="Nitro Boost"
                >
                  <Zap className="w-5 h-5 fill-current mb-0.5" />
                  <span className="text-[11px] tracking-wider uppercase font-black">BOOST</span>
                  <span className="text-[10px] tabular-nums font-semibold text-amber-100">
                    {stats.boost}%
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Speedometer, Blade Snow Load & Dump Action Row */}
        <div className="w-full flex justify-between items-end flex-wrap gap-2">
          {/* Bottom-Left Cluster: Speed + Nitro + BLADE SNOW LOAD & DUMP */}
          <div className="bg-slate-900/85 border border-slate-700/80 rounded-2xl p-3 text-white shadow-xl pointer-events-auto flex items-center gap-3 md:gap-4 flex-wrap">
            {/* Speed readout */}
            <div className="text-center pr-3 border-r border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
                <Gauge className="w-3 h-3 text-cyan-400" />
                <span>Speed</span>
              </div>
              <div className="text-2xl font-black tabular-nums text-white leading-none mt-1">
                {stats.speed}
              </div>
              <div className="text-[9px] text-slate-400">km/h</div>
            </div>

            {/* BLADE SNOW LOAD GAUGE (Dragging & Gathering!) */}
            <div className="w-32 md:w-36 pr-3 border-r border-slate-700/60">
              <div className="flex justify-between items-center text-[10px] text-slate-300 font-semibold mb-1">
                <span className="flex items-center gap-1 text-cyan-300">
                  <Snowflake className="w-3 h-3 text-cyan-400" />
                  <span>Blade Load</span>
                </span>
                <span className="tabular-nums text-[9px] text-slate-400 font-bold">
                  {stats.bladeLoadKg} kg
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/60">
                <div
                  className={`h-full transition-all duration-150 ${
                    isBladeFull
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-400'
                  }`}
                  style={{ width: `${loadPercent}%` }}
                />
              </div>
              <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
                <span>Dragging snow</span>
                <span className="text-slate-300 font-medium">{stats.maxBladeLoad} kg max</span>
              </div>
            </div>

            {/* DUMP / STACK SNOW BUTTON (Actionable!) */}
            <button
              onClick={onDumpSnow}
              disabled={stats.bladeLoadKg < 1}
              className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
                stats.bladeLoadKg >= 1
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-white shadow-cyan-500/30 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
              }`}
              title="Dump gathered snow to stack a 3D snowbank or dump in Melt Pit [X]"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Dump Snow {stats.bladeLoadKg > 0 ? `(${stats.bladeLoadKg} kg)` : ''} [X]</span>
            </button>

            {/* Nitro Boost Gauge */}
            <div className="w-24">
              <div className="flex justify-between items-center text-[10px] text-slate-300 font-semibold mb-1">
                <span className="flex items-center gap-1 text-amber-400">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>Boost</span>
                </span>
                <span className="tabular-nums text-[9px] text-slate-400">[SPACE]</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/60">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-150"
                  style={{ width: `${(stats.boost / stats.maxBoost) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div />
        </div>

        {/* BOTTOM DOCK: Unified, Sleek, Collapsible (≤ 15% Viewport Occlusion) */}
        <div className="pointer-events-auto flex flex-col items-center">
          {/* Collapse / Expand Toggle Tab */}
          <button
            onClick={() => setIsDockCollapsed(!isDockCollapsed)}
            className="bg-slate-900/90 hover:bg-slate-800 border-t border-x border-slate-700 rounded-t-xl px-4 py-1 text-[11px] font-semibold text-slate-300 shadow-md flex items-center gap-1.5 transition-colors"
          >
            {isDockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isDockCollapsed ? '▴ Show Controls' : '▾ Hide Controls'}</span>
          </button>

          {/* Unified Glassmorphic Dock Container */}
          {!isDockCollapsed && (
            <div className="bg-slate-900/95 border border-slate-700/90 rounded-2xl md:rounded-full px-4 py-2.5 shadow-2xl flex items-center gap-2 md:gap-3 flex-wrap justify-center max-w-[96vw]">
              {/* Garage / Upgrades CTA */}
              <button
                onClick={onOpenGarage}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-full text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-transform active:scale-95"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Upgrades [U]</span>
              </button>

              {/* Blade Angle Switcher (Straight / Left / Right) */}
              <div className="flex items-center gap-1 bg-slate-800/90 rounded-full p-0.5 border border-slate-700">
                <button
                  onClick={() => onSetBladeAngle('left')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    stats.bladeAngle === 'left'
                      ? 'bg-cyan-500 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Angle Blade Left [Q]"
                >
                  ◀ Left [Q]
                </button>
                <button
                  onClick={() => onSetBladeAngle('straight')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    stats.bladeAngle === 'straight'
                      ? 'bg-cyan-500 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Straight Push (Gathers all snow forward into huge pile!)"
                >
                  Gather & Drag
                </button>
                <button
                  onClick={() => onSetBladeAngle('right')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    stats.bladeAngle === 'right'
                      ? 'bg-cyan-500 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Angle Blade Right [E]"
                >
                  Right [E] ▶
                </button>
              </div>

              {/* Weather Mode Switcher */}
              <button
                onClick={onCycleWeather}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors capitalize"
                title="Toggle Weather (Flurries / Blizzard / Aurora) [V]"
              >
                <CloudSnow className="w-3.5 h-3.5 text-cyan-400" />
                <span>{stats.weather} [V]</span>
              </button>

              {/* Camera Angle Toggle */}
              <button
                onClick={onCycleCamera}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
                title="Switch Camera Perspective [C]"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span className="capitalize">{cameraView} [C]</span>
              </button>

              {/* Touch Controls Toggle */}
              <button
                onClick={() => setShowTouchControls(!showTouchControls)}
                className={`px-3 py-1.5 border rounded-full text-xs font-medium transition-colors ${
                  showTouchControls
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                }`}
              >
                Touch D-Pad
              </button>

              <div className="h-4 w-px bg-slate-700 hidden md:block" />

              {/* Ambient Music */}
              <button
                onClick={onToggleMusic}
                className={`p-1.5 rounded-full border transition-colors ${
                  isMusicEnabled
                    ? 'bg-slate-800 border-cyan-400/50 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
                title="Toggle Lo-Fi Synth Music"
              >
                <Music className="w-3.5 h-3.5" />
              </button>

              {/* SFX Mute */}
              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded-full border transition-colors ${
                  !isMuted
                    ? 'bg-slate-800 border-cyan-400/50 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
                title="Toggle Sound Effects [M]"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Pause */}
              <button
                onClick={onPause}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-300 transition-colors"
                title="Pause Game [Esc]"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
