/**
 * MUREZA / MAVE Supplier Portal — 3D Digital Twin Viewer
 * Procedural Three.js Model of the MUREZA Villager EV Modular Platform
 * Includes:
 *   - 5 localized automotive subsystems (Battery/Powertrain, Stamped Chassis, Electrical, Cabin, Suspension)
 *   - Smooth 360° OrbitControls with damping
 *   - Interactive Exploded Architecture Animation
 *   - Subsystem Hotspot Selection & Highlight
 */

(function () {
  let scene, camera, renderer, controls;
  let modelRoot;
  let subsystems = {};
  let isExploded = false;
  let explodeFactor = 0; // 0 (assembled) to 1 (exploded)
  let targetExplodeFactor = 0;
  let autoRotate = true;
  let activeSubsystem = null;
  let isInitialized = false;
  let animFrameId = null;

  // Subsystem metadata aligned with MUREZA Tier BOM
  const SUBSYSTEM_DATA = {
    powertrain: {
      name: "High-Voltage Traction & Battery",
      tier: "Tier 1",
      parts: "60kWh LFP Pack, Inverter, BMS, Front/Rear e-Axles",
      targetDomestic: "55%"
    },
    chassis: {
      name: "Stamped Chassis & Frame Rails",
      tier: "Tier 1 & 2",
      parts: "High-strength steel ladder rails, crossmembers, bash plates",
      targetDomestic: "65%"
    },
    electrical: {
      name: "Electrical Architecture & ECU",
      tier: "Tier 1 & 2",
      parts: "Central Compute ECU, HV wiring harnesses, LED lighting modules",
      targetDomestic: "50%"
    },
    body: {
      name: "Cabin Safety Cell & Upper Structure",
      tier: "Tier 1 & 2",
      parts: "Modular tubular cage, A/B/C pillar stampings, windshield frame",
      targetDomestic: "60%"
    },
    suspension: {
      name: "Steering, Braking & Suspension",
      tier: "Tier 1 & 2",
      parts: "McPherson struts, regenerative brake calipers, alloy wheels",
      targetDomestic: "58%"
    }
  };

  function init3DViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (isInitialized) {
      onWindowResize();
      return;
    }

    if (!window.THREE) {
      console.warn("[Three.js] Library not yet loaded");
      return;
    }

    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0c0a);
    scene.fog = new THREE.FogExp2(0x0e0c0a, 0.05);

    // 2. Camera setup
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.set(4.5, 2.8, 5.2);

    // 3. Renderer setup
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) {
      container.innerHTML = '<div style="color: var(--ink-faint); padding: 30px; text-align: center;">WebGL not supported in this browser.</div>';
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Clear previous canvas if any
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Controls setup
    if (window.THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't flip below ground
      controls.minDistance = 2.2;
      controls.maxDistance = 14;
      controls.target.set(0, 0.4, 0);
    }

    // 5. Lighting
    setupLighting();

    // 6. Grid ground plane with luxury aesthetic
    setupGround();

    // 7. Build Procedural Villager EV Model
    modelRoot = new THREE.Group();
    scene.add(modelRoot);
    buildProceduralEVPlatform();

    // 8. Event listeners
    window.addEventListener("resize", onWindowResize);
    const ro = new ResizeObserver(() => onWindowResize());
    ro.observe(container);

    // Stop auto-rotate on user interaction
    if (controls) {
      controls.addEventListener("start", () => {
        autoRotate = false;
        updateRotateBtnState();
      });
    }

    isInitialized = true;
    animate();
  }

  function setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xfff6ea, 0.7);
    scene.add(ambient);

    // Key directional light (warm gold accent)
    const keyLight = new THREE.DirectionalLight(0xffecd2, 1.8);
    keyLight.position.set(6, 9, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    // Fill blue/cool light from opposite side
    const fillLight = new THREE.DirectionalLight(0x7fa2b8, 0.9);
    fillLight.position.set(-6, 5, -5);
    scene.add(fillLight);

    // Gold rim light from beneath
    const rimLight = new THREE.DirectionalLight(0xcf8f45, 1.2);
    rimLight.position.set(0, -3, 0);
    scene.add(rimLight);
  }

  function setupGround() {
    // Grid ground
    const grid = new THREE.GridHelper(16, 32, 0xcf8f45, 0x221c17);
    grid.position.y = -0.01;
    scene.add(grid);

    // Soft circular shadow plane
    const shadowGeo = new THREE.PlaneGeometry(7, 3.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.005;
    scene.add(shadowMesh);
  }

  // ============================================================
  // PROCEDURAL 3D VILLAGER EV PLATFORM (MODULAR BOM)
  // ============================================================

  function buildProceduralEVPlatform() {
    // PBR Materials
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x24272c,
      metalness: 0.85,
      roughness: 0.3
    });

    const frameSteelMat = new THREE.MeshStandardMaterial({
      color: 0x363a42,
      metalness: 0.9,
      roughness: 0.25
    });

    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xcf8f45,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x2a1a08
    });

    const batteryCaseMat = new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      metalness: 0.7,
      roughness: 0.35
    });

    const highVoltOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xe0681a,
      metalness: 0.3,
      roughness: 0.4,
      emissive: 0x4a1805
    });

    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.92,
      metalness: 0.1
    });

    const brakeRotorMat = new THREE.MeshStandardMaterial({
      color: 0x8a9099,
      metalness: 0.95,
      roughness: 0.15
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x11161a,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.7,
      transparent: true,
      opacity: 0.65
    });

    // --------------------------------------------------------
    // 1. CHASSIS SUBSYSTEM (Frame rails & crossmembers)
    // --------------------------------------------------------
    const chassisGroup = new THREE.Group();
    chassisGroup.userData = { id: "chassis", basePos: new THREE.Vector3(0, 0, 0), explodedOffset: new THREE.Vector3(0, 0, 0) };

    // Longitudinal Rails (Left & Right)
    const railGeo = new THREE.BoxGeometry(0.12, 0.16, 3.4);
    const railL = new THREE.Mesh(railGeo, frameSteelMat);
    railL.position.set(-0.75, 0.35, 0);
    railL.castShadow = true;
    railL.receiveShadow = true;
    chassisGroup.add(railL);

    const railR = new THREE.Mesh(railGeo, frameSteelMat);
    railR.position.set(0.75, 0.35, 0);
    railR.castShadow = true;
    railR.receiveShadow = true;
    chassisGroup.add(railR);

    // 4 Crossmembers
    const crossGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 16);
    crossGeo.rotateZ(Math.PI / 2);
    [-1.4, -0.5, 0.5, 1.4].forEach((z) => {
      const cross = new THREE.Mesh(crossGeo, frameSteelMat);
      cross.position.set(0, 0.35, z);
      cross.castShadow = true;
      chassisGroup.add(cross);
    });

    // Front & Rear Crash Beams
    const bumperGeo = new THREE.BoxGeometry(1.6, 0.18, 0.14);
    const fBeam = new THREE.Mesh(bumperGeo, darkSteelMat);
    fBeam.position.set(0, 0.38, 1.75);
    chassisGroup.add(fBeam);

    const rBeam = new THREE.Mesh(bumperGeo, darkSteelMat);
    rBeam.position.set(0, 0.38, -1.75);
    chassisGroup.add(rBeam);

    subsystems.chassis = chassisGroup;
    modelRoot.add(chassisGroup);

    // --------------------------------------------------------
    // 2. POWERTRAIN SUBSYSTEM (Battery & e-Axles)
    // --------------------------------------------------------
    const powertrainGroup = new THREE.Group();
    powertrainGroup.userData = { id: "powertrain", basePos: new THREE.Vector3(0, 0, 0), explodedOffset: new THREE.Vector3(0, -0.65, 0) };

    // Battery Pack Enclosure (Center floor)
    const packGeo = new THREE.BoxGeometry(1.3, 0.18, 1.9);
    const packMesh = new THREE.Mesh(packGeo, batteryCaseMat);
    packMesh.position.set(0, 0.28, 0);
    packMesh.castShadow = true;
    powertrainGroup.add(packMesh);

    // Internal Battery Modules (Gold cell blocks)
    for (let x = -0.45; x <= 0.45; x += 0.45) {
      for (let z = -0.65; z <= 0.65; z += 0.45) {
        const modGeo = new THREE.BoxGeometry(0.35, 0.08, 0.35);
        const modMesh = new THREE.Mesh(modGeo, goldAccentMat);
        modMesh.position.set(x, 0.38, z);
        powertrainGroup.add(modMesh);
      }
    }

    // Rear Electric Drive Unit (Motor + Inverter + Gearbox)
    const motorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.55, 20);
    motorGeo.rotateZ(Math.PI / 2);
    const rMotor = new THREE.Mesh(motorGeo, darkSteelMat);
    rMotor.position.set(0, 0.38, -1.2);
    rMotor.castShadow = true;
    powertrainGroup.add(rMotor);

    // Inverter Controller Box
    const invGeo = new THREE.BoxGeometry(0.35, 0.2, 0.3);
    const invMesh = new THREE.Mesh(invGeo, goldAccentMat);
    invMesh.position.set(0, 0.55, -1.2);
    powertrainGroup.add(invMesh);

    // High Voltage Cable traces
    const cableGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 12);
    const cable1 = new THREE.Mesh(cableGeo, highVoltOrangeMat);
    cable1.rotation.x = Math.PI / 2;
    cable1.position.set(0.18, 0.42, -0.65);
    powertrainGroup.add(cable1);

    subsystems.powertrain = powertrainGroup;
    modelRoot.add(powertrainGroup);

    // --------------------------------------------------------
    // 3. ELECTRICAL SUBSYSTEM (ECU, Harnesses, LED Modules)
    // --------------------------------------------------------
    const electricalGroup = new THREE.Group();
    electricalGroup.userData = { id: "electrical", basePos: new THREE.Vector3(0, 0, 0), explodedOffset: new THREE.Vector3(0, 0.5, 0.4) };

    // Central Vehicle Computer ECU
    const ecuGeo = new THREE.BoxGeometry(0.32, 0.12, 0.24);
    const ecuMesh = new THREE.Mesh(ecuGeo, darkSteelMat);
    ecuMesh.position.set(-0.35, 0.52, 0.95);
    electricalGroup.add(ecuMesh);

    // 12V Auxiliary Battery
    const auxGeo = new THREE.BoxGeometry(0.24, 0.18, 0.2);
    const auxMesh = new THREE.Mesh(auxGeo, darkSteelMat);
    auxMesh.position.set(0.35, 0.52, 0.95);
    electricalGroup.add(auxMesh);

    // Front LED Light Bar
    const ledGeo = new THREE.BoxGeometry(1.4, 0.05, 0.05);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x99ccff,
      emissiveIntensity: 0.8
    });
    const frontLed = new THREE.Mesh(ledGeo, ledMat);
    frontLed.position.set(0, 0.55, 1.8);
    electricalGroup.add(frontLed);

    // Rear LED Tail Bar (Red emission)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff1111,
      emissiveIntensity: 0.9
    });
    const rearLed = new THREE.Mesh(ledGeo, tailMat);
    rearLed.position.set(0, 0.55, -1.8);
    electricalGroup.add(rearLed);

    subsystems.electrical = electricalGroup;
    modelRoot.add(electricalGroup);

    // --------------------------------------------------------
    // 4. CABIN & BODY CELL (Modular Safety Cell)
    // --------------------------------------------------------
    const bodyGroup = new THREE.Group();
    bodyGroup.userData = { id: "body", basePos: new THREE.Vector3(0, 0, 0), explodedOffset: new THREE.Vector3(0, 1.15, 0) };

    // A/B/C Pillar Roll Cage Frame
    const cageGeo = new THREE.BoxGeometry(1.45, 0.85, 2.3);
    const cageEdges = new THREE.EdgesGeometry(cageGeo);
    const cageLine = new THREE.LineSegments(
      cageEdges,
      new THREE.LineBasicMaterial({ color: 0xcf8f45, linewidth: 2 })
    );
    cageLine.position.set(0, 1.05, 0);
    bodyGroup.add(cageLine);

    // Aerodynamic Windshield contour
    const windGeo = new THREE.PlaneGeometry(1.35, 0.75);
    const windMesh = new THREE.Mesh(windGeo, glassMat);
    windMesh.rotation.x = -Math.PI / 4;
    windMesh.position.set(0, 1.1, 0.95);
    bodyGroup.add(windMesh);

    // Modular Commercial Cockpit Seats
    [-0.35, 0.35].forEach((sx) => {
      const seatBaseGeo = new THREE.BoxGeometry(0.38, 0.1, 0.42);
      const seatBackGeo = new THREE.BoxGeometry(0.38, 0.55, 0.1);
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x221e1a, roughness: 0.8 });

      const sBase = new THREE.Mesh(seatBaseGeo, seatMat);
      sBase.position.set(sx, 0.58, 0.35);
      const sBack = new THREE.Mesh(seatBackGeo, seatMat);
      sBack.position.set(sx, 0.85, 0.16);

      bodyGroup.add(sBase);
      bodyGroup.add(sBack);
    });

    subsystems.body = bodyGroup;
    modelRoot.add(bodyGroup);

    // --------------------------------------------------------
    // 5. SUSPENSION, BRAKING & WHEELS
    // --------------------------------------------------------
    const suspensionGroup = new THREE.Group();
    suspensionGroup.userData = { id: "suspension", basePos: new THREE.Vector3(0, 0, 0), explodedOffset: new THREE.Vector3(0, 0, 0) };

    const wheelPositions = [
      { x: -0.98, z: 1.25, isFront: true, side: -1 }, // Front Left
      { x: 0.98, z: 1.25, isFront: true, side: 1 },  // Front Right
      { x: -0.98, z: -1.25, isFront: false, side: -1 }, // Rear Left
      { x: 0.98, z: -1.25, isFront: false, side: 1 }  // Rear Right
    ];

    wheelPositions.forEach((wp) => {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.set(wp.x, 0.38, wp.z);
      wheelAssembly.userData = {
        explodedOffset: new THREE.Vector3(wp.side * 0.75, 0, wp.isFront ? 0.3 : -0.3)
      };

      // Tire (Rubber Torus / Cylinder)
      const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, rubberMat);
      tireMesh.castShadow = true;
      wheelAssembly.add(tireMesh);

      // Alloy Rim (Metallic)
      const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.23, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, frameSteelMat);
      wheelAssembly.add(rimMesh);

      // Gold Wheel Cap
      const capGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 12);
      capGeo.rotateZ(Math.PI / 2);
      const capMesh = new THREE.Mesh(capGeo, goldAccentMat);
      wheelAssembly.add(capMesh);

      // Ventilated Brake Disc
      const discGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20);
      discGeo.rotateZ(Math.PI / 2);
      const discMesh = new THREE.Mesh(discGeo, brakeRotorMat);
      discMesh.position.x = -wp.side * 0.12;
      wheelAssembly.add(discMesh);

      // Gold Caliper
      const calGeo = new THREE.BoxGeometry(0.07, 0.12, 0.08);
      const calMesh = new THREE.Mesh(calGeo, goldAccentMat);
      calMesh.position.set(-wp.side * 0.12, 0.12, 0);
      wheelAssembly.add(calMesh);

      // Suspension Strut & Coil Spring
      const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12);
      const strutMesh = new THREE.Mesh(strutGeo, darkSteelMat);
      strutMesh.position.set(-wp.side * 0.16, 0.24, 0);
      strutMesh.rotation.z = wp.side * 0.15;
      wheelAssembly.add(strutMesh);

      suspensionGroup.add(wheelAssembly);
    });

    subsystems.suspension = suspensionGroup;
    modelRoot.add(suspensionGroup);
  }

  // ============================================================
  // ANIMATION LOOP & EXPLOSION EASING
  // ============================================================

  function animate() {
    animFrameId = requestAnimationFrame(animate);

    // Smoothly ease explode factor
    explodeFactor += (targetExplodeFactor - explodeFactor) * 0.08;

    // Apply exploded positions
    Object.values(subsystems).forEach((group) => {
      if (group.userData?.explodedOffset) {
        group.position.x = group.userData.basePos.x + group.userData.explodedOffset.x * explodeFactor;
        group.position.y = group.userData.basePos.y + group.userData.explodedOffset.y * explodeFactor;
        group.position.z = group.userData.basePos.z + group.userData.explodedOffset.z * explodeFactor;
      }

      // Handle nested wheels in suspension group
      if (group === subsystems.suspension) {
        group.children.forEach((child) => {
          if (child.userData?.explodedOffset) {
            child.position.x = (child.position.x > 0 ? 0.98 : -0.98) + child.userData.explodedOffset.x * explodeFactor;
            child.position.z = (child.position.z > 0 ? 1.25 : -1.25) + child.userData.explodedOffset.z * explodeFactor;
          }
        });
      }
    });

    // Auto rotation if user is not dragging
    if (autoRotate && modelRoot) {
      modelRoot.rotation.y += 0.005;
    }

    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function onWindowResize() {
    const container = document.getElementById("twin3DCanvasContainer");
    if (!container || !renderer || !camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 300;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // ============================================================
  // INTERACTIVE CONTROLS API
  // ============================================================

  window.toggle3DExplode = function () {
    isExploded = !isExploded;
    targetExplodeFactor = isExploded ? 1.0 : 0.0;
    updateExplodeBtnState();
  };

  window.toggle3DRotate = function () {
    autoRotate = !autoRotate;
    updateRotateBtnState();
  };

  window.reset3DCamera = function () {
    if (!camera || !controls) return;
    targetExplodeFactor = 0;
    isExploded = false;
    updateExplodeBtnState();

    if (modelRoot) modelRoot.rotation.y = 0;
    camera.position.set(4.5, 2.8, 5.2);
    controls.target.set(0, 0.4, 0);
    controls.update();
    autoRotate = true;
    updateRotateBtnState();
    clearSubsystemHighlights();
  };

  window.select3DSubsystem = function (id) {
    activeSubsystem = id;
    autoRotate = false;
    updateRotateBtnState();

    // Reset all highlights
    clearSubsystemHighlights();

    if (!id || id === "all") {
      updateHUDInfo(null);
      return;
    }

    const targetGroup = subsystems[id];
    if (targetGroup) {
      // Highlight subsystem meshes
      targetGroup.traverse((node) => {
        if (node.isMesh && node.material) {
          node.userData.origEmissive = node.userData.origEmissive || node.material.emissive?.getHex() || 0;
          if (node.material.emissive) {
            node.material.emissive.setHex(0xcf8f45);
            node.material.emissiveIntensity = 0.8;
          }
        }
      });
    }

    updateHUDInfo(SUBSYSTEM_DATA[id]);
  };

  function clearSubsystemHighlights() {
    Object.values(subsystems).forEach((group) => {
      group.traverse((node) => {
        if (node.isMesh && node.material && node.material.emissive) {
          node.material.emissive.setHex(node.userData.origEmissive || 0);
          node.material.emissiveIntensity = 0.2;
        }
      });
    });
  }

  function updateHUDInfo(data) {
    const nameEl = document.getElementById("twinHUDName");
    const metaEl = document.getElementById("twinHUDMeta");
    if (!nameEl || !metaEl) return;

    if (!data) {
      nameEl.textContent = "MUREZA Villager EV Modular Platform";
      metaEl.textContent = "240 Localized Components • Pan-African Component Scope";
      return;
    }

    nameEl.textContent = `${data.name} (${data.tier})`;
    metaEl.textContent = `${data.parts} • AfCFTA Domestic Target: ${data.targetDomestic}`;
  }

  function updateExplodeBtnState() {
    const btn = document.getElementById("btnToggleExplode");
    if (btn) {
      btn.textContent = isExploded ? "Assemble Architecture" : "Explode Architecture";
      btn.classList.toggle("active", isExploded);
    }
  }

  function updateRotateBtnState() {
    const btn = document.getElementById("btnToggleRotate");
    if (btn) {
      btn.textContent = autoRotate ? "Pause 360°" : "Play 360°";
      btn.classList.toggle("active", autoRotate);
    }
  }

  // Export initialization trigger
  window.initVillagerDigitalTwin = function (containerId = "twin3DCanvasContainer") {
    init3DViewer(containerId);
  };
})();
