import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BladeAngleMode, CameraViewMode, LevelConfig, TruckUpgrades, WeatherMode } from './types';
import { soundEngine } from './audio';
import {
  createCommunitySnowmanSculpture,
  createCozyChalet,
  createFenceSection,
  createFireHydrant,
  createHolidayStreetLamp,
  createIceRink,
  createParkBench,
  createPlowTruck,
  createSnowDisposalChute,
  createSnowman,
  createSnowyPineTree,
  createStreetLamp,
} from './models';
import { SnowSystem } from './snowGrid';

export interface CollisionObstacle {
  x: number;
  z: number;
  radius: number;
  type: 'house' | 'tree' | 'lamp' | 'fence';
}

export class FrostPlowEngine {
  public container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  // Level & Snow System
  public currentLevel: LevelConfig;
  public upgrades: TruckUpgrades;
  public currentBankCash: number = 0;
  public snowSystem: SnowSystem | null = null;
  public obstacles: CollisionObstacle[] = [];

  // Truck 3D parts & vehicle state
  public truckGroup: THREE.Group | null = null;
  public wheels: THREE.Mesh[] = [];
  public beaconMesh: THREE.Mesh | null = null;
  public beaconLight: THREE.PointLight | null = null;
  public headlights: THREE.SpotLight[] = [];
  public bladeGroup: THREE.Group | null = null;
  public bladeSnowWedge: THREE.Mesh | null = null;
  public bladeWidth: number = 2.4;
  public exhaustPipes: THREE.Mesh[] = [];

  // Blade Angle & Dragging
  public bladeAngleMode: BladeAngleMode = 'straight';
  public targetBladeAngle: number = 0;

  // Weather & Community Sculpture
  public weatherMode: WeatherMode = 'flurries';
  public snowmanSculpture: ReturnType<typeof createCommunitySnowmanSculpture> | null = null;
  public dumpNotification: string | null = null;
  public dumpNotificationTimer: number = 0;

  // Vehicle Kinematics
  public posX: number = 0;
  public posZ: number = 0;
  public posY: number = 0;
  public speed: number = 0;
  public angle: number = 0; // heading in radians
  public steerAngle: number = 0; // current steering angle
  public isBoosting: boolean = false;
  public boostEnergy: number = 100;
  public maxBoostEnergy: number = 100;

  // Camera
  public cameraView: CameraViewMode = 'iso';
  public cameraTarget = new THREE.Vector3();
  public cameraPos = new THREE.Vector3();
  public cameraShake = 0;

  // Lighting
  public keyLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;

  // Loop & timing
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private hitstopTimer: number = 0;

  // Inputs
  public heldKeys: Set<string> = new Set();
  public touchControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
  };

  // Callback to sync stats to React HUD without re-rendering Three canvas
  public onStatsUpdate?: (stats: {
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
  }) => void;

  public onLevelVictory?: () => void;

  constructor(
    container: HTMLElement,
    level: LevelConfig,
    upgrades: TruckUpgrades,
    initialCash: number = 0
  ) {
    this.container = container;
    this.currentLevel = level;
    this.upgrades = upgrades;
    this.currentBankCash = initialCash;

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 300);

    // Studio Environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Setup Atmosphere & World
    this.setupAtmosphere();
    this.buildWorld();
    this.spawnTruck();
    this.setupEventListeners();

    // Start Loop
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.frameId = requestAnimationFrame(this.tick);
  }

  private setupAtmosphere() {
    const tod = this.currentLevel.timeOfDay;
    let skyColor = 0xd9e7f5;
    let groundColor = 0xb0bec5;
    let sunColor = 0xfff3e0;
    let sunIntensity = 2.4;

    if (tod === 'sunset') {
      skyColor = 0xf8bbd0; // Soft pink sunset alpine glow
      groundColor = 0x90a4ae;
      sunColor = 0xffab91; // Warm golden peach
      sunIntensity = 2.6;
    } else if (tod === 'night') {
      skyColor = 0x0d1b2a; // Deep midnight navy
      groundColor = 0x1b263b;
      sunColor = 0x415a77; // Cool moon tint
      sunIntensity = 1.0;
    } else if (tod === 'morning') {
      skyColor = 0xe1f5fe; // Crisp crisp morning frost
      groundColor = 0xb0bec5;
      sunColor = 0xfff8e1;
      sunIntensity = 2.5;
    }

    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.012);

    // Hemisphere Light (sky / ground bounce)
    this.hemiLight = new THREE.HemisphereLight(skyColor, groundColor, 1.2);
    this.scene.add(this.hemiLight);

    // Key Directional Light (Winter sun casting long shadows)
    this.keyLight = new THREE.DirectionalLight(sunColor, sunIntensity);
    this.keyLight.position.set(40, 50, 30);
    this.keyLight.castShadow = !this.isSoftwareGl;
    if (this.keyLight.castShadow) {
      const d = 45;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.camera.near = 10;
      this.keyLight.shadow.camera.far = 130;
      this.keyLight.shadow.mapSize.width = 1024;
      this.keyLight.shadow.mapSize.height = 1024;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);
  }

  private buildWorld() {
    const { width, depth } = this.currentLevel.mapSize;
    this.snowSystem = new SnowSystem(this.scene, width, depth);
    this.obstacles = [];

    // Distinct layouts per level
    if (this.currentLevel.id === 'pine_needle_lane') {
      this.buildSuburbanNeighborhood(width, depth);
    } else if (this.currentLevel.id === 'frostpeak_village') {
      this.buildAlpineVillage(width, depth);
    } else if (this.currentLevel.id === 'glacier_depot') {
      this.buildAirportDepot(width, depth);
    } else {
      this.buildEndlessValley(width, depth);
    }
  }

  /**
   * Level 1: Pine Needle Lane
   */
  private buildSuburbanNeighborhood(w: number, d: number) {
    if (!this.snowSystem) return;

    // Main Avenue
    this.snowSystem.addRoadSegment(0, -d * 0.42, 0, d * 0.42, 9.0);
    // Cross street
    this.snowSystem.addRoadSegment(-w * 0.38, 0, w * 0.38, 0, 8.0);
    // Cul-de-sac roundabouts
    this.snowSystem.addPlazaZone(-w * 0.38, 0, 9.0);
    this.snowSystem.addPlazaZone(w * 0.38, 0, 9.0);

    // Driveways & Chalets along Main Avenue
    const chaletSpacing = 16;
    for (let z = -d * 0.32; z <= d * 0.32; z += chaletSpacing) {
      // West Side Chalet + Driveway
      const westChalet = createCozyChalet(Math.floor(Math.abs(z)));
      westChalet.position.set(-14, 0, z);
      westChalet.rotation.y = Math.PI / 2;
      this.scene.add(westChalet);
      this.obstacles.push({ x: -14, z, radius: 3.2, type: 'house' });
      this.snowSystem.addRoadSegment(-14, z, -4.5, z, 4.5);

      // East Side Chalet + Driveway
      const eastChalet = createCozyChalet(Math.floor(Math.abs(z) + 1));
      eastChalet.position.set(14, 0, z);
      eastChalet.rotation.y = -Math.PI / 2;
      this.scene.add(eastChalet);
      this.obstacles.push({ x: 14, z, radius: 3.2, type: 'house' });
      this.snowSystem.addRoadSegment(4.5, z, 14, z, 4.5);

      // Street Lamps with Holiday Wreaths!
      const { group: lampW } = createHolidayStreetLamp();
      lampW.position.set(-5.5, 0, z + 6);
      this.scene.add(lampW);
      this.obstacles.push({ x: -5.5, z: z + 6, radius: 0.8, type: 'lamp' });

      // Fire Hydrant along the avenue
      if (Math.abs(z) < 6) {
        const hydrant = createFireHydrant();
        hydrant.position.set(-5.2, 0, z + 2);
        this.scene.add(hydrant);
      }

      // Cozy Park Bench in front of cul-de-sacs
      if (Math.abs(z) > 24) {
        const bench = createParkBench();
        bench.position.set(5.5, 0, z + 2);
        bench.rotation.y = -Math.PI / 2;
        this.scene.add(bench);
      }

      // Snowmen in front yards
      if (Math.random() > 0.4) {
        const sm = createSnowman();
        sm.position.set(Math.random() > 0.5 ? -10 : 10, 0, z + 4);
        this.scene.add(sm);
        this.obstacles.push({ x: sm.position.x, z: sm.position.z, radius: 1.0, type: 'tree' });
      }

      // Wooden fences between houses
      const fence = createFenceSection();
      fence.position.set(-14, 0, z + 8);
      this.scene.add(fence);
    }

    // West Cul-de-sac: Industrial Snow Disposal Chute / Melt Pit!
    const { group: chuteW } = createSnowDisposalChute();
    chuteW.position.set(-w * 0.38, 0, 8);
    this.scene.add(chuteW);
    this.snowSystem.disposalZones.push({
      x: -w * 0.38,
      z: 8,
      radius: 5.5,
      name: 'West Cul-de-Sac Melt Pit',
    });

    // East Cul-de-sac: Community Mega Snowman Sculpture!
    this.snowmanSculpture = createCommunitySnowmanSculpture();
    this.snowmanSculpture.group.position.set(w * 0.38, 0, -8);
    this.scene.add(this.snowmanSculpture.group);
    this.snowSystem.sculptureZone = {
      x: w * 0.38,
      z: -8,
      radius: 5.5,
      currentKg: 0,
      goalKg: 2000,
    };
    this.snowSystem.onSculptureProgress = (cur, goal) => {
      this.snowmanSculpture?.updateProgress(cur, goal);
    };

    // Snowy Pine Tree groves around outer perimeter
    this.populatePerimeterTrees(w, d);
  }

  /**
   * Level 2: Frostpeak Alpine Village
   */
  private buildAlpineVillage(w: number, d: number) {
    if (!this.snowSystem) return;

    // Central Town Square Ring
    this.snowSystem.addPlazaZone(0, 0, 16.0);

    // Town Square Center: Giant Town Christmas Tree
    const townCenterTree = createSnowyPineTree(2.2);
    townCenterTree.position.set(0, 0, 0);
    this.scene.add(townCenterTree);
    this.obstacles.push({ x: 0, z: 0, radius: 2.8, type: 'tree' });

    // Town Square Ice Skating Rink!
    const iceRink = createIceRink(16, 11);
    iceRink.position.set(-8, 0, 8);
    this.scene.add(iceRink);
    this.obstacles.push({ x: -8, z: 8, radius: 6.5, type: 'house' });

    // Town Square Benches
    const bench1 = createParkBench();
    bench1.position.set(-8, 0, 14.5);
    bench1.rotation.y = Math.PI;
    this.scene.add(bench1);

    const bench2 = createParkBench();
    bench2.position.set(-8, 0, 1.5);
    this.scene.add(bench2);

    // Municipal Fire Hydrant at Town Square
    const townHydrant = createFireHydrant();
    townHydrant.position.set(6, 0, 6);
    this.scene.add(townHydrant);

    // 4 Avenues radiating out
    this.snowSystem.addRoadSegment(0, -d * 0.44, 0, d * 0.44, 9.5);
    this.snowSystem.addRoadSegment(-w * 0.44, 0, w * 0.44, 0, 9.5);
    // Winding perimeter boulevard
    this.snowSystem.addRoadSegment(-w * 0.35, -d * 0.35, w * 0.35, -d * 0.35, 7.5);
    this.snowSystem.addRoadSegment(w * 0.35, -d * 0.35, w * 0.35, d * 0.35, 7.5);
    this.snowSystem.addRoadSegment(w * 0.35, d * 0.35, -w * 0.35, d * 0.35, 7.5);
    this.snowSystem.addRoadSegment(-w * 0.35, d * 0.35, -w * 0.35, -d * 0.35, 7.5);

    // Village shops and chalets
    const villagePositions = [
      { x: -18, z: -18, rot: Math.PI / 4 },
      { x: 18, z: -18, rot: -Math.PI / 4 },
      { x: -18, z: 18, rot: (3 * Math.PI) / 4 },
      { x: 18, z: 18, rot: (-3 * Math.PI) / 4 },
      { x: 0, z: -32, rot: 0 },
      { x: 0, z: 32, rot: Math.PI },
      { x: -32, z: 0, rot: Math.PI / 2 },
      { x: 32, z: 0, rot: -Math.PI / 2 },
    ];

    villagePositions.forEach((vp, idx) => {
      const chalet = createCozyChalet(idx);
      chalet.position.set(vp.x, 0, vp.z);
      chalet.rotation.y = vp.rot;
      this.scene.add(chalet);
      this.obstacles.push({ x: vp.x, z: vp.z, radius: 3.4, type: 'house' });

      // Holiday Lamp nearby
      const { group: lamp } = createHolidayStreetLamp();
      lamp.position.set(vp.x * 0.7, 0, vp.z * 0.7);
      this.scene.add(lamp);
      this.obstacles.push({ x: lamp.position.x, z: lamp.position.z, radius: 0.8, type: 'lamp' });
    });

    // Town Square Snow Disposal Melt Pit
    const { group: villageChute } = createSnowDisposalChute();
    villageChute.position.set(24, 0, -24);
    this.scene.add(villageChute);
    this.snowSystem.disposalZones.push({
      x: 24,
      z: -24,
      radius: 5.5,
      name: 'Alpine Town Melt Chute',
    });

    this.populatePerimeterTrees(w, d);
  }

  /**
   * Level 3: Glacier Ridge Summit Depot
   */
  private buildAirportDepot(w: number, d: number) {
    if (!this.snowSystem) return;

    // Massive Runway Strip
    this.snowSystem.addRoadSegment(-w * 0.42, 0, w * 0.42, 0, 16.0);
    // Taxiway
    this.snowSystem.addRoadSegment(0, -d * 0.38, 0, d * 0.38, 10.0);
    // Depot loading aprons
    this.snowSystem.addPlazaZone(-w * 0.25, -d * 0.25, 14.0);
    this.snowSystem.addPlazaZone(w * 0.25, d * 0.25, 14.0);

    // Hangar / Depot buildings
    const depotBuildings = [
      { x: -w * 0.25, z: -d * 0.38, rot: 0 },
      { x: w * 0.25, z: d * 0.38, rot: Math.PI },
      { x: -w * 0.38, z: 18, rot: Math.PI / 2 },
      { x: w * 0.38, z: -18, rot: -Math.PI / 2 },
    ];

    depotBuildings.forEach((b, idx) => {
      const chalet = createCozyChalet(idx);
      chalet.scale.set(1.4, 1.3, 1.4);
      chalet.position.set(b.x, 0, b.z);
      chalet.rotation.y = b.rot;
      this.scene.add(chalet);
      this.obstacles.push({ x: b.x, z: b.z, radius: 4.5, type: 'house' });
    });

    // Runway floodlights
    for (let x = -w * 0.38; x <= w * 0.38; x += 18) {
      const { group: lampN } = createStreetLamp();
      lampN.position.set(x, 0, 9.5);
      this.scene.add(lampN);
      this.obstacles.push({ x, z: 9.5, radius: 0.8, type: 'lamp' });

      const { group: lampS } = createStreetLamp();
      lampS.position.set(x, 0, -9.5);
      this.scene.add(lampS);
      this.obstacles.push({ x, z: -9.5, radius: 0.8, type: 'lamp' });
    }

    this.populatePerimeterTrees(w, d);
  }

  /**
   * Endless Chill Mode
   */
  private buildEndlessValley(w: number, d: number) {
    if (!this.snowSystem) return;

    // Meandering scenic mountain highway loops
    this.snowSystem.addRoadSegment(0, -d * 0.44, 0, d * 0.44, 10.0);
    this.snowSystem.addRoadSegment(-w * 0.44, 0, w * 0.44, 0, 10.0);
    this.snowSystem.addPlazaZone(-18, -18, 12.0);
    this.snowSystem.addPlazaZone(18, 18, 12.0);

    const chalet = createCozyChalet(1);
    chalet.position.set(22, 0, -22);
    this.scene.add(chalet);
    this.obstacles.push({ x: 22, z: -22, radius: 3.4, type: 'house' });

    this.populatePerimeterTrees(w, d);
  }

  /**
   * Populate natural pine tree border around map edges
   */
  private populatePerimeterTrees(w: number, d: number) {
    const margin = 5;
    const treeCount = 45;

    for (let i = 0; i < treeCount; i++) {
      const side = Math.floor(Math.random() * 4);
      let tx = 0;
      let tz = 0;

      if (side === 0) {
        tx = (Math.random() - 0.5) * w;
        tz = -d * 0.5 + margin + Math.random() * 6;
      } else if (side === 1) {
        tx = (Math.random() - 0.5) * w;
        tz = d * 0.5 - margin - Math.random() * 6;
      } else if (side === 2) {
        tx = -w * 0.5 + margin + Math.random() * 6;
        tz = (Math.random() - 0.5) * d;
      } else {
        tx = w * 0.5 - margin - Math.random() * 6;
        tz = (Math.random() - 0.5) * d;
      }

      const tree = createSnowyPineTree(0.85 + Math.random() * 0.5);
      tree.position.set(tx, 0, tz);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(tree);
      this.obstacles.push({ x: tx, z: tz, radius: 1.5, type: 'tree' });
    }
  }

  /**
   * Spawns or updates the player's snow plow truck
   */
  public spawnTruck() {
    if (this.truckGroup) {
      this.scene.remove(this.truckGroup);
    }

    const {
      truckGroup,
      wheels,
      beaconLight,
      beaconMesh,
      headlights,
      bladeGroup,
      bladeSnowWedge,
      exhaustPipes,
      bladeWidth,
    } = createPlowTruck(this.upgrades);

    this.truckGroup = truckGroup;
    this.wheels = wheels;
    this.beaconLight = beaconLight;
    this.beaconMesh = beaconMesh;
    this.headlights = headlights;
    this.bladeGroup = bladeGroup;
    this.bladeSnowWedge = bladeSnowWedge;
    this.exhaustPipes = exhaustPipes;
    this.bladeWidth = bladeWidth;

    // Apply current blade angle
    this.bladeGroup.rotation.y = this.targetBladeAngle;

    // Reset starting position on main road
    this.posX = 0;
    this.posZ = -this.currentLevel.mapSize.depth * 0.35;
    this.angle = 0; // Facing positive Z (down the road)
    this.speed = 0;
    this.steerAngle = 0;
    this.truckGroup.position.set(this.posX, 0, this.posZ);
    this.scene.add(this.truckGroup);

    // Initial camera placement
    this.cameraTarget.set(this.posX, 1.0, this.posZ);
    this.updateCameraImmediate();
  }

  public updateUpgrades(newUpgrades: TruckUpgrades) {
    this.upgrades = newUpgrades;
    const oldPos = { x: this.posX, z: this.posZ, angle: this.angle, speed: this.speed };
    this.spawnTruck();
    this.posX = oldPos.x;
    this.posZ = oldPos.z;
    this.angle = oldPos.angle;
    this.speed = oldPos.speed;
    if (this.truckGroup) {
      this.truckGroup.position.set(this.posX, 0, this.posZ);
      this.truckGroup.rotation.y = this.angle;
    }
  }

  public setBankCash(cash: number) {
    this.currentBankCash = cash;
    if (this.snowSystem) {
      this.snowSystem.cashEarned = 0;
    }
  }

  /**
   * Dump and stack gathered snow at the current plow blade position
   */
  public triggerDumpSnow() {
    if (!this.snowSystem) return;
    if (this.snowSystem.bladeGatheredSnowKg < 1) {
      this.dumpNotification = '❄️ Plow snow forward to gather into blade before dumping!';
      this.dumpNotificationTimer = 2.0;
      return;
    }
    const bladeWorldX = this.posX + Math.sin(this.angle) * 2.2;
    const bladeWorldZ = this.posZ + Math.cos(this.angle) * 2.2;
    const res = this.snowSystem.depositSnow(new THREE.Vector3(bladeWorldX, 0.4, bladeWorldZ));

    // Android / mobile haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(35);
      } catch {
        // ignore
      }
    }

    if (res.isDisposal) {
      this.dumpNotification = `🔥 MELT CHUTE JACKPOT! +$${Math.round(res.dumpedKg * 1.5)}`;
      this.dumpNotificationTimer = 3.2;
      this.cameraShake = 0.35;
    } else if (res.isSculpture) {
      this.dumpNotification = `⛄ COMMUNITY SNOWMAN +${Math.round(res.dumpedKg)} KG!`;
      this.dumpNotificationTimer = 3.0;
    } else if (res.dumpedKg > 0) {
      this.dumpNotification = `❄️ SNOW PILE STACKED! (${Math.round(res.dumpedKg)} kg gathered)`;
      this.dumpNotificationTimer = 2.4;
    }
  }

  /**
   * Blade Angle adjustment (straight gather vs left/right deflection)
   */
  public setBladeAngle(mode: BladeAngleMode) {
    this.bladeAngleMode = mode;
    if (mode === 'straight') {
      this.targetBladeAngle = 0;
    } else if (mode === 'left') {
      this.targetBladeAngle = -0.42; // ~24 degrees left
    } else {
      this.targetBladeAngle = 0.42; // ~24 degrees right
    }
    soundEngine.playHydraulicServo();
  }

  public cycleBladeAngle() {
    const modes: BladeAngleMode[] = ['straight', 'right', 'left'];
    const nextIdx = (modes.indexOf(this.bladeAngleMode) + 1) % modes.length;
    this.setBladeAngle(modes[nextIdx]);
  }

  /**
   * Dynamic weather adjustment
   */
  public setWeather(mode: WeatherMode) {
    this.weatherMode = mode;
    if (mode === 'blizzard') {
      this.scene.fog = new THREE.FogExp2(0xb0bec5, 0.024);
      if (this.keyLight) this.keyLight.intensity = 1.3;
    } else if (mode === 'aurora') {
      this.scene.background = new THREE.Color(0x061a23);
      this.scene.fog = new THREE.FogExp2(0x061a23, 0.013);
      if (this.keyLight) this.keyLight.intensity = 1.0;
      if (this.hemiLight) this.hemiLight.color.setHex(0x00e676);
    } else {
      this.setupAtmosphere();
    }
  }

  public cycleWeather() {
    const modes: WeatherMode[] = ['flurries', 'blizzard', 'aurora'];
    const nextIdx = (modes.indexOf(this.weatherMode) + 1) % modes.length;
    this.setWeather(modes[nextIdx]);
  }

  private setupEventListeners() {
    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.resume();
      this.heldKeys.add(e.code);

      // Hotkey: Camera Switch
      if (e.code === 'KeyC') {
        const modes: CameraViewMode[] = ['iso', 'chase', 'top'];
        const nextIdx = (modes.indexOf(this.cameraView) + 1) % modes.length;
        this.cameraView = modes[nextIdx];
      }

      // Hotkey: Dump Snow / Stack Pile
      if (e.code === 'KeyX') {
        this.triggerDumpSnow();
      }

      // Hotkey: Blade Angle Pivot
      if (e.code === 'KeyQ') {
        this.setBladeAngle(this.bladeAngleMode === 'left' ? 'straight' : 'left');
      } else if (e.code === 'KeyE') {
        this.setBladeAngle(this.bladeAngleMode === 'right' ? 'straight' : 'right');
      }

      // Hotkey: Weather toggle
      if (e.code === 'KeyV') {
        this.cycleWeather();
      }

      // Hotkey: Nitro Boost
      if (e.code === 'Space') {
        this.triggerBoost();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.heldKeys.delete(e.code);
    };

    const onBlur = () => {
      this.heldKeys.clear();
      this.touchControls.forward = false;
      this.touchControls.backward = false;
      this.touchControls.left = false;
      this.touchControls.right = false;
      this.touchControls.boost = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const onResize = () => {
      if (!this.container) return;
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);
  }

  public triggerBoost() {
    if (this.upgrades.boostLevel <= 0) return;
    if (this.boostEnergy >= 30 && !this.isBoosting) {
      this.isBoosting = true;
      this.cameraShake = 0.45;
      soundEngine.playTurboBoost();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(25);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Software WebGL loop pacer: wait for GPU/CPU command completion then 80ms pause
   */
  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  /**
   * Main 60fps Game Simulation Loop
   */
  private tick() {
    if (!this.isRunning) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // Clamp dt to prevent tunneling on lag spikes

    // Handle simulation hitstop on heavy crashes
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    } else {
      this.updatePhysics(dt);
    }

    this.updateVisuals(dt);
    this.updateCamera(dt);

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    // Software WebGL pacing or rAF
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  /**
   * Vehicle Kinematics, Steering & Snow Drag Physics
   */
  private updatePhysics(dt: number) {
    if (!this.truckGroup) return;

    // Read inputs (keyboard + touch)
    const forward =
      this.heldKeys.has('KeyW') ||
      this.heldKeys.has('ArrowUp') ||
      this.touchControls.forward;

    const backward =
      this.heldKeys.has('KeyS') ||
      this.heldKeys.has('ArrowDown') ||
      this.touchControls.backward;

    const turnLeft =
      this.heldKeys.has('KeyA') ||
      this.heldKeys.has('ArrowLeft') ||
      this.touchControls.left;

    const turnRight =
      this.heldKeys.has('KeyD') ||
      this.heldKeys.has('ArrowRight') ||
      this.touchControls.right;

    const boostReq = this.heldKeys.has('Space') || this.touchControls.boost;
    if (boostReq && !this.isBoosting && this.boostEnergy >= 30 && this.upgrades.boostLevel > 0) {
      this.triggerBoost();
    }

    // Engine parameters based on upgrades
    const topSpeeds = [12.0, 16.0, 20.0, 25.0];
    const baseTopSpeed = topSpeeds[Math.min(this.upgrades.engineLevel - 1, 3)];
    const accelRate = 14.0 + this.upgrades.engineLevel * 4.0;
    const brakeRate = 22.0;
    const frictionRate = 6.5;

    // Physical drag from snow load gathered in front of blade
    const loadKg = this.snowSystem?.bladeGatheredSnowKg || 0;
    const snowDrag = (loadKg / (this.snowSystem?.maxBladeLoadCapacity || 1500)) * 3.8;
    const loadedTopSpeed = Math.max(baseTopSpeed - snowDrag, 6.0);

    // Nitro Boost processing
    let currentMaxSpeed = loadedTopSpeed;
    if (this.isBoosting) {
      currentMaxSpeed = baseTopSpeed * 1.65;
      this.speed = THREE.MathUtils.damp(this.speed, currentMaxSpeed, 12, dt);
      this.boostEnergy -= dt * 32.0;
      if (this.boostEnergy <= 0) {
        this.boostEnergy = 0;
        this.isBoosting = false;
      }
    } else {
      // Passive boost recharge
      if (this.upgrades.boostLevel > 0) {
        this.boostEnergy = Math.min(this.boostEnergy + dt * 14.0, this.maxBoostEnergy);
      }
    }

    // Auto-dump snow if stopped and shifting into reverse after a long gather!
    if (backward && Math.abs(this.speed) < 0.25 && loadKg >= 250) {
      this.triggerDumpSnow();
    }

    // Acceleration & Braking
    if (forward) {
      if (this.speed < currentMaxSpeed) {
        this.speed += accelRate * dt;
      }
    } else if (backward) {
      if (this.speed > -baseTopSpeed * 0.45) {
        this.speed -= brakeRate * dt;
      }
    } else {
      // Natural rolling friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - frictionRate * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + frictionRate * dt);
      }
    }

    // Steering Kinematics
    const maxSteer = 0.55; // ~31 degrees
    let targetSteer = 0;
    if (turnLeft) targetSteer += maxSteer;
    if (turnRight) targetSteer -= maxSteer;

    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, targetSteer, 14, dt);

    // Turn truck based on speed and steering
    if (Math.abs(this.speed) > 0.1) {
      const turnMultiplier = this.speed >= 0 ? 1 : -1;
      this.angle += this.steerAngle * (this.speed / baseTopSpeed) * 1.9 * turnMultiplier * dt;
    }

    // Calculate new position
    const moveX = Math.sin(this.angle) * this.speed * dt;
    const moveZ = Math.cos(this.angle) * this.speed * dt;

    let nextX = this.posX + moveX;
    let nextZ = this.posZ + moveZ;

    // Obstacle Collisions
    const truckRadius = 1.35;
    let collisionOccurred = false;

    for (const obs of this.obstacles) {
      const dx = nextX - obs.x;
      const dz = nextZ - obs.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = truckRadius + obs.radius;

      if (dist < minDist) {
        collisionOccurred = true;
        // Bounce recoil
        const nx = dx / (dist || 1);
        const nz = dz / (dist || 1);
        nextX = obs.x + nx * minDist;
        nextZ = obs.z + nz * minDist;

        if (Math.abs(this.speed) > 4.0) {
          this.cameraShake = Math.min(Math.abs(this.speed) * 0.05, 0.5);
          this.hitstopTimer = 0.06; // 60ms hitstop impact
          soundEngine.playBump(true);
        } else {
          soundEngine.playBump(false);
        }

        this.speed = -this.speed * 0.25; // bounce back
        if (this.snowSystem) {
          // Drop combo on heavy crash
          this.snowSystem.comboTimer = 0.5;
        }
        break;
      }
    }

    // Map boundaries
    const halfW = this.currentLevel.mapSize.width * 0.48;
    const halfD = this.currentLevel.mapSize.depth * 0.48;
    nextX = Math.max(-halfW, Math.min(halfW, nextX));
    nextZ = Math.max(-halfD, Math.min(halfD, nextZ));

    this.posX = nextX;
    this.posZ = nextZ;

    // Update truck transforms
    this.truckGroup.position.set(this.posX, 0, this.posZ);
    this.truckGroup.rotation.y = this.angle;

    // Rotate front wheels with steering
    if (this.wheels.length >= 4) {
      // Wheel steering yaw
      this.wheels[0].parent!.rotation.y = this.steerAngle;
      this.wheels[1].parent!.rotation.y = this.steerAngle;

      // Wheel rolling pitch
      const rollDelta = (this.speed * dt) / 0.42;
      this.wheels.forEach((w) => {
        w.rotation.x += rollDelta;
      });
    }

    // Rotate blade with hydraulic damping
    if (this.bladeGroup) {
      this.bladeGroup.rotation.y = THREE.MathUtils.damp(
        this.bladeGroup.rotation.y,
        this.targetBladeAngle,
        10,
        dt
      );
    }

    // Snow Plowing Simulation step
    if (this.snowSystem) {
      // Blade center in world space (mounted ~2.1m forward from truck center)
      const currentBladeRotY = this.bladeGroup ? this.bladeGroup.rotation.y : 0;
      const bladeWorldX = this.posX + Math.sin(this.angle) * 2.1;
      const bladeWorldZ = this.posZ + Math.cos(this.angle) * 2.1;
      const bladeCenter = new THREE.Vector3(bladeWorldX, 0.4, bladeWorldZ);

      this.snowSystem.plowSnow(
        bladeCenter,
        this.angle,
        currentBladeRotY,
        this.bladeWidth,
        this.speed,
        this.upgrades.blowerLevel,
        this.upgrades.saltLevel
      );

      // Scale dynamic snow wedge in front of blade as snow gathers
      if (this.bladeSnowWedge) {
        const gatheredRatio = Math.min(
          this.snowSystem.bladeGatheredSnowKg / this.snowSystem.maxBladeLoadCapacity,
          1.0
        );
        if (gatheredRatio > 0.015) {
          const s = 0.25 + gatheredRatio * 0.85;
          this.bladeSnowWedge.scale.set(s, s * 1.15, s);
        } else {
          this.bladeSnowWedge.scale.set(0.001, 0.001, 0.001);
        }
      }

      this.snowSystem.update(dt, this.camera.position);

      // Check level victory condition
      const clearedPct = this.snowSystem.getClearedRoadPercent();
      if (
        clearedPct >= this.currentLevel.targetClearPct &&
        this.currentLevel.id !== 'endless_chill'
      ) {
        if (this.onLevelVictory) {
          this.onLevelVictory();
        }
      }

      // Handle dump notification timer
      if (this.dumpNotificationTimer > 0) {
        this.dumpNotificationTimer -= dt;
        if (this.dumpNotificationTimer <= 0) {
          this.dumpNotification = null;
        }
      }

      // Notify stats callback for React HUD
      if (this.onStatsUpdate) {
        this.onStatsUpdate({
          speed: Math.round(Math.abs(this.speed) * 3.6), // convert m/s to km/h
          clearedPercent: clearedPct,
          snowClearedKg: Math.round(this.snowSystem.totalClearedKg),
          cash: Math.round(this.currentBankCash + this.snowSystem.cashEarned),
          combo: Number(this.snowSystem.currentCombo.toFixed(1)),
          boost: Math.round(this.boostEnergy),
          maxBoost: this.maxBoostEnergy,
          bladeLoadKg: Math.round(this.snowSystem.bladeGatheredSnowKg),
          maxBladeLoad: this.snowSystem.maxBladeLoadCapacity,
          bladeAngle: this.bladeAngleMode,
          weather: this.weatherMode,
          snowmanKg: Math.round(this.snowSystem.sculptureZone?.currentKg || 0),
          snowmanGoalKg: this.snowSystem.sculptureZone?.goalKg || 2000,
          dumpNotification: this.dumpNotification,
        });
      }

      // Update audio engine RPM and load strain
      soundEngine.updateEngineSound(
        Math.abs(this.speed) / baseTopSpeed,
        forward,
        this.snowSystem.bladeGatheredSnowKg
      );
    } else {
      soundEngine.updateEngineSound(Math.abs(this.speed) / baseTopSpeed, forward, 0);
    }
  }

  /**
   * Update visual effects (flashing beacon, exhaust steam, blade rumble)
   */
  private updateVisuals(dt: number) {
    const time = performance.now() * 0.001;

    // 1. Amber Beacon Light rotation & flashing
    if (this.beaconLight && this.beaconMesh) {
      const flash = Math.sin(time * 12.0) * 0.5 + 0.5;
      this.beaconLight.intensity = 1.0 + flash * 2.5;
      (this.beaconMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.5 + flash * 2.5;
    }

    // 2. Subtle blade vibration when plowing fast
    if (this.bladeGroup && Math.abs(this.speed) > 1.0) {
      const shakeAmount = Math.min(Math.abs(this.speed) * 0.005, 0.03);
      this.bladeGroup.position.y = 0.52 + Math.sin(time * 35.0) * shakeAmount;
    }

    // 3. Camera Shake Decay
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.5);
    }
  }

  /**
   * Damped camera tracking with multiple view presets
   */
  private updateCamera(dt: number) {
    if (!this.truckGroup) return;

    // Exponential damping factor
    const k = 5.5;
    const lerpFactor = 1 - Math.exp(-k * dt);

    const targetPos = new THREE.Vector3();
    const lookTarget = new THREE.Vector3(this.posX, 1.2, this.posZ);

    if (this.cameraView === 'iso') {
      // Classic cozy 45° isometric angle
      const offsetDist = 22;
      const height = 18;
      targetPos.set(this.posX + offsetDist * 0.7, height, this.posZ + offsetDist * 0.7);
    } else if (this.cameraView === 'chase') {
      // Behind the truck facing forward
      const behindX = this.posX - Math.sin(this.angle) * 11;
      const behindZ = this.posZ - Math.cos(this.angle) * 11;
      targetPos.set(behindX, 5.5, behindZ);
      lookTarget.set(
        this.posX + Math.sin(this.angle) * 6,
        1.0,
        this.posZ + Math.cos(this.angle) * 6
      );
    } else {
      // Top-Down Overview
      targetPos.set(this.posX, 36, this.posZ + 0.01);
    }

    // Add camera shake
    if (this.cameraShake > 0) {
      targetPos.x += (Math.random() - 0.5) * this.cameraShake * 1.8;
      targetPos.y += (Math.random() - 0.5) * this.cameraShake * 1.8;
      targetPos.z += (Math.random() - 0.5) * this.cameraShake * 1.8;
    }

    this.cameraPos.lerp(targetPos, lerpFactor);
    this.cameraTarget.lerp(lookTarget, lerpFactor);

    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  private updateCameraImmediate() {
    if (this.cameraView === 'iso') {
      this.cameraPos.set(this.posX + 15, 16, this.posZ + 15);
    } else if (this.cameraView === 'chase') {
      this.cameraPos.set(this.posX, 5.5, this.posZ - 10);
    } else {
      this.cameraPos.set(this.posX, 36, this.posZ + 0.01);
    }
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  /**
   * Title screen ambient live camera pan
   */
  public updateTitleScreenPan(time: number) {
    const radius = 30;
    const camX = Math.sin(time * 0.15) * radius;
    const camZ = Math.cos(time * 0.15) * radius;
    this.camera.position.set(camX, 22, camZ);
    this.camera.lookAt(0, 1.5, 0);
  }

  public setCameraView(view: CameraViewMode) {
    this.cameraView = view;
  }

  public dispose() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    if (this.snowSystem) {
      this.snowSystem.dispose();
    }
    this.renderer.dispose();
    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
