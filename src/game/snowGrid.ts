import * as THREE from 'three';
import { soundEngine } from './audio';
import { createStackedSnowMoundMesh } from './models';

export interface SnowParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  isSteam?: boolean;
}

export interface StackedMoundData {
  mesh: THREE.Mesh;
  worldX: number;
  worldZ: number;
  radius: number;
  height: number;
  snowKg: number;
}

export class SnowSystem {
  public scene: THREE.Scene;
  public mapWidth: number;
  public mapDepth: number;

  // Snow Canvas Texture for high-performance dynamic plowing
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public snowTexture: THREE.CanvasTexture;
  public snowMesh: THREE.Mesh;
  public groundMesh: THREE.Mesh;

  // Resolution
  public resX: number = 512;
  public resY: number = 512;

  // Road mask: determines where snow needs to be cleared for mission completion
  public roadMaskCanvas: HTMLCanvasElement;
  public roadMaskCtx: CanvasRenderingContext2D;
  public totalRoadPixels: number = 0;
  public clearedRoadPixels: number = 0;

  // Snow particles pool (Spray & steam)
  private maxParticles = 450;
  private particlePool: SnowParticle[] = [];
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.PointsMaterial;
  private particlePoints: THREE.Points;
  private posAttr: THREE.BufferAttribute;

  // Falling ambient snowflakes
  private ambientFlakesGeo: THREE.BufferGeometry;
  private ambientFlakesPoints: THREE.Points;
  private ambientCount = 750;

  // Combo tracking
  public currentCombo: number = 1.0;
  public comboTimer: number = 0;
  public maxCombo: number = 1.0;
  private lastClearedTier: number = 1;
  public recentClearingIntensity: number = 0;

  // Stats & Money
  public totalClearedKg: number = 0;
  public cashEarned: number = 0;

  // Snow Gathering & Dragging System (Blade Load)
  public bladeGatheredSnowKg: number = 0;
  public maxBladeLoadCapacity: number = 1500;
  public stackedMounds: StackedMoundData[] = [];

  // Designated Snow Disposal & Community Sculpture Zones
  public disposalZones: { x: number; z: number; radius: number; name: string }[] = [];
  public sculptureZone: {
    x: number;
    z: number;
    radius: number;
    currentKg: number;
    goalKg: number;
  } | null = null;

  // Callbacks
  public onSnowDisposed?: (payout: number, totalDisposedKg: number) => void;
  public onSculptureProgress?: (currentKg: number, goalKg: number) => void;

  constructor(scene: THREE.Scene, mapWidth: number, mapDepth: number) {
    this.scene = scene;
    this.mapWidth = mapWidth;
    this.mapDepth = mapDepth;

    // 1. Create Snow Canvas & Texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resX;
    this.canvas.height = this.resY;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D context for snow canvas');
    this.ctx = ctx;

    // 2. Road Mask Canvas to detect roads and calculate % cleared
    this.roadMaskCanvas = document.createElement('canvas');
    this.roadMaskCanvas.width = this.resX;
    this.roadMaskCanvas.height = this.resY;
    const rCtx = this.roadMaskCanvas.getContext('2d', { willReadFrequently: true });
    if (!rCtx) throw new Error('Could not get 2D context for road mask');
    this.roadMaskCtx = rCtx;

    // Setup initial snow map
    this.initSnowSurface();

    // 3. Ground Terrain Mesh (Dark wet asphalt & road pavement underneath)
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 256;
    groundCanvas.height = 256;
    const gCtx = groundCanvas.getContext('2d')!;
    gCtx.fillStyle = '#1e252b'; // Dark wet pavement
    gCtx.fillRect(0, 0, 256, 256);

    // Realistic road aggregate grain & tire sheen lines
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      gCtx.fillStyle = Math.random() > 0.5 ? '#151b20' : '#2d3741';
      gCtx.fillRect(rx, ry, 2, 2);
    }
    // Subtle double yellow road center markings
    gCtx.fillStyle = 'rgba(255, 179, 0, 0.4)';
    gCtx.fillRect(126, 0, 2, 256);
    gCtx.fillRect(130, 0, 2, 256);

    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(16, 16);

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.55,
      metalness: 0.25,
    });
    const groundGeom = new THREE.PlaneGeometry(mapWidth + 50, mapDepth + 50);
    this.groundMesh = new THREE.Mesh(groundGeom, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = 0.0;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // 4. Dynamic Snow Mesh Plane sitting right on top
    this.snowTexture = new THREE.CanvasTexture(this.canvas);
    this.snowTexture.colorSpace = THREE.SRGBColorSpace;
    this.snowTexture.minFilter = THREE.LinearFilter;
    this.snowTexture.magFilter = THREE.LinearFilter;

    // By using map with transparent: true, when pixels are erased (alpha 0),
    // the dark wet asphalt and scraped road surface underneath is 100% visible!
    const snowMat = new THREE.MeshStandardMaterial({
      map: this.snowTexture,
      roughness: 0.95,
      metalness: 0.02,
      transparent: true,
      depthWrite: false, // Prevents z-fighting with the ground mesh
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const snowGeom = new THREE.PlaneGeometry(mapWidth, mapDepth, 64, 64);
    this.snowMesh = new THREE.Mesh(snowGeom, snowMat);
    this.snowMesh.rotation.x = -Math.PI / 2;
    this.snowMesh.position.y = 0.03;
    this.snowMesh.receiveShadow = true;
    this.scene.add(this.snowMesh);

    // 5. Snow Particles Pool (Plow spray & steam)
    this.particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxParticles * 3);
    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.particleGeo.setAttribute('position', this.posAttr);

    // Procedural round soft snowflake particle texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d')!;
    const pGrad = pCtx.createRadialGradient(16, 16, 2, 16, 16, 15);
    pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    pGrad.addColorStop(0.5, 'rgba(240, 248, 255, 0.85)');
    pGrad.addColorStop(1, 'rgba(240, 248, 255, 0)');
    pCtx.fillStyle = pGrad;
    pCtx.beginPath();
    pCtx.arc(16, 16, 15, 0, Math.PI * 2);
    pCtx.fill();
    const pTexture = new THREE.CanvasTexture(pCanvas);

    this.particleMat = new THREE.PointsMaterial({
      size: 0.55,
      map: pTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particlePoints = new THREE.Points(this.particleGeo, this.particleMat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);

    // Initialize particle pool objects
    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePool.push({
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(),
        size: 0.5,
        alpha: 0,
        life: 0,
        maxLife: 1,
      });
    }

    // 6. Ambient Falling Snowflakes
    const ambPositions = new Float32Array(this.ambientCount * 3);
    for (let i = 0; i < this.ambientCount; i++) {
      ambPositions[i * 3 + 0] = (Math.random() - 0.5) * (mapWidth + 20);
      ambPositions[i * 3 + 1] = Math.random() * 25 + 0.5;
      ambPositions[i * 3 + 2] = (Math.random() - 0.5) * (mapDepth + 20);
    }
    this.ambientFlakesGeo = new THREE.BufferGeometry();
    this.ambientFlakesGeo.setAttribute('position', new THREE.BufferAttribute(ambPositions, 3));

    const ambMat = new THREE.PointsMaterial({
      size: 0.35,
      map: pTexture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.ambientFlakesPoints = new THREE.Points(this.ambientFlakesGeo, ambMat);
    this.scene.add(this.ambientFlakesPoints);
  }

  /**
   * Fills the snow canvas with white snow opacity and prepares the road mask
   */
  public initSnowSurface() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.resX, this.resY);

    this.roadMaskCtx.fillStyle = '#000000';
    this.roadMaskCtx.fillRect(0, 0, this.resX, this.resY);
  }

  /**
   * Paints a road/driveway into the road mask so we track plow completion
   */
  public addRoadSegment(x1: number, z1: number, x2: number, z2: number, width: number) {
    const p1 = this.worldToCanvas(x1, z1);
    const p2 = this.worldToCanvas(x2, z2);
    const pixelWidth = (width / this.mapWidth) * this.resX;

    this.roadMaskCtx.strokeStyle = '#ffffff';
    this.roadMaskCtx.lineWidth = pixelWidth;
    this.roadMaskCtx.lineCap = 'round';
    this.roadMaskCtx.lineJoin = 'round';
    this.roadMaskCtx.beginPath();
    this.roadMaskCtx.moveTo(p1.x, p1.y);
    this.roadMaskCtx.lineTo(p2.x, p2.y);
    this.roadMaskCtx.stroke();

    this.calculateTotalRoadPixels();
  }

  public addPlazaZone(cx: number, cz: number, radius: number) {
    const p = this.worldToCanvas(cx, cz);
    const pixelRadius = (radius / this.mapWidth) * this.resX;

    this.roadMaskCtx.fillStyle = '#ffffff';
    this.roadMaskCtx.beginPath();
    this.roadMaskCtx.arc(p.x, p.y, pixelRadius, 0, Math.PI * 2);
    this.roadMaskCtx.fill();

    this.calculateTotalRoadPixels();
  }

  private calculateTotalRoadPixels() {
    const imgData = this.roadMaskCtx.getImageData(0, 0, this.resX, this.resY);
    let count = 0;
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (imgData.data[i] > 128) {
        count++;
      }
    }
    this.totalRoadPixels = Math.max(count, 1);
  }

  /**
   * Convert world coordinates (X, Z) to Canvas Pixel (x, y)
   */
  public worldToCanvas(worldX: number, worldZ: number): { x: number; y: number } {
    const x = ((worldX + this.mapWidth * 0.5) / this.mapWidth) * this.resX;
    const y = ((worldZ + this.mapDepth * 0.5) / this.mapDepth) * this.resY;
    return { x, y };
  }

  /**
   * Plow snow along blade segment, gather and drag snow, side-cast if angled
   */
  public plowSnow(
    bladeCenter: THREE.Vector3,
    headingAngle: number,
    bladeAngle: number, // -0.45 (left) to 0 (straight) to +0.45 (right)
    bladeWidth: number,
    truckSpeed: number,
    blowerLevel: number,
    saltLevel: number
  ): { clearedAmount: number; intensity: number; gatheredSnowKg: number } {
    if (Math.abs(truckSpeed) < 0.2) {
      this.recentClearingIntensity = THREE.MathUtils.damp(this.recentClearingIntensity, 0, 8, 0.05);
      soundEngine.setSnowClearingIntensity(0);
      return { clearedAmount: 0, intensity: 0, gatheredSnowKg: this.bladeGatheredSnowKg };
    }

    const pos = this.worldToCanvas(bladeCenter.x, bladeCenter.z);
    const pixelWidth = (bladeWidth / this.mapWidth) * this.resX * 1.1;
    const scrapeLength = (Math.abs(truckSpeed) * 0.14 / this.mapWidth) * this.resX + 4.0;

    // Compute blade perpendicular vector to sample across entire blade width
    const totalAngle = headingAngle + bladeAngle;
    const rightX = Math.cos(totalAngle);
    const rightY = Math.sin(totalAngle);

    // Multi-point sampling across the blade (5 sample points)
    const numSamples = 5;
    let totalSnowAlpha = 0;
    for (let s = 0; s < numSamples; s++) {
      const offset = (s / (numSamples - 1) - 0.5) * pixelWidth * 0.85;
      const sx = Math.floor(Math.max(0, Math.min(this.resX - 1, pos.x + rightX * offset)));
      const sy = Math.floor(Math.max(0, Math.min(this.resY - 1, pos.y + rightY * offset)));
      const pixel = this.ctx.getImageData(sx, sy, 1, 1).data;
      totalSnowAlpha += pixel[3]; // check alpha channel
    }
    const avgSnowAlpha = totalSnowAlpha / numSamples;

    // Erase snow along blade path using 'destination-out'
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.translate(pos.x, pos.y);
    this.ctx.rotate(totalAngle);
    this.ctx.fillStyle = '#000000'; // Clears both RGB and Alpha

    // Elliptical blade scraper
    const w = pixelWidth;
    const h = scrapeLength;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, Math.max(w * 0.5, 3), Math.max(h * 0.6, 3), 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
    this.snowTexture.needsUpdate = true;

    // Check if snow was cleared
    let clearedKg = 0;
    let clearingIntensity = 0;

    if (avgSnowAlpha > 12) {
      clearingIntensity = (avgSnowAlpha / 255) * Math.min(Math.abs(truckSpeed) / 7, 1.3);
      clearedKg = (bladeWidth * 2.8) * (Math.abs(truckSpeed) * 0.22) * (avgSnowAlpha / 255);

      if (blowerLevel > 0) {
        clearedKg *= 1 + blowerLevel * 0.45;
      }

      this.totalClearedKg += clearedKg;
      const earnings = clearedKg * 0.45 * this.currentCombo * (1 + saltLevel * 0.25);
      this.cashEarned += earnings;

      // ACCUMULATE & DRAG SNOW IN FRONT OF BLADE!
      const isStraight = Math.abs(bladeAngle) < 0.2;
      if (isStraight) {
        // Straight blade gathers and drags 100% of plowed snow
        this.bladeGatheredSnowKg = Math.min(
          this.bladeGatheredSnowKg + clearedKg,
          this.maxBladeLoadCapacity
        );
      } else {
        // Angled blade drags 35%, and casts 65% to the road shoulder as neat snowbanks!
        this.bladeGatheredSnowKg = Math.min(
          this.bladeGatheredSnowKg + clearedKg * 0.35,
          this.maxBladeLoadCapacity
        );
      }

      // Update combo!
      this.comboTimer = 3.2; // 3.2 seconds combo grace period
      this.currentCombo = Math.min(this.currentCombo + 0.02 * (1 + blowerLevel * 0.25), 10.0);
      if (this.currentCombo > this.maxCombo) {
        this.maxCombo = this.currentCombo;
      }

      // Check if we hit a new integer combo tier
      const currentTier = Math.floor(this.currentCombo);
      if (currentTier > this.lastClearedTier) {
        this.lastClearedTier = currentTier;
        soundEngine.playComboChime(currentTier);
      }

      // Spawn snow spray particles
      this.spawnSnowSpray(bladeCenter, headingAngle, bladeAngle, bladeWidth, truckSpeed, blowerLevel);
    } else {
      clearingIntensity = 0;
    }

    this.recentClearingIntensity = THREE.MathUtils.damp(
      this.recentClearingIntensity,
      clearingIntensity,
      12,
      0.05
    );
    soundEngine.setSnowClearingIntensity(this.recentClearingIntensity);

    return {
      clearedAmount: clearedKg,
      intensity: this.recentClearingIntensity,
      gatheredSnowKg: this.bladeGatheredSnowKg,
    };
  }

  /**
   * Deposit and stack all snow currently gathered in front of the blade!
   * Creates real 3D snow mounds, or dumps into Melt Pit / Community Snowman
   */
  public depositSnow(bladePos: THREE.Vector3): {
    dumpedKg: number;
    isDisposal: boolean;
    isSculpture: boolean;
  } {
    if (this.bladeGatheredSnowKg < 5) {
      return { dumpedKg: 0, isDisposal: false, isSculpture: false };
    }

    const amount = this.bladeGatheredSnowKg;
    this.bladeGatheredSnowKg = 0;

    // 1. Check if inside a designated Snow Disposal Chute / Melt Pit Zone
    for (const zone of this.disposalZones) {
      const dx = bladePos.x - zone.x;
      const dz = bladePos.z - zone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= zone.radius) {
        const bonusCash = Math.round(amount * 1.5); // Big jackpot bonus!
        this.cashEarned += bonusCash;
        soundEngine.playMeltChuteBonus();
        this.spawnMeltSteam(bladePos);
        if (this.onSnowDisposed) {
          this.onSnowDisposed(bonusCash, amount);
        }
        return { dumpedKg: amount, isDisposal: true, isSculpture: false };
      }
    }

    // 2. Check if inside Community Sculpture Zone
    if (this.sculptureZone) {
      const dx = bladePos.x - this.sculptureZone.x;
      const dz = bladePos.z - this.sculptureZone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= this.sculptureZone.radius) {
        this.sculptureZone.currentKg = Math.min(
          this.sculptureZone.currentKg + amount,
          this.sculptureZone.goalKg
        );
        soundEngine.playUpgradeDing();
        if (this.onSculptureProgress) {
          this.onSculptureProgress(this.sculptureZone.currentKg, this.sculptureZone.goalKg);
        }
        return { dumpedKg: amount, isDisposal: false, isSculpture: true };
      }
    }

    // 3. Otherwise: Stack a physical 3D snow mound on the ground at this exact spot!
    this.createOrMergeSnowMound(bladePos.x, bladePos.z, amount);
    soundEngine.playSnowDump(amount);

    return { dumpedKg: amount, isDisposal: false, isSculpture: false };
  }

  /**
   * Creates or merges into an existing 3D stacked snow mound on the terrain
   */
  private createOrMergeSnowMound(x: number, z: number, amountKg: number) {
    let targetMound: StackedMoundData | null = null;
    for (const mound of this.stackedMounds) {
      const dx = mound.worldX - x;
      const dz = mound.worldZ - z;
      if (Math.sqrt(dx * dx + dz * dz) < 3.8) {
        targetMound = mound;
        break;
      }
    }

    if (targetMound) {
      targetMound.snowKg += amountKg;
      const baseRadius = 1.3 + Math.pow(targetMound.snowKg / 250, 0.42);
      const baseHeight = 0.8 + Math.pow(targetMound.snowKg / 250, 0.45) * 0.95;
      targetMound.radius = Math.min(baseRadius, 5.5);
      targetMound.height = Math.min(baseHeight, 3.8);

      targetMound.mesh.scale.set(
        targetMound.radius,
        targetMound.height,
        targetMound.radius
      );
    } else {
      const radius = Math.min(1.3 + Math.pow(amountKg / 250, 0.42), 4.5);
      const height = Math.min(0.8 + Math.pow(amountKg / 250, 0.45) * 0.95, 3.2);

      const moundMesh = createStackedSnowMoundMesh(1.0, 1.0);
      moundMesh.scale.set(radius, height, radius);
      moundMesh.position.set(x, 0.05, z);
      this.scene.add(moundMesh);

      this.stackedMounds.push({
        mesh: moundMesh,
        worldX: x,
        worldZ: z,
        radius,
        height,
        snowKg: amountKg,
      });

      if (this.stackedMounds.length > 50) {
        const oldest = this.stackedMounds.shift();
        if (oldest) {
          this.scene.remove(oldest.mesh);
          oldest.mesh.geometry.dispose();
        }
      }
    }

    // Also draw visible white snow mound patch onto canvas
    const p = this.worldToCanvas(x, z);
    const pixelRadius = (2.5 / this.mapWidth) * this.resX;
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, pixelRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    this.snowTexture.needsUpdate = true;
  }

  /**
   * Spawn steam particle burst when dumping snow into Melt Pit
   */
  private spawnMeltSteam(pos: THREE.Vector3) {
    for (let i = 0; i < 30; i++) {
      const p = this.getAvailableParticle();
      if (!p) break;

      p.pos.set(
        pos.x + (Math.random() - 0.5) * 3.5,
        0.5 + Math.random() * 0.5,
        pos.z + (Math.random() - 0.5) * 3.5
      );
      p.vel.set(
        (Math.random() - 0.5) * 2.0,
        3.5 + Math.random() * 4.0,
        (Math.random() - 0.5) * 2.0
      );
      p.life = 0;
      p.maxLife = 0.8 + Math.random() * 0.6;
      p.size = 1.2 + Math.random() * 0.8;
      p.alpha = 0.95;
      p.isSteam = true;
    }
  }

  /**
   * Spawn snow spray bursts from blade edges and blower
   */
  private spawnSnowSpray(
    bladeCenter: THREE.Vector3,
    headingAngle: number,
    bladeAngle: number,
    bladeWidth: number,
    speed: number,
    blowerLevel: number
  ) {
    const totalAngle = headingAngle + bladeAngle;
    const forwardX = Math.sin(totalAngle);
    const forwardZ = Math.cos(totalAngle);
    const rightX = Math.cos(totalAngle);
    const rightZ = -Math.sin(totalAngle);

    const count = Math.min(Math.floor(Math.abs(speed) * 2.5) + 3, 10);

    for (let i = 0; i < count; i++) {
      const p = this.getAvailableParticle();
      if (!p) break;

      const side = Math.random() > 0.5 ? 1 : -1;
      const spreadX = rightX * side * (bladeWidth * 0.45 + Math.random() * 0.4);
      const spreadZ = rightZ * side * (bladeWidth * 0.45 + Math.random() * 0.4);

      p.pos.set(
        bladeCenter.x + spreadX,
        0.35 + Math.random() * 0.25,
        bladeCenter.z + spreadZ
      );

      const sideSpeed = (Math.abs(speed) * 0.55 + 2.0) * (0.8 + Math.random() * 0.5);
      const forwardSpeed = speed * 0.35;
      const upSpeed = 2.0 + Math.random() * 2.5;

      p.vel.set(
        rightX * side * sideSpeed + forwardX * forwardSpeed + (Math.random() - 0.5),
        upSpeed,
        rightZ * side * sideSpeed + forwardZ * forwardSpeed + (Math.random() - 0.5)
      );

      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.size = 0.45 + Math.random() * 0.35;
      p.alpha = 0.9;
      p.isSteam = false;
    }

    // Snow Blower plume
    if (blowerLevel > 0) {
      for (let j = 0; j < 3; j++) {
        const bp = this.getAvailableParticle();
        if (!bp) break;

        bp.pos.set(
          bladeCenter.x + rightX * 0.6,
          1.6 + Math.random() * 0.3,
          bladeCenter.z + rightZ * 0.6
        );

        const blowerArcSpeed = 7.0 + blowerLevel * 2.0 + Math.random() * 2.0;
        bp.vel.set(
          rightX * blowerArcSpeed + forwardX * 2.0 + (Math.random() - 0.5) * 1.5,
          5.5 + Math.random() * 3.0,
          rightZ * blowerArcSpeed + forwardZ * 2.0 + (Math.random() - 0.5) * 1.5
        );

        bp.life = 0;
        bp.maxLife = 0.85 + Math.random() * 0.4;
        bp.size = 0.6 + Math.random() * 0.4;
        bp.alpha = 1.0;
        bp.isSteam = false;
      }
    }
  }

  private getAvailableParticle(): SnowParticle | null {
    for (let i = 0; i < this.particlePool.length; i++) {
      if (this.particlePool[i].life >= this.particlePool[i].maxLife) {
        return this.particlePool[i];
      }
    }
    return null;
  }

  /**
   * Update particle physics, ambient snowflakes, and combo decay
   */
  public update(dt: number, cameraPos: THREE.Vector3) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.currentCombo = THREE.MathUtils.damp(this.currentCombo, 1.0, 4.0, dt);
        this.lastClearedTier = Math.floor(this.currentCombo);
      }
    } else {
      this.currentCombo = THREE.MathUtils.damp(this.currentCombo, 1.0, 3.0, dt);
      this.lastClearedTier = Math.floor(this.currentCombo);
    }

    const positions = this.posAttr.array as Float32Array;
    const gravity = -14.0;

    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (p.life < p.maxLife) {
        p.life += dt;
        if (p.isSteam) {
          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          p.pos.z += p.vel.z * dt;
        } else {
          p.vel.y += gravity * dt;
          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          p.pos.z += p.vel.z * dt;

          if (p.pos.y <= 0.05) {
            p.pos.y = 0.05;
            p.vel.set(0, 0, 0);
            p.life += dt * 2.0;
          }
        }

        positions[i * 3 + 0] = p.pos.x;
        positions[i * 3 + 1] = p.pos.y;
        positions[i * 3 + 2] = p.pos.z;
      } else {
        positions[i * 3 + 1] = -999;
      }
    }
    this.posAttr.needsUpdate = true;

    // Ambient snowflakes falling
    const ambPos = this.ambientFlakesGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < this.ambientCount; i++) {
      let y = ambPos[i * 3 + 1] - 4.5 * dt;
      let x = ambPos[i * 3 + 0] + Math.sin(y * 0.4 + i) * 0.03;
      let z = ambPos[i * 3 + 2] + Math.cos(y * 0.3 + i) * 0.03;

      if (y < 0.2) {
        y = 25.0 + Math.random() * 5.0;
        x = cameraPos.x + (Math.random() - 0.5) * 60;
        z = cameraPos.z + (Math.random() - 0.5) * 60;
      }

      ambPos[i * 3 + 0] = x;
      ambPos[i * 3 + 1] = y;
      ambPos[i * 3 + 2] = z;
    }
    this.ambientFlakesGeo.attributes.position.needsUpdate = true;
  }

  /**
   * Samples road mask and snow canvas to compute cleared percent (0 to 100)
   */
  public getClearedRoadPercent(): number {
    if (this.totalRoadPixels <= 0) return 0;

    const step = 8;
    let sampledRoads = 0;
    let sampledCleared = 0;

    const roadData = this.roadMaskCtx.getImageData(0, 0, this.resX, this.resY).data;
    const snowData = this.ctx.getImageData(0, 0, this.resX, this.resY).data;

    for (let y = 0; y < this.resY; y += step) {
      for (let x = 0; x < this.resX; x += step) {
        const idx = (y * this.resX + x) * 4;
        if (roadData[idx] > 120) {
          sampledRoads++;
          if (snowData[idx + 3] < 80) {
            sampledCleared++;
          }
        }
      }
    }

    if (sampledRoads === 0) return 0;
    return Math.min(Math.round((sampledCleared / sampledRoads) * 100), 100);
  }

  public dispose() {
    this.snowTexture.dispose();
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.ambientFlakesGeo.dispose();
    this.stackedMounds.forEach((m) => {
      this.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
    });
    this.stackedMounds = [];
  }
}
