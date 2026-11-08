import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BladeAngleMode, CameraViewMode, GameMode, LevelConfig, TruckUpgrades, WeatherMode } from './game/types';
import { LEVELS } from './game/levels';
import { FrostPlowEngine } from './game/engine';
import { soundEngine } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { HUD } from './components/HUD';
import { GarageModal } from './components/GarageModal';
import { LevelCompleteModal } from './components/LevelCompleteModal';
import { PauseModal } from './components/PauseModal';

const DEFAULT_UPGRADES: TruckUpgrades = {
  bladeLevel: 1,
  engineLevel: 1,
  boostLevel: 1,
  blowerLevel: 0,
  saltLevel: 0,
  paintColor: '#e65100',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FrostPlowEngine | null>(null);

  // Game Lifecycle State
  const [gameMode, setGameMode] = useState<GameMode>('title');
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig>(LEVELS[0]);
  const [cameraView, setCameraView] = useState<CameraViewMode>('iso');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState<boolean>(true);

  // Persistent Player Progression
  const [cash, setCash] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('frostplow_cash');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [upgrades, setUpgrades] = useState<TruckUpgrades>(() => {
    try {
      const saved = localStorage.getItem('frostplow_upgrades');
      return saved ? JSON.parse(saved) : DEFAULT_UPGRADES;
    } catch {
      return DEFAULT_UPGRADES;
    }
  });

  // Fast HUD stats synced from Three.js loop without React re-render of canvas
  const [hudStats, setHudStats] = useState({
    speed: 0,
    clearedPercent: 0,
    snowClearedKg: 0,
    cash: 0,
    combo: 1.0,
    boost: 100,
    maxBoost: 100,
    bladeLoadKg: 0,
    maxBladeLoad: 1500,
    bladeAngle: 'straight' as BladeAngleMode,
    weather: 'flurries' as WeatherMode,
    snowmanKg: 0,
    snowmanGoalKg: 2000,
    dumpNotification: null as string | null,
  });

  const [levelVictoryStats, setLevelVictoryStats] = useState({
    snowClearedKg: 0,
    cash: 0,
    maxCombo: 1.0,
    clearedPercent: 0,
  });

  // Save progress
  const saveProgress = useCallback((newCash: number, newUpgrades: TruckUpgrades) => {
    setCash(newCash);
    setUpgrades(newUpgrades);
    try {
      localStorage.setItem('frostplow_cash', newCash.toString());
      localStorage.setItem('frostplow_upgrades', JSON.stringify(newUpgrades));
    } catch {
      // ignore
    }
  }, []);

  // Initialize FrostPlowEngine once
  useEffect(() => {
    if (!mountRef.current) return;

    soundEngine.init();

    const engine = new FrostPlowEngine(mountRef.current, selectedLevel, upgrades, cash);
    engineRef.current = engine;

    engine.onStatsUpdate = (stats) => {
      setHudStats((prev) => ({
        ...prev,
        ...stats,
      }));
      setCash(stats.cash);
      try {
        localStorage.setItem('frostplow_cash', stats.cash.toString());
      } catch {
        // ignore
      }
    };

    engine.onLevelVictory = () => {
      if (gameMode === 'playing') {
        const earned = Math.round((engine.snowSystem?.cashEarned || 0) + selectedLevel.rewardCash);
        const newTotal = engine.currentBankCash + earned;
        saveProgress(newTotal, upgrades);
        engine.setBankCash(newTotal);
        setLevelVictoryStats({
          snowClearedKg: Math.round(engine.snowSystem?.totalClearedKg || 0),
          cash: earned,
          maxCombo: Number(engine.snowSystem?.maxCombo.toFixed(1) || 1.0),
          clearedPercent: engine.snowSystem?.getClearedRoadPercent() || 0,
        });
        setGameMode('level_complete');
      }
    };

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync Level changes to 3D engine
  const loadLevelInEngine = useCallback((level: LevelConfig) => {
    setSelectedLevel(level);
    if (!mountRef.current) return;

    if (engineRef.current) {
      engineRef.current.dispose();
    }

    const engine = new FrostPlowEngine(mountRef.current, level, upgrades, cash);
    engineRef.current = engine;

    engine.onStatsUpdate = (stats) => {
      setHudStats((prev) => ({
        ...prev,
        ...stats,
      }));
      setCash(stats.cash);
      try {
        localStorage.setItem('frostplow_cash', stats.cash.toString());
      } catch {
        // ignore
      }
    };

    engine.onLevelVictory = () => {
      const earned = Math.round((engine.snowSystem?.cashEarned || 0) + level.rewardCash);
      const newTotal = engine.currentBankCash + earned;
      saveProgress(newTotal, upgrades);
      engine.setBankCash(newTotal);
      setLevelVictoryStats({
        snowClearedKg: Math.round(engine.snowSystem?.totalClearedKg || 0),
        cash: earned,
        maxCombo: Number(engine.snowSystem?.maxCombo.toFixed(1) || 1.0),
        clearedPercent: engine.snowSystem?.getClearedRoadPercent() || 0,
      });
      setGameMode('level_complete');
    };
  }, [upgrades, cash, saveProgress]);

  // Handle Game Start
  const handleStartGame = (lvl: LevelConfig) => {
    soundEngine.resume();
    if (engineRef.current && engineRef.current.currentLevel.id !== lvl.id) {
      loadLevelInEngine(lvl);
    }
    setGameMode('playing');
  };

  // Upgrades handler
  const handleUpgrade = (newUpgrades: TruckUpgrades, newCash: number) => {
    saveProgress(newCash, newUpgrades);
    if (engineRef.current) {
      engineRef.current.setBankCash(newCash);
      engineRef.current.updateUpgrades(newUpgrades);
    }
  };

  // Camera Cycle
  const handleCycleCamera = () => {
    const modes: CameraViewMode[] = ['iso', 'chase', 'top'];
    const nextIdx = (modes.indexOf(cameraView) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setCameraView(nextMode);
    if (engineRef.current) {
      engineRef.current.setCameraView(nextMode);
    }
  };

  // Audio toggles
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  const handleToggleMusic = () => {
    const next = !isMusicEnabled;
    setIsMusicEnabled(next);
    soundEngine.setMusicEnabled(next);
  };

  // Touch controls forwarding
  const handleTouchDirection = (
    dir: 'forward' | 'backward' | 'left' | 'right',
    active: boolean
  ) => {
    if (engineRef.current) {
      soundEngine.resume();
      engineRef.current.touchControls[dir] = active;
    }
  };

  const handleBoostPress = () => {
    if (engineRef.current) {
      engineRef.current.triggerBoost();
    }
  };

  // Next level progression
  const handleNextLevel = () => {
    const currentIdx = LEVELS.findIndex((l) => l.id === selectedLevel.id);
    const nextIdx = (currentIdx + 1) % LEVELS.length;
    const nextLvl = LEVELS[nextIdx];
    loadLevelInEngine(nextLvl);
    setGameMode('playing');
  };

  const handleRestartLevel = () => {
    loadLevelInEngine(selectedLevel);
    setGameMode('playing');
  };

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        handleToggleMute();
      }

      if (gameMode === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame(selectedLevel);
        }
      } else if (gameMode === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setGameMode('paused');
        } else if (e.code === 'KeyU') {
          e.preventDefault();
          setGameMode('garage');
        }
      } else if (gameMode === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setGameMode('playing');
        }
      } else if (gameMode === 'garage') {
        if (e.code === 'Escape' || e.code === 'KeyU') {
          e.preventDefault();
          setGameMode('playing');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [gameMode, selectedLevel, isMuted]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Container: strictly isolated outside re-rendering UI */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* GAME SHELL SCREENS & HUD */}
      {gameMode === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          selectedLevel={selectedLevel}
          onSelectLevel={(lvl) => {
            setSelectedLevel(lvl);
            loadLevelInEngine(lvl);
          }}
          onOpenGarage={() => setGameMode('garage')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isMusicEnabled={isMusicEnabled}
          onToggleMusic={handleToggleMusic}
        />
      )}

      {gameMode === 'playing' && (
        <HUD
          level={selectedLevel}
          stats={hudStats}
          cameraView={cameraView}
          onCycleCamera={handleCycleCamera}
          onOpenGarage={() => setGameMode('garage')}
          onPause={() => setGameMode('paused')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isMusicEnabled={isMusicEnabled}
          onToggleMusic={handleToggleMusic}
          onBoostPress={handleBoostPress}
          onDumpSnow={() => engineRef.current?.triggerDumpSnow()}
          onCycleBladeAngle={() => engineRef.current?.cycleBladeAngle()}
          onSetBladeAngle={(angle) => engineRef.current?.setBladeAngle(angle)}
          onCycleWeather={() => engineRef.current?.cycleWeather()}
          onTouchDirection={handleTouchDirection}
        />
      )}

      {gameMode === 'garage' && (
        <GarageModal
          cash={cash}
          upgrades={upgrades}
          onUpgrade={handleUpgrade}
          onClose={() => setGameMode('playing')}
        />
      )}

      {gameMode === 'paused' && (
        <PauseModal
          currentLevel={selectedLevel}
          onResume={() => setGameMode('playing')}
          onRestart={handleRestartLevel}
          onSelectLevel={(lvl) => {
            loadLevelInEngine(lvl);
            setGameMode('playing');
          }}
          onOpenGarage={() => setGameMode('garage')}
          onExitToTitle={() => setGameMode('title')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isMusicEnabled={isMusicEnabled}
          onToggleMusic={handleToggleMusic}
        />
      )}

      {gameMode === 'level_complete' && (
        <LevelCompleteModal
          level={selectedLevel}
          stats={{
            snowClearedKg: levelVictoryStats.snowClearedKg,
            cash: levelVictoryStats.cash,
            maxCombo: levelVictoryStats.maxCombo,
            clearedPercent: levelVictoryStats.clearedPercent,
          }}
          onNextLevel={handleNextLevel}
          onOpenGarage={() => setGameMode('garage')}
          onKeepPlowing={() => setGameMode('playing')}
          onRestart={handleRestartLevel}
        />
      )}
    </div>
  );
}
