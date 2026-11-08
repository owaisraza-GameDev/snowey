export type GameMode = 'title' | 'playing' | 'paused' | 'garage' | 'level_complete' | 'game_over';

export type CameraViewMode = 'iso' | 'chase' | 'top';

export type BladeAngleMode = 'straight' | 'left' | 'right';

export type WeatherMode = 'flurries' | 'blizzard' | 'aurora';

export interface TruckUpgrades {
  bladeLevel: number;      // 1 to 4: affects clearing width
  engineLevel: number;     // 1 to 4: top speed & acceleration
  boostLevel: number;      // 1 to 3: nitro capacity & recharge
  blowerLevel: number;     // 0 to 3: snow blower range & bonus cash
  saltLevel: number;       // 0 to 3: heated blade/salt multiplier
  paintColor: string;      // hex color for truck cab
}

export interface UpgradeItemConfig {
  id: keyof Omit<TruckUpgrades, 'paintColor'>;
  name: string;
  icon: string;
  description: string;
  levels: {
    level: number;
    title: string;
    cost: number;
    statsText: string;
  }[];
}

export interface LevelConfig {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 'Cozy' | 'Moderate' | 'Heavy Blizzard' | 'Zen / Endless';
  targetClearPct: number;
  totalSnowGoalKg: number;
  mapSize: { width: number; depth: number };
  snowDensity: number; // 0.8 to 1.5
  timeOfDay: 'sunset' | 'night' | 'morning';
  rewardCash: number;
  description: string;
}

export interface GameStats {
  snowPlowedKg: number;
  cash: number;
  currentCombo: number;
  maxCombo: number;
  clearedPercent: number;
  timeElapsed: number;
  activeLevelId: string;
}
