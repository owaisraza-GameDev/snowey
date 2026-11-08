import * as THREE from 'three';
import { TruckUpgrades } from './types';

/**
 * Creates a procedural 3-12 part composite snow plow truck.
 * Follows Three.js skill guidelines:
 * - Multi-part composite model (chassis, cab, blade, hydraulics, wheels, beacon, exhaust, headlights, bed)
 * - Varied roughness and metalness between parts
 * - Grounded bottom-center pivot with soft contact shadow plane
 */
export function createPlowTruck(upgrades: TruckUpgrades): {
  truckGroup: THREE.Group;
  wheels: THREE.Mesh[];
  beaconLight: THREE.PointLight;
  beaconMesh: THREE.Mesh;
  headlights: THREE.SpotLight[];
  bladeGroup: THREE.Group;
  bladeSnowWedge: THREE.Mesh;
  exhaustPipes: THREE.Mesh[];
  bladeWidth: number;
} {
  const truckGroup = new THREE.Group();

  // Materials
  const paintColor = new THREE.Color(upgrades.paintColor || '#e65100'); // Safety orange default
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x22252a,
    metalness: 0.8,
    roughness: 0.35,
  });

  const cabMat = new THREE.MeshStandardMaterial({
    color: paintColor,
    metalness: 0.3,
    roughness: 0.25,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x82b1ff,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.65,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdde2e6,
    metalness: 0.95,
    roughness: 0.1,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18191c,
    metalness: 0.1,
    roughness: 0.85,
  });

  const wheelRimMat = new THREE.MeshStandardMaterial({
    color: 0x78909c,
    metalness: 0.8,
    roughness: 0.3,
  });

  const bladeColor = upgrades.saltLevel > 0 ? 0xff5722 : 0xfbc02d; // Heat glow or Safety gold
  const bladeMat = new THREE.MeshStandardMaterial({
    color: bladeColor,
    metalness: 0.6,
    roughness: 0.3,
  });

  const bladeTrimMat = new THREE.MeshStandardMaterial({
    color: 0x212121,
    metalness: 0.4,
    roughness: 0.7,
  });

  // Procedural Hazard Striping Canvas Texture for Blade Chevrons
  const chevronCanvas = document.createElement('canvas');
  chevronCanvas.width = 256;
  chevronCanvas.height = 64;
  const cCtx = chevronCanvas.getContext('2d');
  if (cCtx) {
    cCtx.fillStyle = '#fbc02d';
    cCtx.fillRect(0, 0, 256, 64);
    cCtx.fillStyle = '#212121';
    for (let x = -64; x < 320; x += 32) {
      cCtx.beginPath();
      cCtx.moveTo(x, 0);
      cCtx.lineTo(x + 20, 0);
      cCtx.lineTo(x - 12, 64);
      cCtx.lineTo(x - 32, 64);
      cCtx.closePath();
      cCtx.fill();
    }
  }
  const chevronTexture = new THREE.CanvasTexture(chevronCanvas);
  chevronTexture.wrapS = THREE.RepeatWrapping;
  chevronTexture.repeat.set(3, 1);

  const chevronMat = new THREE.MeshStandardMaterial({
    map: chevronTexture,
    metalness: 0.3,
    roughness: 0.4,
  });

  // 1. Heavy Box Chassis
  const chassisGeom = new THREE.BoxGeometry(1.6, 0.45, 3.4);
  const chassis = new THREE.Mesh(chassisGeom, chassisMat);
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  truckGroup.add(chassis);

  // Chassis Fuel Tank (Right side)
  const fuelTank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 1.1, 12),
    chromeMat
  );
  fuelTank.rotateZ(Math.PI / 2);
  fuelTank.position.set(0.85, 0.45, -0.2);
  truckGroup.add(fuelTank);

  // Chassis Battery Box & Steps (Left side)
  const stepBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.22, 1.1),
    chassisMat
  );
  stepBox.position.set(-0.85, 0.45, -0.2);
  truckGroup.add(stepBox);

  // 2. Cab Body
  const cabGeom = new THREE.BoxGeometry(1.5, 1.1, 1.6);
  const cab = new THREE.Mesh(cabGeom, cabMat);
  cab.position.set(0, 1.25, -0.2);
  cab.castShadow = true;
  cab.receiveShadow = true;
  truckGroup.add(cab);

  // Cab hood / engine bay
  const hoodGeom = new THREE.BoxGeometry(1.48, 0.6, 1.1);
  const hood = new THREE.Mesh(hoodGeom, cabMat);
  hood.position.set(0, 0.95, 1.05);
  hood.castShadow = true;
  hood.receiveShadow = true;
  truckGroup.add(hood);

  // Heavy Front Chrome Grille with Horizontal Slats
  const grilleBack = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.52, 0.08),
    chassisMat
  );
  grilleBack.position.set(0, 0.95, 1.62);
  truckGroup.add(grilleBack);

  // 4 Chrome grille slats
  for (let s = -0.18; s <= 0.18; s += 0.12) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.035, 0.06),
      chromeMat
    );
    slat.position.set(0, 0.95 + s, 1.65);
    truckGroup.add(slat);
  }

  // Front Tow Hooks (Red high-tensile recovery hooks)
  const hookMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, metalness: 0.8, roughness: 0.3 });
  [-0.45, 0.45].forEach((hx) => {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 12), hookMat);
    hook.position.set(hx, 0.52, 1.68);
    hook.rotation.y = Math.PI / 2;
    truckGroup.add(hook);
  });

  // Windshield & side windows
  const frontWindshieldGeom = new THREE.BoxGeometry(1.36, 0.65, 0.1);
  const frontWindshield = new THREE.Mesh(frontWindshieldGeom, glassMat);
  frontWindshield.position.set(0, 1.45, 0.6);
  frontWindshield.rotation.x = -0.2;
  truckGroup.add(frontWindshield);

  // Cab Visor with 5 Amber Clearance LEDs
  const visorGeom = new THREE.BoxGeometry(1.52, 0.1, 0.35);
  const visor = new THREE.Mesh(visorGeom, chassisMat);
  visor.position.set(0, 1.82, 0.62);
  visor.rotation.x = 0.15;
  truckGroup.add(visor);

  const ledAmberMat = new THREE.MeshStandardMaterial({
    color: 0xffa000,
    emissive: 0xff8f00,
    emissiveIntensity: 2.5,
  });
  for (let lx = -0.5; lx <= 0.5; lx += 0.25) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), ledAmberMat);
    led.position.set(lx, 1.83, 0.76);
    truckGroup.add(led);
  }

  // Side Door Mirrors
  [-0.85, 0.85].forEach((mx) => {
    const mirrorBracket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
      chassisMat
    );
    mirrorBracket.position.set(mx, 1.45, 0.2);
    mirrorBracket.rotation.z = mx > 0 ? -0.4 : 0.4;
    truckGroup.add(mirrorBracket);

    const mirrorHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.22, 0.14),
      chromeMat
    );
    mirrorHead.position.set(mx * 1.08, 1.5, 0.2);
    truckGroup.add(mirrorHead);
  });

  // Cab Interior: Steering Wheel & Dashboard Glow
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0x00e676,
    emissive: 0x00c853,
    emissiveIntensity: 1.5,
  });
  const dashCluster = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.1), dashMat);
  dashCluster.position.set(-0.25, 1.15, 0.38);
  truckGroup.add(dashCluster);

  const steerWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.025, 6, 12),
    chassisMat
  );
  steerWheel.position.set(-0.35, 1.25, 0.25);
  steerWheel.rotation.x = 0.5;
  truckGroup.add(steerWheel);

  const rearWindowGeom = new THREE.BoxGeometry(1.3, 0.5, 0.08);
  const rearWindow = new THREE.Mesh(rearWindowGeom, glassMat);
  rearWindow.position.set(0, 1.45, -1.01);
  truckGroup.add(rearWindow);

  // 3. Truck Bed & Hopper (holds salt / sand)
  const bedGeom = new THREE.BoxGeometry(1.55, 0.7, 1.4);
  const bed = new THREE.Mesh(bedGeom, cabMat);
  bed.position.set(0, 0.95, -1.2);
  bed.castShadow = true;
  bed.receiveShadow = true;
  truckGroup.add(bed);

  // Heavy Duty Rear Mudflaps
  const flapMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const flapReflectMat = new THREE.MeshStandardMaterial({
    color: 0xd50000,
    emissive: 0xc62828,
    emissiveIntensity: 1.5,
  });
  [-0.75, 0.75].forEach((fx) => {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.45, 0.04), flapMat);
    flap.position.set(fx, 0.4, -1.6);
    truckGroup.add(flap);

    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.05), flapReflectMat);
    tab.position.set(fx, 0.28, -1.61);
    truckGroup.add(tab);
  });

  // Hopper inside bed
  const hopperGeom = new THREE.CylinderGeometry(0.65, 0.4, 0.6, 8);
  const hopper = new THREE.Mesh(hopperGeom, chassisMat);
  hopper.position.set(0, 1.35, -1.2);
  hopper.castShadow = true;
  truckGroup.add(hopper);

  // 4. Wheels with Tire Snow Chains on Rear Axle
  const wheels: THREE.Mesh[] = [];
  const wheelRadius = 0.42;
  const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.32, 16);
  wheelGeom.rotateZ(Math.PI / 2);

  const chainMat = new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    metalness: 0.9,
    roughness: 0.25,
  });

  const wheelPositions = [
    [-0.92, wheelRadius, 1.0, false],  // Front Left
    [0.92, wheelRadius, 1.0, false],   // Front Right
    [-0.92, wheelRadius, -1.1, true],  // Rear Left (Snow Chains!)
    [0.92, wheelRadius, -1.1, true],   // Rear Right (Snow Chains!)
  ];

  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeom, tireMat);
    tire.castShadow = true;

    // Rim
    const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 12);
    rimGeom.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeom, wheelRimMat);
    wheelGroup.add(tire);
    wheelGroup.add(rim);

    // Rear Tire Snow Chains for icy grip
    if (pos[3]) {
      for (let c = 0; c < 8; c++) {
        const chainLink = new THREE.Mesh(
          new THREE.TorusGeometry(0.43, 0.02, 6, 12),
          chainMat
        );
        chainLink.rotation.y = (c * Math.PI) / 4;
        wheelGroup.add(chainLink);
      }
    }

    wheelGroup.position.set(pos[0] as number, pos[1] as number, pos[2] as number);
    truckGroup.add(wheelGroup);
    wheels.push(tire);
  });

  // 5. Heavy Snow Plow Blade
  // Blade width scales with upgrade: Level 1 = 2.4, Level 2 = 3.2, Level 3 = 4.0, Level 4 = 4.8
  const bladeWidthMultiplier = [2.4, 3.2, 4.0, 4.8][Math.min(upgrades.bladeLevel - 1, 3)];
  const bladeGroup = new THREE.Group();

  // Curved plow blade mesh
  const bladeCurveGeom = new THREE.CylinderGeometry(
    bladeWidthMultiplier * 0.5,
    bladeWidthMultiplier * 0.5,
    0.85,
    24,
    1,
    true,
    0,
    Math.PI * 0.45
  );
  bladeCurveGeom.rotateZ(Math.PI / 2);
  bladeCurveGeom.rotateY(-Math.PI * 0.25);

  const bladeMesh = new THREE.Mesh(bladeCurveGeom, bladeMat);
  bladeMesh.castShadow = true;
  bladeMesh.receiveShadow = true;
  bladeGroup.add(bladeMesh);

  // Chevron Hazard Decals on Blade Wings
  const chevronBand = new THREE.Mesh(
    new THREE.BoxGeometry(bladeWidthMultiplier * 0.96, 0.14, 0.04),
    chevronMat
  );
  chevronBand.position.set(0, 0.22, 0.15);
  bladeGroup.add(chevronBand);

  // Blade lower rubber scrape strip
  const scraperGeom = new THREE.BoxGeometry(bladeWidthMultiplier, 0.12, 0.12);
  const scraper = new THREE.Mesh(scraperGeom, bladeTrimMat);
  scraper.position.set(0, -0.38, 0.2);
  bladeGroup.add(scraper);

  // Blade hydraulic push arms
  const armGeom = new THREE.BoxGeometry(0.12, 0.14, 0.9);
  const leftArm = new THREE.Mesh(armGeom, chassisMat);
  leftArm.position.set(-0.55, -0.1, -0.4);
  const rightArm = new THREE.Mesh(armGeom, chassisMat);
  rightArm.position.set(0.55, -0.1, -0.4);
  bladeGroup.add(leftArm);
  bladeGroup.add(rightArm);

  // Dynamic Gathered Snow Mound (billows and grows in front of blade as snow is dragged!)
  const snowWedgeGeom = new THREE.CylinderGeometry(
    bladeWidthMultiplier * 0.46,
    bladeWidthMultiplier * 0.48,
    0.7,
    16,
    1,
    false,
    0,
    Math.PI
  );
  snowWedgeGeom.rotateZ(Math.PI / 2);
  snowWedgeGeom.rotateY(-Math.PI * 0.5);

  const snowWedgeMat = new THREE.MeshStandardMaterial({
    color: 0xf5faff,
    roughness: 0.9,
    metalness: 0.05,
  });
  const bladeSnowWedge = new THREE.Mesh(snowWedgeGeom, snowWedgeMat);
  bladeSnowWedge.position.set(0, -0.05, 0.35);
  bladeSnowWedge.scale.set(0.001, 0.001, 0.001); // starts invisible until snow is gathered
  bladeGroup.add(bladeSnowWedge);

  // Mount blade in front of truck
  bladeGroup.position.set(0, 0.52, 2.1);
  truckGroup.add(bladeGroup);

  // 6. Rooftop Warning Amber Beacon Light
  const beaconBaseGeom = new THREE.CylinderGeometry(0.15, 0.18, 0.08, 12);
  const beaconBase = new THREE.Mesh(beaconBaseGeom, chromeMat);
  beaconBase.position.set(0, 1.84, -0.2);
  truckGroup.add(beaconBase);

  const beaconDomeGeom = new THREE.SphereGeometry(0.12, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xffa000,
    emissive: 0xff6f00,
    emissiveIntensity: 2.0,
    roughness: 0.1,
  });
  const beaconMesh = new THREE.Mesh(beaconDomeGeom, beaconMat);
  beaconMesh.position.set(0, 1.88, -0.2);
  truckGroup.add(beaconMesh);

  const beaconLight = new THREE.PointLight(0xffb300, 2.0, 6, 1.8);
  beaconLight.position.set(0, 2.0, -0.2);
  truckGroup.add(beaconLight);

  // 7. Headlights + Cozy Volumetric Beams
  const headlights: THREE.SpotLight[] = [];
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff9c4,
    emissive: 0xfff176,
    emissiveIntensity: 3.0,
  });

  const beamGeom = new THREE.ConeGeometry(1.6, 9.0, 12, 1, true);
  beamGeom.rotateX(-Math.PI / 2);
  beamGeom.translate(0, 0, 4.5);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff9c4,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  [-0.6, 0.6].forEach((xPos) => {
    const hlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.1), headlightMat);
    hlMesh.position.set(xPos, 0.9, 1.5);
    truckGroup.add(hlMesh);

    // Glowing beam cone
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.set(xPos, 0.9, 1.55);
    truckGroup.add(beam);

    const spot = new THREE.SpotLight(0xfff8e1, 3.5, 18, Math.PI * 0.25, 0.4, 1.2);
    spot.position.set(xPos, 0.9, 1.55);
    spot.target.position.set(xPos, 0.2, 8);
    spot.castShadow = false; // keep software webgl high perf
    truckGroup.add(spot);
    truckGroup.add(spot.target);
    headlights.push(spot);
  });

  // 8. Chrome Vertical Exhaust Pipes
  const exhaustPipes: THREE.Mesh[] = [];
  [-0.78, 0.78].forEach((xPos) => {
    const pipeGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 10);
    const pipe = new THREE.Mesh(pipeGeom, chromeMat);
    pipe.position.set(xPos, 1.7, -0.95);
    pipe.castShadow = true;
    truckGroup.add(pipe);
    exhaustPipes.push(pipe);
  });

  // 9. Snow Blower Attachment (If blower upgraded)
  if (upgrades.blowerLevel > 0) {
    const chuteGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.8, 10);
    const chute = new THREE.Mesh(chuteGeom, bladeMat);
    chute.position.set(0.45, 1.7, 1.3);
    chute.rotation.z = -0.4;
    chute.rotation.x = -0.2;
    chute.castShadow = true;
    truckGroup.add(chute);
  }

  // 10. Turbo Thruster Nozzles on Tailgate (If boost upgraded)
  if (upgrades.boostLevel > 0) {
    const thrusterGeom = new THREE.CylinderGeometry(0.14, 0.18, 0.45, 10);
    thrusterGeom.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0x37474f,
      metalness: 0.9,
      roughness: 0.2,
    });
    [-0.45, 0.45].forEach((xPos) => {
      const thruster = new THREE.Mesh(thrusterGeom, thrusterMat);
      thruster.position.set(xPos, 0.65, -1.95);
      truckGroup.add(thruster);
    });
  }

  // 11. Soft Contact Shadow Plane underneath
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d');
  if (sCtx) {
    const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    grad.addColorStop(0, 'rgba(10, 20, 30, 0.55)');
    grad.addColorStop(0.6, 'rgba(10, 20, 30, 0.25)');
    grad.addColorStop(1, 'rgba(10, 20, 30, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);
  }
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.8,
  });
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.8), shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  truckGroup.add(shadowMesh);

  return {
    truckGroup,
    wheels,
    beaconLight,
    beaconMesh,
    headlights,
    bladeGroup,
    bladeSnowWedge,
    exhaustPipes,
    bladeWidth: bladeWidthMultiplier,
  };
}

/**
 * Creates a cozy Alpine Chalet cabin with snow-laden roof, warm glowing windows,
 * smoking stone chimney, and wooden porch.
 */
export function createCozyChalet(variant: number = 0): THREE.Group {
  const cabin = new THREE.Group();

  // Foundation & Walls
  const wallColors = [0x5d4037, 0x4e342e, 0x6d4c41];
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColors[variant % wallColors.length],
    roughness: 0.85,
    metalness: 0.1,
  });

  const baseGeom = new THREE.BoxGeometry(4.6, 2.6, 4.0);
  const base = new THREE.Mesh(baseGeom, wallMat);
  base.position.y = 1.3;
  base.castShadow = true;
  base.receiveShadow = true;
  cabin.add(base);

  // Stone base trim
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x78909c,
    roughness: 0.9,
    metalness: 0.05,
  });
  const trimGeom = new THREE.BoxGeometry(4.8, 0.5, 4.2);
  const trim = new THREE.Mesh(trimGeom, stoneMat);
  trim.position.y = 0.25;
  trim.castShadow = true;
  trim.receiveShadow = true;
  cabin.add(trim);

  // Pitched Roof
  const roofGeom = new THREE.ConeGeometry(3.6, 2.2, 4);
  roofGeom.rotateY(Math.PI / 4);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.8,
  });
  const roof = new THREE.Mesh(roofGeom, roofMat);
  roof.position.y = 3.6;
  roof.scale.set(1.1, 1.0, 0.95);
  roof.castShadow = true;
  cabin.add(roof);

  // Snow Cap on Roof (thick blanket of snow)
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf5f8fa,
    roughness: 0.95,
    metalness: 0.02,
  });
  const roofSnowGeom = new THREE.ConeGeometry(3.75, 2.1, 4);
  roofSnowGeom.rotateY(Math.PI / 4);
  const roofSnow = new THREE.Mesh(roofSnowGeom, snowMat);
  roofSnow.position.y = 3.75;
  roofSnow.scale.set(1.12, 0.98, 0.97);
  roofSnow.castShadow = true;
  cabin.add(roofSnow);

  // Warm Glowing Windows
  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffd54f,
    emissive: 0xffa000,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const winGeom = new THREE.PlaneGeometry(0.75, 0.85);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
  const snowSillMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: 0.95 });

  // Front windows with cross mullions and snow sills
  [-1.2, 1.2].forEach((xPos) => {
    const win = new THREE.Mesh(winGeom, windowGlowMat);
    win.position.set(xPos, 1.5, 2.02);
    cabin.add(win);

    // Cross mullions
    const vertMullion = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.02), frameMat);
    vertMullion.position.set(xPos, 1.5, 2.03);
    cabin.add(vertMullion);

    const horizMullion = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.02), frameMat);
    horizMullion.position.set(xPos, 1.5, 2.03);
    cabin.add(horizMullion);

    // Snow-dusted window sill
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.12), snowSillMat);
    sill.position.set(xPos, 1.05, 2.06);
    cabin.add(sill);
  });

  // Front wooden door with brass knob
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), doorMat);
  door.position.set(0, 0.95, 2.02);
  cabin.add(door);

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.9, roughness: 0.2 })
  );
  knob.position.set(0.32, 0.95, 2.04);
  cabin.add(knob);

  // Covered Timber Front Porch
  const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 1.2), frameMat);
  porchFloor.position.set(0, 0.1, 2.6);
  porchFloor.receiveShadow = true;
  cabin.add(porchFloor);

  // Two timber porch pillars
  [-1.0, 1.0].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), frameMat);
    pillar.position.set(px, 1.05, 3.1);
    pillar.castShadow = true;
    cabin.add(pillar);
  });

  // Porch roof overhang with snow blanket
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.4), frameMat);
  porchRoof.position.set(0, 2.05, 2.65);
  porchRoof.rotation.x = 0.12;
  porchRoof.castShadow = true;
  cabin.add(porchRoof);

  const porchSnow = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.12, 1.45), snowMat);
  porchSnow.position.set(0, 2.14, 2.65);
  porchSnow.rotation.x = 0.12;
  porchSnow.castShadow = true;
  cabin.add(porchSnow);

  // Hanging Wrought Iron Warm Lantern on Porch
  const lanternHook = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), frameMat);
  lanternHook.position.set(0, 1.92, 2.6);
  cabin.add(lanternHook);

  const porchLantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.24, 0.18),
    windowGlowMat
  );
  porchLantern.position.set(0, 1.76, 2.6);
  cabin.add(porchLantern);

  // Firewood Log Stack under side eaves
  const logMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), logMat);
      log.rotateZ(Math.PI / 2);
      log.position.set(2.45, 0.15 + row * 0.16, -0.9 + col * 0.22);
      log.castShadow = true;
      cabin.add(log);
    }
  }
  const firewoodSnow = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), snowMat);
  firewoodSnow.position.set(2.45, 0.65, -0.55);
  cabin.add(firewoodSnow);

  // Stone Chimney
  const chimneyGeom = new THREE.BoxGeometry(0.65, 2.6, 0.65);
  const chimney = new THREE.Mesh(chimneyGeom, stoneMat);
  chimney.position.set(1.4, 3.4, -0.6);
  chimney.castShadow = true;
  cabin.add(chimney);

  // Chimney snow rim
  const chimSnow = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.75), snowMat);
  chimSnow.position.set(1.4, 4.75, -0.6);
  cabin.add(chimSnow);

  // Warm Window & Porch Light
  const warmLight = new THREE.PointLight(0xffb74d, 1.6, 8, 1.8);
  warmLight.position.set(0, 1.7, 2.8);
  cabin.add(warmLight);

  return cabin;
}

/**
 * Creates a layered snow-capped pine tree (3-12 parts).
 */
export function createSnowyPineTree(scale: number = 1.0): THREE.Group {
  const tree = new THREE.Group();

  // Trunk
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a2e18,
    roughness: 0.9,
  });
  const trunkGeom = new THREE.CylinderGeometry(0.22 * scale, 0.32 * scale, 1.6 * scale, 8);
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.8 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  // Foliage green materials
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x1b4332,
    roughness: 0.85,
  });

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf0f7fa,
    roughness: 0.95,
  });

  // 3 Tiers of pine cones + snow layers
  const tiers = [
    { y: 1.8 * scale, radius: 1.6 * scale, height: 1.5 * scale },
    { y: 2.7 * scale, radius: 1.2 * scale, height: 1.3 * scale },
    { y: 3.5 * scale, radius: 0.8 * scale, height: 1.1 * scale },
  ];

  tiers.forEach((tier) => {
    // Green pine tier
    const coneGeom = new THREE.ConeGeometry(tier.radius, tier.height, 8);
    const cone = new THREE.Mesh(coneGeom, foliageMat);
    cone.position.y = tier.y;
    cone.castShadow = true;
    tree.add(cone);

    // Snow blanket on tier
    const snowCapGeom = new THREE.ConeGeometry(tier.radius * 0.95, tier.height * 0.45, 8);
    const snowCap = new THREE.Mesh(snowCapGeom, snowMat);
    snowCap.position.y = tier.y + tier.height * 0.32;
    snowCap.castShadow = true;
    tree.add(snowCap);
  });

  return tree;
}

/**
 * Creates a cozy cast-iron vintage street lamp with warm glowing lantern
 */
export function createStreetLamp(): { group: THREE.Group; light: THREE.PointLight } {
  const lamp = new THREE.Group();

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1c2321,
    metalness: 0.85,
    roughness: 0.3,
  });

  const poleGeom = new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8);
  const pole = new THREE.Mesh(poleGeom, ironMat);
  pole.position.y = 1.6;
  pole.castShadow = true;
  lamp.add(pole);

  const baseGeom = new THREE.CylinderGeometry(0.24, 0.32, 0.4, 8);
  const base = new THREE.Mesh(baseGeom, ironMat);
  base.position.y = 0.2;
  base.castShadow = true;
  lamp.add(base);

  // Lantern head
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xffe082,
    emissive: 0xffb74d,
    emissiveIntensity: 3.0,
    roughness: 0.2,
  });
  const lanternGeom = new THREE.CylinderGeometry(0.24, 0.16, 0.45, 6);
  const lantern = new THREE.Mesh(lanternGeom, lanternMat);
  lantern.position.y = 3.25;
  lamp.add(lantern);

  // Snow cap on lantern
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: 0.9 });
  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 6), snowMat);
  snowCap.position.y = 3.55;
  lamp.add(snowCap);

  // Warm light pool onto ground
  const light = new THREE.PointLight(0xffb74d, 2.5, 9, 1.8);
  light.position.set(0, 3.2, 0);
  lamp.add(light);

  return { group: lamp, light };
}

/**
 * Creates a cute snowman with top hat, carrot nose, and warm scarf
 */
export function createSnowman(): THREE.Group {
  const snowman = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fbff, roughness: 0.95 });

  // Base, torso, head
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), snowMat);
  base.position.y = 0.55;
  base.castShadow = true;
  snowman.add(base);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), snowMat);
  torso.position.y = 1.4;
  torso.castShadow = true;
  snowman.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), snowMat);
  head.position.y = 2.05;
  head.castShadow = true;
  snowman.add(head);

  // Top hat
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.5 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 12), hatMat);
  brim.position.y = 2.35;
  snowman.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.35, 12), hatMat);
  crown.position.y = 2.52;
  crown.castShadow = true;
  snowman.add(crown);

  // Red hat ribbon
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4 });
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 12), ribbonMat);
  ribbon.position.y = 2.42;
  snowman.add(ribbon);

  // Carrot nose
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xff6f00, roughness: 0.6 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 8), noseMat);
  nose.position.set(0, 2.05, 0.38);
  nose.rotation.x = Math.PI / 2;
  snowman.add(nose);

  // Cozy Scarf
  const scarfMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, roughness: 0.8 });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 8, 16), scarfMat);
  scarf.position.set(0, 1.76, 0);
  scarf.rotation.x = Math.PI / 2;
  snowman.add(scarf);

  return snowman;
}

/**
 * Creates rustic wooden fences
 */
export function createFenceSection(): THREE.Group {
  const fence = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: 0.95 });

  // Two posts
  [-1.0, 1.0].forEach((xPos) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), woodMat);
    post.position.set(xPos, 0.45, 0);
    post.castShadow = true;
    fence.add(post);

    const postSnow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), snowMat);
    postSnow.position.set(xPos, 0.92, 0);
    fence.add(postSnow);
  });

  // Two rails
  [0.35, 0.7].forEach((yPos) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.08), woodMat);
    rail.position.set(0, yPos, 0);
    rail.castShadow = true;
    fence.add(rail);
  });

  // Snow on top rail
  const railSnow = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.06, 0.12), snowMat);
  railSnow.position.set(0, 0.77, 0);
  fence.add(railSnow);

  return fence;
}

/**
 * Creates the Industrial Snow Disposal Chute / Melt Pit
 * Players push gathered snow into this zone for big cash bonuses!
 */
export function createSnowDisposalChute(): {
  group: THREE.Group;
  steamLight: THREE.PointLight;
} {
  const chute = new THREE.Group();

  // Yellow & Black hazard border frame
  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xfbc02d,
    roughness: 0.4,
    metalness: 0.6,
  });

  const borderGeom = new THREE.BoxGeometry(7.0, 0.35, 7.0);
  const border = new THREE.Mesh(borderGeom, hazardMat);
  border.position.y = 0.17;
  border.receiveShadow = true;
  chute.add(border);

  // Melt Pit Grating (dark heated steel grate)
  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x263238,
    metalness: 0.9,
    roughness: 0.3,
  });
  const grateGeom = new THREE.BoxGeometry(5.8, 0.2, 5.8);
  const grate = new THREE.Mesh(grateGeom, grateMat);
  grate.position.y = 0.25;
  chute.add(grate);

  // Heated coils underneath (warm orange emissive glow)
  const coilMat = new THREE.MeshStandardMaterial({
    color: 0xff3d00,
    emissive: 0xff6d00,
    emissiveIntensity: 3.5,
  });
  const coilGeom = new THREE.PlaneGeometry(4.8, 4.8);
  const coil = new THREE.Mesh(coilGeom, coilMat);
  coil.rotation.x = -Math.PI / 2;
  coil.position.y = 0.28;
  chute.add(coil);

  // Steam chimney pipe
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.8, roughness: 0.3 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 3.6, 10), pipeMat);
  pipe.position.set(3.2, 1.8, 3.2);
  pipe.castShadow = true;
  chute.add(pipe);

  // Signpost: "SNOW DUMP"
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8), pipeMat);
  post.position.set(-3.2, 1.4, 3.2);
  chute.add(post);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.9, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xff6f00, roughness: 0.3 })
  );
  signBoard.position.set(-3.2, 2.4, 3.2);
  chute.add(signBoard);

  // Warm orange glow from the melting pit
  const steamLight = new THREE.PointLight(0xff6d00, 3.0, 12, 1.6);
  steamLight.position.set(0, 1.0, 0);
  chute.add(steamLight);

  return { group: chute, steamLight };
}

/**
 * Creates the Community Snowman Sculpture Foundation
 * As players dump gathered snow here, the 3 tiers physically grow!
 */
export function createCommunitySnowmanSculpture(): {
  group: THREE.Group;
  tier1: THREE.Mesh;
  tier2: THREE.Group;
  tier3: THREE.Group;
  updateProgress: (currentKg: number, goalKg: number) => void;
} {
  const root = new THREE.Group();

  // Wooden construction platform
  const platMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.85 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.4, 12), platMat);
  platform.position.y = 0.2;
  platform.receiveShadow = true;
  root.add(platform);

  // Festive construction banner sign
  const signPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x3e2723 })
  );
  signPole.position.set(-2.8, 1.1, 2.4);
  root.add(signPole);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.8, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0277bd, roughness: 0.4 })
  );
  signBoard.position.set(-2.8, 1.9, 2.4);
  root.add(signBoard);

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    roughness: 0.9,
    metalness: 0.02,
  });

  // Tier 1: Giant bottom snowball (Appears 0% - 33%)
  const tier1Geom = new THREE.SphereGeometry(1.8, 16, 12);
  const tier1 = new THREE.Mesh(tier1Geom, snowMat);
  tier1.position.set(0, 1.6, 0);
  tier1.castShadow = true;
  tier1.scale.set(0.001, 0.001, 0.001);
  root.add(tier1);

  // Tier 2: Middle torso with red scarf & branch arms (Appears 34% - 66%)
  const tier2 = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), snowMat);
  torso.castShadow = true;
  tier2.add(torso);

  // Giant scarf
  const scarfMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 10, 20), scarfMat);
  scarf.position.set(0, 0.9, 0);
  scarf.rotation.x = Math.PI / 2;
  tier2.add(scarf);

  // Tree branch arms
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
  const leftBranch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.4, 8), branchMat);
  leftBranch.position.set(-1.8, 0.4, 0);
  leftBranch.rotation.z = Math.PI * 0.35;
  tier2.add(leftBranch);

  const rightBranch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.4, 8), branchMat);
  rightBranch.position.set(1.8, 0.4, 0);
  rightBranch.rotation.z = -Math.PI * 0.35;
  tier2.add(rightBranch);

  tier2.position.set(0, 3.4, 0);
  tier2.scale.set(0.001, 0.001, 0.001);
  root.add(tier2);

  // Tier 3: Giant top head with top hat, carrot nose, coal smile (Appears 67% - 100%)
  const tier3 = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), snowMat);
  head.castShadow = true;
  tier3.add(head);

  // Giant Top Hat
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 16), hatMat);
  brim.position.y = 0.85;
  tier3.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.0, 16), hatMat);
  crown.position.y = 1.35;
  crown.castShadow = true;
  tier3.add(crown);

  // Giant carrot nose
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xff6f00, roughness: 0.5 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 8), noseMat);
  nose.position.set(0, 0, 1.1);
  nose.rotation.x = Math.PI / 2;
  tier3.add(nose);

  // Glowing holiday lights wrapped around hat
  const lightBeadMat = new THREE.MeshStandardMaterial({
    color: 0x00e676,
    emissive: 0x00e676,
    emissiveIntensity: 3.0,
  });
  const hatLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lightBeadMat);
  hatLight.position.set(0.65, 0.95, 0.4);
  tier3.add(hatLight);

  tier3.position.set(0, 5.2, 0);
  tier3.scale.set(0.001, 0.001, 0.001);
  root.add(tier3);

  const updateProgress = (currentKg: number, goalKg: number) => {
    const ratio = Math.min(Math.max(currentKg / goalKg, 0), 1.0);

    // Tier 1 scales from 0% to 33%
    const t1Ratio = Math.min(ratio / 0.33, 1.0);
    tier1.scale.set(t1Ratio, t1Ratio, t1Ratio);

    // Tier 2 scales from 33% to 66%
    if (ratio > 0.33) {
      const t2Ratio = Math.min((ratio - 0.33) / 0.33, 1.0);
      tier2.scale.set(t2Ratio, t2Ratio, t2Ratio);
    } else {
      tier2.scale.set(0.001, 0.001, 0.001);
    }

    // Tier 3 scales from 66% to 100%
    if (ratio > 0.66) {
      const t3Ratio = Math.min((ratio - 0.66) / 0.34, 1.0);
      tier3.scale.set(t3Ratio, t3Ratio, t3Ratio);
    } else {
      tier3.scale.set(0.001, 0.001, 0.001);
    }
  };

  return { group: root, tier1, tier2, tier3, updateProgress };
}

/**
 * Creates a physical 3D snow mound / stacked snowbank mesh
 */
export function createStackedSnowMoundMesh(radius: number, height: number): THREE.Mesh {
  // Beveled dome geometry
  const geom = new THREE.SphereGeometry(radius, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  // Scale Y to match height
  geom.scale(1, height / radius, 1);

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf5f9fc,
    roughness: 0.95,
    metalness: 0.02,
  });

  const mesh = new THREE.Mesh(geom, snowMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates the Alpine Town Square Ice Skating Rink!
 * Features smooth frozen ice with subtle skate scratches, wooden barrier boards,
 * festive string lights on wooden posts, and cozy spectator benches.
 */
export function createIceRink(width: number = 18, depth: number = 12): THREE.Group {
  const rink = new THREE.Group();

  // 1. Glossy reflective ice surface
  const iceCanvas = document.createElement('canvas');
  iceCanvas.width = 256;
  iceCanvas.height = 256;
  const iCtx = iceCanvas.getContext('2d');
  if (iCtx) {
    iCtx.fillStyle = '#b0e0e6';
    iCtx.fillRect(0, 0, 256, 256);
    // Subtle skate scratch arcs
    iCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    iCtx.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) {
      iCtx.beginPath();
      iCtx.arc(
        Math.random() * 256,
        Math.random() * 256,
        15 + Math.random() * 45,
        Math.random() * Math.PI,
        Math.random() * Math.PI * 2
      );
      iCtx.stroke();
    }
  }
  const iceTex = new THREE.CanvasTexture(iceCanvas);
  iceTex.wrapS = THREE.RepeatWrapping;
  iceTex.wrapT = THREE.RepeatWrapping;
  iceTex.repeat.set(4, 3);

  const iceMat = new THREE.MeshStandardMaterial({
    map: iceTex,
    color: 0xe0f7fa,
    roughness: 0.12,
    metalness: 0.45,
  });

  const iceMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), iceMat);
  iceMesh.rotation.x = -Math.PI / 2;
  iceMesh.position.y = 0.04;
  iceMesh.receiveShadow = true;
  rink.add(iceMesh);

  // 2. Wooden barrier dasher boards surrounding the rink
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.85 });
  const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: 0.95 });
  const boardHeight = 0.9;
  const boardThickness = 0.22;

  // North & South boards
  [-depth / 2, depth / 2].forEach((zPos) => {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(width + boardThickness * 2, boardHeight, boardThickness),
      boardMat
    );
    board.position.set(0, boardHeight / 2, zPos);
    board.castShadow = true;
    board.receiveShadow = true;
    rink.add(board);

    // Snow blanket on top of board
    const snowCap = new THREE.Mesh(
      new THREE.BoxGeometry(width + boardThickness * 2.1, 0.1, boardThickness * 1.3),
      snowCapMat
    );
    snowCap.position.set(0, boardHeight + 0.05, zPos);
    snowCap.castShadow = true;
    rink.add(snowCap);
  });

  // West & East boards
  [-width / 2, width / 2].forEach((xPos) => {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(boardThickness, boardHeight, depth),
      boardMat
    );
    board.position.set(xPos, boardHeight / 2, 0);
    board.castShadow = true;
    board.receiveShadow = true;
    rink.add(board);

    const snowCap = new THREE.Mesh(
      new THREE.BoxGeometry(boardThickness * 1.3, 0.1, depth),
      snowCapMat
    );
    snowCap.position.set(xPos, boardHeight + 0.05, 0);
    snowCap.castShadow = true;
    rink.add(snowCap);
  });

  // 3. String Light posts at rink corners with colorful glowing light bulbs
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
  const bulbColors = [0xff1744, 0x00e676, 0xffea00, 0x2979ff];
  const corners = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ];

  corners.forEach(([cx, cz], cIdx) => {
    const lightPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8),
      postMat
    );
    lightPost.position.set(cx, 1.6, cz);
    lightPost.castShadow = true;
    rink.add(lightPost);

    // Colorful festive bulb
    const bColor = bulbColors[cIdx % bulbColors.length];
    const bulbMat = new THREE.MeshStandardMaterial({
      color: bColor,
      emissive: bColor,
      emissiveIntensity: 3.5,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), bulbMat);
    bulb.position.set(cx, 3.3, cz);
    rink.add(bulb);

    const pLight = new THREE.PointLight(bColor, 1.5, 7, 2.0);
    pLight.position.set(cx, 3.2, cz);
    rink.add(pLight);
  });

  return rink;
}

/**
 * Creates a festive Victorian street lamp with an evergreen holiday wreath & red bow
 */
export function createHolidayStreetLamp(): { group: THREE.Group; light: THREE.PointLight } {
  const { group, light } = createStreetLamp();

  // Evergreen holiday wreath wrapped around lamp pole
  const wreathMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.85 });
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 16), wreathMat);
  wreath.position.set(0, 2.2, 0.12);
  group.add(wreath);

  // Red velvet ribbon bow
  const bowMat = new THREE.MeshStandardMaterial({ color: 0xd50000, roughness: 0.4 });
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), bowMat);
  bow.position.set(0, 1.85, 0.2);
  group.add(bow);

  return { group, light };
}

/**
 * Creates a rustic wooden park bench with snow dusting
 */
export function createParkBench(): THREE.Group {
  const bench = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.85, roughness: 0.3 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: 0.95 });

  // Iron legs
  [-0.8, 0.8].forEach((bx) => {
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), ironMat);
    leg1.position.set(bx, 0.25, -0.2);
    bench.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), ironMat);
    leg2.position.set(bx, 0.25, 0.2);
    bench.add(leg2);

    const backSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), ironMat);
    backSupport.position.set(bx, 0.65, -0.2);
    backSupport.rotation.x = -0.15;
    bench.add(backSupport);
  });

  // Wooden Seat Slats
  for (let s = -0.16; s <= 0.16; s += 0.1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.08), woodMat);
    slat.position.set(0, 0.5, s);
    bench.add(slat);
  }

  // Wooden Back Slats
  for (let b = 0.65; b <= 0.85; b += 0.1) {
    const bSlat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.04), woodMat);
    bSlat.position.set(0, b, -0.2);
    bench.add(bSlat);
  }

  // Snow on seat
  const seatSnow = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.04, 0.36), snowMat);
  seatSnow.position.set(0, 0.54, 0);
  bench.add(seatSnow);

  return bench;
}

/**
 * Creates a cute winter municipal fire hydrant
 */
export function createFireHydrant(): THREE.Group {
  const hydrant = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xd50000, roughness: 0.35, metalness: 0.5 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.9, roughness: 0.2 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: 0.95 });

  // Body barrel
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 10), redMat);
  body.position.y = 0.35;
  body.castShadow = true;
  hydrant.add(body);

  // Top bonnet
  const bonnet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), redMat);
  bonnet.position.y = 0.7;
  bonnet.castShadow = true;
  hydrant.add(bonnet);

  // Brass side nozzles
  [-0.22, 0.22].forEach((nx) => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), brassMat);
    nozzle.rotateZ(Math.PI / 2);
    nozzle.position.set(nx, 0.45, 0);
    hydrant.add(nozzle);
  });

  // Snow cap on top
  const snowCap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), snowMat);
  snowCap.position.y = 0.85;
  hydrant.add(snowCap);

  return hydrant;
}

