import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SettlementState } from '../types';
import { RotateCcw, Camera, Move, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';

interface ThreeJSRendererProps {
  state: SettlementState;
  selectedUnitId?: string | null;
  selectedCoreId?: string | null;
  onSelectUnit?: (id: string | null) => void;
  onSelectCore?: (id: string | null) => void;
  width?: number;
  height?: number;
}

export const ThreeJSRenderer: React.FC<ThreeJSRendererProps> = ({
  state,
  selectedUnitId,
  selectedCoreId,
  onSelectUnit,
  onSelectCore,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [camMode, setCamMode] = useState<'iso' | 'perspective'>('iso');

  // Camera orbital state
  const cameraState = useRef({
    radius: 45,
    theta: Math.PI / 4, // 45 deg yaw
    phi: Math.PI / 3,   // pitch
    target: new THREE.Vector3(0, 2, 0)
  });

  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const previousMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !state) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xf7f5f2, 1);

    // Enable soft shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sunLight.position.set(40, 60, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    const shadowD = 40;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.45);
    fillLight.position.set(-30, 40, -30);
    scene.add(fillLight);

    const units = state.units || [];
    const cores = state.cores || [];
    const courtyards = state.courtyards || [];
    const entrances = state.entrances || [];
    const gridW = state.gridWidth || 40;
    const gridH = state.gridHeight || 40;

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    const unitGroup = new THREE.Group();

    // 1. Ground Base Plane - Centered under the grid
    const groundGeo = new THREE.PlaneGeometry(gridW * 1.5, gridH * 1.5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.9,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(gridW / 2, -0.05, gridH / 2);
    groundMesh.receiveShadow = true;
    unitGroup.add(groundMesh);
    geometries.push(groundGeo);
    materials.push(groundMat);

    // 1.5. Grid Helper on Ground - Exactly matching 1x1 grid cells
    const gridHelper = new THREE.GridHelper(Math.max(gridW, gridH), Math.max(gridW, gridH), 0xd9d4cf, 0xe5e7eb);
    gridHelper.position.set(gridW / 2, 0.01, gridH / 2);
    unitGroup.add(gridHelper);

    // 2. Site Boundary Lines (Red dashed) matching 2D site boundary
    const activeBoundaryPoints = (() => {
      if (state.customBoundaryPoints && state.customBoundaryPoints.length > 0) {
        return state.customBoundaryPoints;
      }
      const s = 3;
      if (state.siteShape === 'skewed') {
        return [
          { x: s + Math.floor(gridW * 0.22), y: s },
          { x: gridW - s, y: s + Math.floor(gridH * 0.15) },
          { x: gridW - s - Math.floor(gridW * 0.18), y: gridH - s },
          { x: s, y: gridH - s - Math.floor(gridH * 0.1) },
        ];
      }
      return [
        { x: s, y: s },
        { x: gridW - s, y: s },
        { x: gridW - s, y: gridH - s },
        { x: s, y: gridH - s },
      ];
    })();

    const boundaryPoints: THREE.Vector3[] = activeBoundaryPoints.map(
      pt => new THREE.Vector3(pt.x, 0.08, pt.y)
    );
    if (activeBoundaryPoints.length > 0) {
      const first = activeBoundaryPoints[0];
      boundaryPoints.push(new THREE.Vector3(first.x, 0.08, first.y));
    }

    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
    const boundaryMat = new THREE.LineDashedMaterial({
      color: 0xdc2626,
      linewidth: 3,
      dashSize: 1.0,
      gapSize: 0.5
    });
    const boundaryLine = new THREE.Line(boundaryGeo, boundaryMat);
    boundaryLine.computeLineDistances();
    unitGroup.add(boundaryLine);
    geometries.push(boundaryGeo);
    materials.push(boundaryMat);

    // Boundary corner posts
    activeBoundaryPoints.forEach(pt => {
      const postGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.2, 12);
      const postMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const postMesh = new THREE.Mesh(postGeo, postMat);
      postMesh.position.set(pt.x, 0.6, pt.y);
      postMesh.castShadow = true;
      unitGroup.add(postMesh);
      geometries.push(postGeo);
      materials.push(postMat);
    });

    // 3. Courtyards (Green Lawns)
    courtyards.forEach(court => {
      court.gridCoords.forEach(c => {
        const courtGeo = new THREE.BoxGeometry(0.96, 0.06, 0.96);
        const courtMat = new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.8 });
        const courtMesh = new THREE.Mesh(courtGeo, courtMat);
        courtMesh.position.set(c.x + 0.5, 0.03, c.y + 0.5);
        courtMesh.receiveShadow = true;
        unitGroup.add(courtMesh);
        geometries.push(courtGeo);
        materials.push(courtMat);
      });
    });

    // 3b. Green Spaces (Two-Tier System: Tier 1 Buffer vs Tier 2 Park/Ground)
    const greenSpaces = state.greenSpaces || [];
    greenSpaces.forEach(gs => {
      const isTier1 = gs.tier === 1;
      const color = isTier1 ? 0xbfc9a2 : 0xede5d9; // Courtyard color (0xbfc9a2) vs Ground color (0xede5d9)
      const gsMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      materials.push(gsMat);

      gs.gridCoords.forEach(c => {
        const hVal = isTier1 ? 0.04 : 0.02;
        const gsGeo = new THREE.BoxGeometry(0.96, hVal, 0.96);
        const gsMesh = new THREE.Mesh(gsGeo, gsMat);
        gsMesh.position.set(c.x + 0.5, hVal / 2, c.y + 0.5);
        gsMesh.receiveShadow = true;
        unitGroup.add(gsMesh);
        geometries.push(gsGeo);
      });
    });

    // 4. Ground Entrances Corridors
    entrances.forEach(ent => {
      const entGeo = new THREE.BoxGeometry(0.92, 0.1, 0.92);
      const entMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.4 });
      const entMesh = new THREE.Mesh(entGeo, entMat);
      entMesh.position.set(ent.x + 0.5, 0.05, ent.y + 0.5);
      entMesh.receiveShadow = true;
      unitGroup.add(entMesh);
      geometries.push(entGeo);
      materials.push(entMat);

      // Add prominent red arrow pointing towards connected core
      if (cores.length > 0) {
        let targetCore = cores.find(c => ent.id && ent.id.includes(c.id));
        if (!targetCore) {
          let minD = Infinity;
          cores.forEach(c => {
            let sx = 0, sy = 0;
            if (c.gridCoords && c.gridCoords.length > 0) {
              c.gridCoords.forEach(pt => { sx += pt.x; sy += pt.y; });
              sx = sx / c.gridCoords.length + 0.5;
              sy = sy / c.gridCoords.length + 0.5;
            } else {
              sx = c.x + 0.5;
              sy = c.y + 0.5;
            }
            const d = Math.hypot(sx - (ent.x + 0.5), sy - (ent.y + 0.5));
            if (d < minD) { minD = d; targetCore = c; }
          });
        }
        if (targetCore) {
          let targetX = targetCore.x + 0.5;
          let targetY = targetCore.y + 0.5;
          if (targetCore.gridCoords && targetCore.gridCoords.length > 0) {
            let sx = 0, sy = 0;
            targetCore.gridCoords.forEach(pt => { sx += pt.x; sy += pt.y; });
            targetX = sx / targetCore.gridCoords.length + 0.5;
            targetY = sy / targetCore.gridCoords.length + 0.5;
          }
          const dir = new THREE.Vector3(targetX - (ent.x + 0.5), 0, targetY - (ent.y + 0.5)).normalize();
          const origin = new THREE.Vector3(ent.x + 0.5, 0.15, ent.y + 0.5);
          const arrowHelper = new THREE.ArrowHelper(dir, origin, 0.85, 0xdc2626, 0.35, 0.28);
          unitGroup.add(arrowHelper);
        }
      }
    });

    // 5. Cores (Duct Cores)
    cores.forEach(core => {
      const xs = core.gridCoords.map(c => c.x);
      const ys = core.gridCoords.map(c => c.y);
      if (xs.length === 0) return;

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const cW = maxX - minX + 1;
      const cH = maxY - minY + 1;

      const connectedUnits = units.filter(u => u.coreId === core.id);
      const maxLvl = connectedUnits.length > 0 ? Math.max(...connectedUnits.map(u => u.level)) : 0;
      const cDepth = maxLvl + 2.5;

      const isSelected = selectedCoreId === core.id;

      const coreGeo = new THREE.BoxGeometry(cW, cDepth, cH);
      const coreMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xe65100 : 0x334155,
        roughness: 0.4,
        metalness: 0.3
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;

      const cx = minX + cW / 2;
      const cy = minY + cH / 2;
      const cz = cDepth / 2;

      coreMesh.position.set(cx, cz, cy);
      coreMesh.userData = { id: core.id, type: 'core' };
      unitGroup.add(coreMesh);
      geometries.push(coreGeo);
      materials.push(coreMat);
    });

    // 6. Units (Residential Container Modules)
    units.forEach(unit => {
      const xs = unit.gridCoords.map(c => c.x);
      const ys = unit.gridCoords.map(c => c.y);
      if (xs.length === 0) return;

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const uW = maxX - minX + 1;
      const uH = maxY - minY + 1;
      const uDepth = 0.95; // Container height

      const isSelected = selectedUnitId === unit.id;

      const unitGeo = new THREE.BoxGeometry(uW - 0.08, uDepth, uH - 0.08);

      let baseColor = new THREE.Color(unit.color || '#E65100');
      if (isSelected) baseColor = new THREE.Color('#f59e0b');

      const unitMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.5,
        metalness: 0.15
      });

      const unitMesh = new THREE.Mesh(unitGeo, unitMat);
      unitMesh.castShadow = true;
      unitMesh.receiveShadow = true;

      const ux = minX + uW / 2;
      const uy = minY + uH / 2;
      const uz = unit.level + uDepth / 2 + 0.05;

      unitMesh.position.set(ux, uz, uy);
      unitMesh.userData = { id: unit.id, type: 'unit' };

      // Edges wireframe
      const edges = new THREE.EdgesGeometry(unitGeo);
      const lineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0x000000 : 0x2d2926,
        linewidth: isSelected ? 2 : 1
      });
      const wireframe = new THREE.LineSegments(edges, lineMat);
      unitMesh.add(wireframe);

      unitGroup.add(unitMesh);
      geometries.push(unitGeo, edges);
      materials.push(unitMat, lineMat);
    });

    // Center the group in world space
    unitGroup.position.set(-gridW / 2, 0, -gridH / 2);
    scene.add(unitGroup);

    // Setup Cameras
    const aspect = width / height;
    let camera: THREE.Camera;

    const orthoCam = new THREE.OrthographicCamera(
      -30 * aspect,
      30 * aspect,
      30,
      -30,
      1,
      1000
    );

    const perspCam = new THREE.PerspectiveCamera(45, aspect, 1, 1000);

    const updateCameraPosition = () => {
      const { radius, theta, phi, target } = cameraState.current;
      const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.cos(theta);

      if (camMode === 'iso') {
        // Dynamically update frustum to support orthographic zooming
        const frustum = radius * 0.7;
        orthoCam.left = -frustum * aspect;
        orthoCam.right = frustum * aspect;
        orthoCam.top = frustum;
        orthoCam.bottom = -frustum;
        orthoCam.updateProjectionMatrix();

        orthoCam.position.set(x, y, z);
        orthoCam.lookAt(target);
        camera = orthoCam;
      } else {
        perspCam.position.set(x, y, z);
        perspCam.lookAt(target);
        camera = perspCam;
      }
    };

    updateCameraPosition();

    // Render loop
    let animId: number;
    const renderLoop = () => {
      updateCameraPosition();
      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // Mouse Controls for Orbiting, Panning & Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseDownPos = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      isPanningRef.current = (e.button === 2 || e.button === 1 || e.shiftKey);
      previousMousePos.current = { x: e.clientX, y: e.clientY };
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePos.current.x;
      const deltaY = e.clientY - previousMousePos.current.y;

      if (isPanningRef.current) {
        const panSpeed = cameraState.current.radius * 0.0018;
        const theta = cameraState.current.theta;

        const forwardX = -Math.sin(theta);
        const forwardZ = -Math.cos(theta);
        const rightX = Math.cos(theta);
        const rightZ = -Math.sin(theta);

        cameraState.current.target.x -= (rightX * deltaX - forwardX * deltaY) * panSpeed;
        cameraState.current.target.z -= (rightZ * deltaX - forwardZ * deltaY) * panSpeed;
      } else {
        cameraState.current.theta -= deltaX * 0.008;
        cameraState.current.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, cameraState.current.phi - deltaY * 0.008));
      }

      previousMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e: MouseEvent) => {
      isDraggingRef.current = false;
      isPanningRef.current = false;

      // Check if it was a quick click rather than a drag
      const dragDist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
      if (dragDist < 5 && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(unitGroup.children, false);

        if (intersects.length > 0) {
          const hit = intersects[0].object;
          if (hit.userData && hit.userData.type === 'unit' && onSelectUnit) {
            onSelectUnit(hit.userData.id);
          } else if (hit.userData && hit.userData.type === 'core' && onSelectCore) {
            onSelectCore(hit.userData.id);
          }
        } else {
          if (onSelectUnit) onSelectUnit(null);
          if (onSelectCore) onSelectCore(null);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      cameraState.current.radius = Math.max(8, Math.min(180, cameraState.current.radius * zoomFactor));
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const canvasEl = canvasRef.current;
    canvasEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    canvasEl.addEventListener('mouseup', handleMouseUp);
    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    canvasEl.addEventListener('contextmenu', handleContextMenu);

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      const newAspect = newW / newH;

      renderer.setSize(newW, newH);
      const frustum = cameraState.current.radius * 0.7;
      orthoCam.left = -frustum * newAspect;
      orthoCam.right = frustum * newAspect;
      orthoCam.top = frustum;
      orthoCam.bottom = -frustum;
      orthoCam.updateProjectionMatrix();

      perspCam.aspect = newAspect;
      perspCam.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvasEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      canvasEl.removeEventListener('mouseup', handleMouseUp);
      canvasEl.removeEventListener('wheel', handleWheel);
      canvasEl.removeEventListener('contextmenu', handleContextMenu);

      renderer.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    };
  }, [state, camMode, selectedUnitId, selectedCoreId, onSelectUnit, onSelectCore]);

  const handleResetCamera = () => {
    cameraState.current = {
      radius: 45,
      theta: Math.PI / 4,
      phi: Math.PI / 3,
      target: new THREE.Vector3(0, 2, 0)
    };
  };

  const handleZoomIn = () => {
    cameraState.current.radius = Math.max(8, cameraState.current.radius * 0.82);
  };

  const handleZoomOut = () => {
    cameraState.current.radius = Math.min(180, cameraState.current.radius * 1.2);
  };

  const handleCaptureScreenshot = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Settle-ThreeJS-Render-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#F7F5F2] select-none">
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing block" />

      {/* Floating Control Overlay Bar for Three.js */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#FDFCFB]/90 backdrop-blur-md px-3 py-2 border border-[#D9D4CF] shadow-sm rounded-sm" dir="rtl">
        <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#2D2926] border-l border-[#D9D4CF] pl-2.5 ml-1">
          <Sparkles size={13} className="text-[#E65100]" />
          <span>رندر سه بعدی Three.js</span>
        </div>

        <button
          onClick={() => setCamMode(camMode === 'iso' ? 'perspective' : 'iso')}
          className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-[#F7F5F2] text-[#2D2926] border border-[#D9D4CF] transition rounded-xs cursor-pointer"
          title="تغییر حالت دوربین بین آیزومتریک و پرسپکتیو"
        >
          {camMode === 'iso' ? 'دوربین: ایزومتریک' : 'دوربین: پرسپکتیو'}
        </button>

        <div className="flex items-center gap-0.5 border-r border-[#D9D4CF] pr-1 ml-1">
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-[#2D2926] bg-white hover:bg-[#F7F5F2] border border-[#D9D4CF] transition rounded-xs cursor-pointer"
            title="بزرگ‌نمایی (زوم این)"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-[#2D2926] bg-white hover:bg-[#F7F5F2] border border-[#D9D4CF] transition rounded-xs cursor-pointer"
            title="کوچک‌نمایی (زوم اوت)"
          >
            <ZoomOut size={12} />
          </button>
        </div>

        <button
          onClick={handleResetCamera}
          className="p-1.5 text-[#2D2926] bg-white hover:bg-[#F7F5F2] border border-[#D9D4CF] transition rounded-xs cursor-pointer"
          title="بازنشانی زاویه دید و دوربین"
        >
          <RotateCcw size={12} />
        </button>

        <button
          onClick={handleCaptureScreenshot}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-[#E65100] hover:bg-[#D84315] text-white transition rounded-xs cursor-pointer"
          title="دانلود عکس با کیفیت بالا از دید Three.js"
        >
          <Camera size={12} />
          <span>عکس رندر</span>
        </button>
      </div>

      {/* Interactive Helper Hint */}
      <div className="absolute bottom-4 left-4 z-20 bg-[#FDFCFB]/85 backdrop-blur-xs px-3 py-1.5 border border-[#D9D4CF] text-[10px] text-[#8B8378] rounded-xs font-mono flex items-center gap-2" dir="rtl">
        <Move size={11} className="text-[#E65100]" />
        <span>اسکرول موس: زوم روی طرح | راست کلیک + درگ: پن (جابجایی) | چپ کلیک: چرخش ۳D و انتخاب واحدها</span>
      </div>
    </div>
  );
};
