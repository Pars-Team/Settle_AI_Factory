/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo, MouseEvent, TouchEvent, ChangeEvent } from 'react';
import { Unit, Core, Courtyard, Path, SettlementState, Cluster, GenerationParams } from '../types';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  Compass, 
  Move, 
  Sparkles,
  Info,
  Waves,
  Hammer,
  Eye,
  Trash2,
  Eraser,
  GitCommit,
  ChevronUp,
  ChevronDown,
  Trees,
  Store,
  DoorOpen,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { getTerrainHeight, isCellInSiteBoundary } from '../generator';
import { validateCourtyards } from '../utils/courtyardValidator';
import { ThreeJSRenderer } from './ThreeJSRenderer';

interface SettlementCanvasProps {
  state: SettlementState;
  activeStage: number; // 1 to 6
  selectedUnitId: string | null;
  selectedCoreId: string | null;
  onSelectUnit: (id: string | null) => void;
  onSelectCore: (id: string | null) => void;
  params: GenerationParams;
  onChangeParams?: (newParams: GenerationParams) => void;
  onImport?: (params: GenerationParams, selectedSolutionKey?: 'A' | 'B' | 'C') => void;
  onDeleteUnit?: (id: string) => void;
  onDeleteCore?: (id: string) => void;
  onChangeUnitUsage?: (id: string, targetUsage?: 'residential' | 'entrance' | 'yard') => void;
  onToggleCourtyardCell?: (x: number, y: number) => void;
  onToggleEntranceCell?: (x: number, y: number) => void;
  onTogglePublicSpaceCell?: (x: number, y: number) => void;
  onClearEntrances?: () => void;
  onClearPublicSpaces?: () => void;
  onUndo?: () => void;
  hasUndo?: boolean;
  onOpenCourtyardValidator?: () => void;

  // Viewport sync props
  viewMode?: '2d' | '3d' | 'three3d' | 'elev_n' | 'elev_s' | 'elev_e' | 'elev_w';
  setViewMode?: (mode: '2d' | '3d' | 'three3d' | 'elev_n' | 'elev_s' | 'elev_e' | 'elev_w') => void;
  editMode?: 'view' | 'boundary' | 'obstacle' | 'slope' | 'yard' | 'entrance_design' | 'public_space_design' | 'delete_design';
  setEditMode?: (mode: 'view' | 'boundary' | 'obstacle' | 'slope' | 'yard' | 'entrance_design' | 'public_space_design' | 'delete_design') => void;
  pitch?: number;
  setPitch?: (p: number) => void;
  yaw?: number;
  setYaw?: (y: number) => void;
  zoom?: number;
  setZoom?: (z: number) => void;
  pan?: { x: number; y: number };
  setPan?: (p: { x: number; y: number }) => void;
  selectedFloorFilter?: number | 'all';
  setSelectedFloorFilter?: (f: number | 'all') => void;
  containerOpacity?: number;
  setContainerOpacity?: (o: number) => void;
  isComparePane?: boolean;
}

interface Drawable {
  id: string;
  type: 'terrain' | 'courtyard' | 'path-segment' | 'core' | 'unit' | 'unit-shadow' | 'entrance' | 'public_space' | 'green_space';
  depth: number;
  data: any;
}

export default function SettlementCanvas(props: SettlementCanvasProps) {
  const {
    state,
    activeStage,
    selectedUnitId,
    selectedCoreId,
    onSelectUnit,
    onSelectCore,
    params,
    onChangeParams,
    onImport,
    isComparePane,
    onDeleteUnit,
    onDeleteCore,
    onChangeUnitUsage,
    onToggleCourtyardCell,
    onToggleEntranceCell,
    onTogglePublicSpaceCell,
    onClearEntrances,
    onClearPublicSpaces,
    onUndo,
    hasUndo,
    onOpenCourtyardValidator
  } = props;

  const { gridWidth, gridHeight, cores, units, clusters, courtyards, paths, terrainZ, siteShape, terrainType } = state;

  const courtyardReport = useMemo(() => validateCourtyards(state), [state]);

  // Memoized 2D array of boundary checks to bypass PIP ray casting on 60fps dragging
  const inBoundsMap = useMemo(() => {
    const map: boolean[][] = [];
    for (let x = 0; x < gridWidth; x++) {
      map[x] = [];
      for (let y = 0; y < gridHeight; y++) {
        map[x][y] = isCellInSiteBoundary(x, y, gridWidth, gridHeight, siteShape, params.customBoundaryPoints);
      }
    }
    return map;
  }, [gridWidth, gridHeight, siteShape, params.customBoundaryPoints]);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fallbacks to local state if props are not supplied (backward compatibility)
  const [localViewMode, setLocalViewMode] = useState<'2d' | '3d' | 'three3d' | 'elev_n' | 'elev_s' | 'elev_e' | 'elev_w'>('3d');
  const viewMode = props.viewMode !== undefined ? props.viewMode : localViewMode;
  const setViewMode = props.setViewMode !== undefined ? props.setViewMode : setLocalViewMode;

  const [localEditMode, setLocalEditMode] = useState<'view' | 'boundary' | 'obstacle' | 'slope' | 'yard' | 'entrance_design' | 'public_space_design' | 'delete_design'>('view');
  const editMode = props.editMode !== undefined ? props.editMode : localEditMode;
  const setEditMode = props.setEditMode !== undefined ? props.setEditMode : setLocalEditMode;

  const [localContainerOpacity, setLocalContainerOpacity] = useState<number>(0.85);
  const containerOpacity = props.containerOpacity !== undefined ? props.containerOpacity : localContainerOpacity;
  const setContainerOpacity = props.setContainerOpacity !== undefined ? props.setContainerOpacity : setLocalContainerOpacity;

  const [localSelectedFloorFilter, setLocalSelectedFloorFilter] = useState<number | 'all'>('all');
  const selectedFloorFilter = props.selectedFloorFilter !== undefined ? props.selectedFloorFilter : localSelectedFloorFilter;
  const setSelectedFloorFilter = props.setSelectedFloorFilter !== undefined ? props.setSelectedFloorFilter : setLocalSelectedFloorFilter;

  const [localPitch, setLocalPitch] = useState<number>(42);
  const pitch = props.pitch !== undefined ? props.pitch : localPitch;
  const setPitch = props.setPitch !== undefined ? props.setPitch : setLocalPitch;

  const [localYaw, setLocalYaw] = useState<number>(-35);
  const yaw = props.yaw !== undefined ? props.yaw : localYaw;
  const setYaw = props.setYaw !== undefined ? props.setYaw : setLocalYaw;

  const [localZoom, setLocalZoom] = useState<number>(1.1);
  const zoom = props.zoom !== undefined ? props.zoom : localZoom;
  const setZoom = props.setZoom !== undefined ? props.setZoom : setLocalZoom;

  const [localPan, setLocalPan] = useState<{ x: number; y: number }>({ x: 0, y: -20 });
  const pan = props.pan !== undefined ? props.pan : localPan;
  const setPan = props.setPan !== undefined ? props.setPan : setLocalPan;

  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(false);
  const [isDrawingToolsExpanded, setIsDrawingToolsExpanded] = useState<boolean>(false);

  const [showSuccessNotification, setShowSuccessNotification] = useState<boolean>(false);
  const notificationTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (hasUndo) {
      setShowSuccessNotification(true);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => {
        setShowSuccessNotification(false);
      }, 5000);
    } else {
      setShowSuccessNotification(false);
    }

    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [state, hasUndo]);

  const handleTriggerUndo = () => {
    if (onUndo) {
      onUndo();
      setShowSuccessNotification(false);
    }
  };

  const [draftBoundaryPoints, setDraftBoundaryPoints] = useState<Array<{ x: number; y: number }>>(
    params.customBoundaryPoints || []
  );

  useEffect(() => {
    setDraftBoundaryPoints(params.customBoundaryPoints || []);
  }, [params.customBoundaryPoints]);

  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate'); // rotate or pan in 3D
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseDownPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);

  // Reset viewport settings
  const resetViewport = () => {
    setZoom(1.1);
    setPan({ x: 0, y: -20 });
    setPitch(42);
    setYaw(-35);
  };

  // Attach programmatic wheel event with `passive: false` to allow page scroll locking
  useEffect(() => {
    const handleSvgWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      setZoom(prev => Math.max(0.4, Math.min(5, prev * factor)));
    };

    const svgEl = svgRef.current;
    if (svgEl) {
      svgEl.addEventListener('wheel', handleSvgWheel, { passive: false });
    }
    return () => {
      if (svgEl) {
        svgEl.removeEventListener('wheel', handleSvgWheel);
      }
    };
  }, []);

  // Mouse Drag handlers
  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    // Avoid dragging starting on overlay buttons
    if ((e.target as HTMLElement).closest('.canvas-control-overlay')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    // Check total displacement from drag start to avoid jitter falsely triggering drag
    const totalDX = Math.abs(e.clientX - mouseDownPos.current.x);
    const totalDY = Math.abs(e.clientY - mouseDownPos.current.y);
    if (totalDX > 10 || totalDY > 10) {
      hasDraggedRef.current = true;
    }
    
    dragStart.current = { x: e.clientX, y: e.clientY };

    if (viewMode === '2d' || viewMode.startsWith('elev_')) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else {
      if (dragMode === 'rotate') {
        setViewMode('3d'); // Ensure we are in 3D to rotate
        setYaw(prev => prev + dx * 0.5);
        setPitch(prev => Math.max(15, Math.min(85, prev - dy * 0.4)));
      } else {
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Handlers for mobile/tablet rotation, panning & drawing
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartTime = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);

  const handleTouchStart = (e: TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 0) return;
    if ((e.target as HTMLElement).closest('.canvas-control-overlay')) return;
    
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchStartTime.current = Date.now();
    hasDraggedRef.current = false;
  };

  const handleTouchMove = (e: TouchEvent<SVGSVGElement>) => {
    if (!isDragging || e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    
    const totalDX = Math.abs(touch.clientX - touchStartPos.current.x);
    const totalDY = Math.abs(touch.clientY - touchStartPos.current.y);
    if (totalDX > 10 || totalDY > 10) {
      hasDraggedRef.current = true;
    }

    dragStart.current = { x: touch.clientX, y: touch.clientY };

    if (viewMode === '2d' || viewMode.startsWith('elev_')) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else {
      if (dragMode === 'rotate') {
        setViewMode('3d');
        setYaw(prev => prev + dx * 0.5);
        setPitch(prev => Math.max(15, Math.min(85, prev - dy * 0.4)));
      } else {
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent<SVGSVGElement>) => {
    setIsDragging(false);
    lastTouchTimeRef.current = Date.now();
    
    // Check if it was a quick tap/touch-click rather than a swipe drag
    const duration = Date.now() - touchStartTime.current;
    if (duration < 300 && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx < 10 && dy < 10) {
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (targetElement) {
          const cellId = targetElement.getAttribute('id');
          if (cellId && cellId.startsWith('terrain-')) {
            const parts = cellId.split('-');
            const tx = parseInt(parts[1]);
            const ty = parseInt(parts[2]);
            if (!isNaN(tx) && !isNaN(ty)) {
              handleCellClick(tx, ty, { clientX: touch.clientX, clientY: touch.clientY } as any);
            }
          }
        }
      }
    }
  };

  const handleCellClick = (x: number, y: number, e: MouseEvent) => {
    // Prevent duplicated trigger from touch translated clicks
    if (Date.now() - lastTouchTimeRef.current < 600) {
      return;
    }
    
    // Check if mouse actually dragged (using highly robust state tracking)
    if (hasDraggedRef.current) {
      return; // ignore as drag
    }
    
    if (editMode === 'boundary') {
      const existsIdx = draftBoundaryPoints.findIndex(pt => pt.x === x && pt.y === y);
      let newPoints;
      if (existsIdx > -1) {
        newPoints = draftBoundaryPoints.filter((_, idx) => idx !== existsIdx);
      } else {
        newPoints = [...draftBoundaryPoints, { x, y }];
      }
      setDraftBoundaryPoints(newPoints);
    } else if (editMode === 'obstacle') {
      const currentObstacles = params.obstacles || [];
      const exists = currentObstacles.some(pt => pt.x === x && pt.y === y);
      let newObstacles;
      if (exists) {
        newObstacles = currentObstacles.filter(pt => !(pt.x === x && pt.y === y));
      } else {
        newObstacles = [...currentObstacles, { x, y }];
      }
      
      if (onChangeParams) {
        onChangeParams({
          ...params,
          obstacles: newObstacles
        });
      }
    } else if (editMode === 'yard') {
      if (onToggleCourtyardCell) {
        onToggleCourtyardCell(x, y);
      }
    } else if (editMode === 'entrance_design') {
      if (onToggleEntranceCell) {
        onToggleEntranceCell(x, y);
      }
    } else if (editMode === 'public_space_design') {
      if (onTogglePublicSpaceCell) {
        onTogglePublicSpaceCell(x, y);
      }
    } else if (editMode === 'delete_design') {
      const hasEnt = (state.entrances || []).some(ent => ent.x === x && ent.y === y);
      const hasPs = (state.publicSpaces || []).some(ps => ps.x === x && ps.y === y);
      if (hasEnt && onToggleEntranceCell) {
        onToggleEntranceCell(x, y);
      } else if (hasPs && onTogglePublicSpaceCell) {
        onTogglePublicSpaceCell(x, y);
      }
    } else {
      onSelectUnit(null);
      onSelectCore(null);
    }
  };

  // Pre-calculate trigonometric constants once per render to optimize rendering and rotation performance
  const radYaw = (yaw * Math.PI) / 180;
  const radPitch = (pitch * Math.PI) / 180;
  const cosYaw = Math.cos(radYaw);
  const sinYaw = Math.sin(radYaw);
  const cosPitch = Math.cos(radPitch);
  const sinPitch = Math.sin(radPitch);

  // Project coordinates from 3D grid space (x, y, z) into 2D SVG pixel center (800x600 coordinate center)
  const project = (gx: number, gy: number, gz: number) => {
    const spacing = 17; // physical unit width
    const heightCoef = 14; // physical container height representation

    // Align grid to origin
    const cx = (gx - gridWidth / 2) * spacing;
    const cy = (gy - gridHeight / 2) * spacing;

    if (viewMode === '2d') {
      return {
        x: 400 + pan.x + cx * zoom,
        y: 280 + pan.y + cy * zoom
      };
    }

    if (viewMode === 'elev_n') {
      // Looking from North (pure 2D Elevation, X is horizontal, Z is vertical)
      return {
        x: 400 + pan.x + cx * zoom,
        y: 330 + pan.y - gz * 15 * zoom
      };
    }

    if (viewMode === 'elev_s') {
      // Looking from South (pure 2D Elevation, X is horizontal, Z is vertical)
      return {
        x: 400 + pan.x + cx * zoom,
        y: 330 + pan.y - gz * 15 * zoom
      };
    }

    if (viewMode === 'elev_e') {
      // Looking from East (pure 2D Elevation, Y is horizontal, Z is vertical)
      return {
        x: 400 + pan.x + cy * zoom,
        y: 330 + pan.y - gz * 15 * zoom
      };
    }

    if (viewMode === 'elev_w') {
      // Looking from West (pure 2D Elevation, Y is horizontal, Z is vertical)
      return {
        x: 400 + pan.x - cy * zoom,
        y: 330 + pan.y - gz * 15 * zoom
      };
    }

    const cz = gz * 11;

    // Yaw rotation
    const rx = cx * cosYaw - cy * sinYaw;
    const ry = cx * sinYaw + cy * cosYaw;

    // Pitch rotation
    const sx = rx;
    const sy = ry * cosPitch - cz * sinPitch;

    return {
      x: 400 + pan.x + sx * zoom,
      y: 280 + pan.y + sy * zoom
    };
  };

  // Depth formula for pintor back-to-front sorting
  const getDepth = (gx: number, gy: number, gz: number) => {
    if (viewMode === '2d') {
      return gz; // Stack layer (level 0 then 1 then 2)
    }

    if (viewMode === 'elev_n') {
      // Far is larger Y, closer is smaller Y -> render larger gy (far) first: smaller gy has larger depth
      return -gy * 100 + gz;
    }
    if (viewMode === 'elev_s') {
      // Far is smaller Y, closer is larger Y -> render smaller gy (far) first: larger gy has larger depth
      return gy * 100 + gz;
    }
    if (viewMode === 'elev_e') {
      // Far is smaller X, closer is larger X -> render smaller gx (far) first: larger gx has larger depth
      return gx * 100 + gz;
    }
    if (viewMode === 'elev_w') {
      // Far is larger X, closer is smaller X -> render larger gx (far) first: smaller gx has larger depth
      return -gx * 100 + gz;
    }

    const spacing = 17;
    const heightCoef = 11;
    const cx = (gx - gridWidth / 2) * spacing;
    const cy = (gy - gridHeight / 2) * spacing;
    const cz = gz * heightCoef;

    const ry = cx * sinYaw + cy * cosYaw;
    return ry * sinPitch + cz * cosPitch;
  };

  // Compile a list of drawables stochastically depending on current morphogenetic stage
  const drawables: Drawable[] = [];

  // 1. Terrain cells drawables (Visible inside bounds)
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const inBounds = inBoundsMap[x]?.[y] ?? false;
      const isWater = terrainType === 'coastal' && (terrainZ[`${x},${y}`] || 0) < 0;
      const isRiver = siteShape === 'custom_boundary' && (terrainZ[`${x},${y}`] || 0) === 0 && (y >= gridHeight * 0.72 && y <= gridHeight * 0.76);
      
      const z00 = terrainZ[`${x},${y}`] || 0;
      const z10 = terrainZ[`${x+1},${y}`] || z00;
      const z01 = terrainZ[`${x},${y+1}`] || z00;
      const z11 = terrainZ[`${x+1},${y+1}`] || z00;

      const cz = (z00 + z10 + z01 + z11) / 4;
      const depth = getDepth(x + 0.5, y + 0.5, cz);

      drawables.push({
        id: `terrain-${x}-${y}`,
        type: 'terrain',
        depth,
        data: { x, y, inBounds, isWater, isRiver, z00, z10, z01, z11 }
      });
    }
  }

  // 2. Courtyard pocket parks (Stage 4 onwards)
  if (activeStage >= 4 && (selectedFloorFilter === 'all' || selectedFloorFilter === 0)) {
    courtyards.forEach(court => {
      // average height index is derived from terrain heights
      let hSum = 0;
      court.gridCoords.forEach(pt => hSum += terrainZ[`${pt.x},${pt.y}`] || 0);
      const zTerrain = hSum / court.gridCoords.length;

      const depth = getDepth(court.x + 1, court.y + 1, zTerrain + 0.05);
      drawables.push({
        id: court.id,
        type: 'courtyard',
        depth,
        data: { court, zTerrain }
      });
    });
  }

  // 2a-2. Green Spaces (Two-Tier System: Tier 1 Buffer & Tier 2 Shared Park)
  if (selectedFloorFilter === 'all' || selectedFloorFilter === 0) {
    const greenSpaces = state.greenSpaces || [];
    greenSpaces.forEach(gs => {
      gs.gridCoords.forEach((pt, idx) => {
        const zTerrain = terrainZ[`${pt.x},${pt.y}`] || 0;
        const depth = getDepth(pt.x + 0.5, pt.y + 0.5, zTerrain + 0.045);
        drawables.push({
          id: `green-${gs.id}-${idx}`,
          type: 'green_space',
          depth,
          data: { pt, tier: gs.tier, clusterId: gs.clusterId, zTerrain }
        });
      });
    });
  }

  // 2b. Custom Entrances (site design)
  if (selectedFloorFilter === 'all' || selectedFloorFilter === 0) {
    const customEntrances = state.entrances || [];
    customEntrances.forEach(ent => {
      const zTerrain = terrainZ[`${ent.x},${ent.y}`] || 0;
      const depth = getDepth(ent.x + 0.5, ent.y + 0.5, zTerrain + 0.06);
      drawables.push({
        id: ent.id,
        type: 'entrance',
        depth,
        data: { ent, zTerrain }
      });
    });
  }

  // 2c. Custom Public Spaces (site design)
  if (selectedFloorFilter === 'all' || selectedFloorFilter === 0) {
    const customPublicSpaces = state.publicSpaces || [];
    customPublicSpaces.forEach(ps => {
      const zTerrain = terrainZ[`${ps.x},${ps.y}`] || 0;
      const depth = getDepth(ps.x + 0.5, ps.y + 0.5, zTerrain + 0.06);
      drawables.push({
        id: ps.id,
        type: 'public_space',
        depth,
        data: { ps, zTerrain }
      });
    });
  }

  // 3. Infrastructure Paths (Stage 5 onwards, matching emerging desire lines)
  if (activeStage >= 5 && (selectedFloorFilter === 'all' || selectedFloorFilter === 0)) {
    paths.forEach((path, pathIdx) => {
      for (let i = 0; i < path.coords.length - 1; i++) {
        const ptA = path.coords[i];
        const ptB = path.coords[i + 1];

        const zA = terrainZ[`${ptA.x},${ptA.y}`] || 0;
        const zB = terrainZ[`${ptB.x},${ptB.y}`] || 0;

        const depth = getDepth((ptA.x + ptB.x) / 2, (ptA.y + ptB.y) / 2, (zA + zB) / 2 + 0.08);
        drawables.push({
          id: `path-seg-${pathIdx}-${i}`,
          type: 'path-segment',
          depth,
          data: { ptA, ptB, zA, zB, pathType: path.type }
        });
      }
    });
  }


  // 4. Core seed towers (Stage 1 onwards)
  cores.forEach(core => {
    const isSelected = selectedCoreId === core.id;
    let baseZ = terrainZ[`${core.x},${core.y}`] || 0;
    
    // Core height dynamically matches the highest level of its cluster units (or 1.5 default)
    const coreUnits = units.filter(u => u.coreId === core.id);
    let sizeZ = 1.5; 
    let maxUnitLevel = 0;
    if (coreUnits.length > 0) {
      maxUnitLevel = Math.max(...coreUnits.map(u => u.level));
      sizeZ = (maxUnitLevel + 1) * 1.0;
    } else if (activeStage >= 2) {
      // If it is stage 2+ but no units are attached to this core yet
      sizeZ = 1.0;
    }

    // Section cut formatting if floor level is selected
    if (selectedFloorFilter !== 'all') {
      if (selectedFloorFilter > maxUnitLevel) {
        return; // Core doesn't rise info this floor level
      }
      baseZ = baseZ + selectedFloorFilter * 1.0;
      sizeZ = 1.0;
    }

    const depth = getDepth(core.x + 0.5, core.y + 0.5, baseZ + sizeZ / 2);

    drawables.push({
      id: core.id,
      type: 'core',
      depth,
      data: { core, baseZ, sizeZ, isSelected }
    });
  });

  // 5. Build units / containers (Stage 2 onwards stochastically)
  if (activeStage >= 2) {
    units.forEach(unit => {
      // Filter out if floor level selected
      if (selectedFloorFilter !== 'all' && unit.level !== selectedFloorFilter) {
        return;
      }

      const isSelected = selectedUnitId === unit.id;
      // Get bounding box of cells
      const xs = unit.gridCoords.map(c => c.x);
      const ys = unit.gridCoords.map(c => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      
      const groundZ = terrainZ[`${minX},${minY}`] || 0;
      const baseZ = groundZ + unit.level * 1.0; // 1 level is 1 unit height

      // Check depth sorting center
      const depth = getDepth(minX + w / 2, minY + h / 2, baseZ + 0.5);

      // Add shadow drawable cast slightly offset
      const shadowDepth = getDepth(minX + w / 2, minY + h / 2, baseZ + 0.01);
      drawables.push({
        id: `shadow-${unit.id}`,
        type: 'unit-shadow',
        depth: shadowDepth,
        data: { minX, minY, w, h, baseZ, groundZ }
      });

      drawables.push({
        id: unit.id,
        type: 'unit',
        depth,
        data: { unit, minX, minY, w, h, baseZ, isSelected }
      });
    });
  }

  // SORT DRAWABLES - Ascending depth (farthest rendered FIRST, closest LATER)
  drawables.sort((a, b) => a.depth - b.depth);

  // Helper variables for clicked details overlay panels
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const selectedCore = cores.find(c => c.id === selectedCoreId);

  return (
    <div id="settlement-canvas-container" className="relative w-full flex-1 h-full min-h-[400px] bg-[#EEEBE6] border border-[#D9D4CF] overflow-hidden shadow-sm flex flex-col">
      {/* Blueprint grid layout lines mimicking hand drafted site plan boards */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{
             backgroundImage: 'radial-gradient(#2D2926 0.5px, transparent 0.5px)',
             backgroundSize: '20px 20px'
           }} 
      />

      {/* STAGE HEADER MONITOR */}
      <div className="absolute top-4 right-4 z-10 bg-[#FDFCFB]/95 backdrop-blur-xs px-4 py-2.5 border border-[#D9D4CF] flex items-center gap-2.5 text-xs text-[#2D2926] pointer-events-auto shadow-sm" dir="rtl">
        <span className="w-2 h-2 rounded-full bg-[#E65100]"></span>
        <span>نمای شبیه‌ساز مورفوژنتیک:</span>
        <strong className="text-[#E65100] font-bold">
          {activeStage === 1 && 'فاز ۱ — جوانه زدن بذرها (Cores)'}
          {activeStage === 2 && 'فاز ۲ — رشد مجاورتی واحدها (Units)'}
          {activeStage === 3 && 'فاز ۳ — مرزگیری محلات (Clusters)'}
          {activeStage === 4 && 'فاز ۴ — آفرینش میان‌سراها (Courtyards)'}
          {activeStage === 5 && 'فاز ۵ — مسیریابی ارگانیک (Paths)'}
          {activeStage === 6 && 'فاز ۶ — سنتز نهایی بافت سکونتگاه'}
        </strong>
      </div>



      {/* MAIN EXPLICIT CANVAS: Three.js 3D View or SVG Isometric Canvas */}
      {viewMode === 'three3d' ? (
        <ThreeJSRenderer
          state={state}
          selectedUnitId={selectedUnitId}
          selectedCoreId={selectedCoreId}
          onSelectUnit={onSelectUnit}
          onSelectCore={onSelectCore}
        />
      ) : (
      <svg
        ref={svgRef}
        id="settlement-svg"
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none select-none bg-[#F7F5F2]"
        viewBox="0 0 800 600"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          onSelectUnit(null);
          onSelectCore(null);
        }}
      >
        <defs>
          <filter id="shadow-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" />
          </filter>
          <pattern id="grey-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45 0 0)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#71717A" strokeWidth="2.0" />
          </pattern>
          <pattern id="public-plaza" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135 0 0)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#595533" strokeWidth="1.8" />
          </pattern>
        </defs>

        {/* Render Sorted Drawables Pipeline */}
        {drawables.map(drawable => {
          const isBoundaryEdit = editMode === 'boundary';
          const dimOpacity = isBoundaryEdit ? 0.08 : 1.0;

          if (drawable.type === 'terrain') {
            const { x, y, inBounds, isWater, isRiver, z00, z10, z01, z11 } = drawable.data;

            if (viewMode.startsWith('elev_')) {
              // Draw 2D Elevation terrain soil profile slice!
              let pL, pBR, pTR, pTL;
              const zL = (z00 + z01) / 2;
              const zR = (z10 + z11) / 2;
              
              if (viewMode === 'elev_n' || viewMode === 'elev_s') {
                pL = project(x, y, -4.0); // very deep foundation bottom
                pBR = project(x + 1, y, -4.0);
                pTR = project(x + 1, y, zR);
                pTL = project(x, y, zL);
              } else {
                pL = project(x, y, -4.0);
                pBR = project(x, y + 1, -4.0);
                pTR = project(x, y + 1, (z01 + z11)/2);
                pTL = project(x, y, (z00 + z10)/2);
              }
              
              const pointsStr = `${pL.x},${pL.y} ${pBR.x},${pBR.y} ${pTR.x},${pTR.y} ${pTL.x},${pTL.y}`;
              
              let fill = '#E7E3DC'; // Soil earth
              let grassStroke = '#8D9B6A'; // grass green top line
              
              if (!inBounds) {
                fill = '#ECE9E4';
                grassStroke = '#A9B68A';
              } else if (isWater || isRiver) {
                fill = '#9BBFD9';
                grassStroke = '#4C82A8';
              }
              
              return (
                <g key={drawable.id} id={drawable.id}>
                  {/* Soil mass */}
                  <polygon
                    points={pointsStr}
                    fill={fill}
                    stroke="rgba(0,0,0,0.03)"
                    strokeWidth={0.5}
                  />
                  {/* Top green grass edge */}
                  <line
                    x1={pTL.x}
                    y1={pTL.y}
                    x2={pTR.x}
                    y2={pTR.y}
                    stroke={grassStroke}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </g>
              );
            }

            const p00 = project(x, y, z00);
            const p10 = project(x + 1, y, z10);
            const p11 = project(x + 1, y + 1, z11);
            const p01 = project(x, y + 1, z01);

            const pointsStr = `${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`;

            // Topographical Shading colors (distinct inside/outside site boundary)
            let baseColor = inBounds ? '#EDE5D9' : '#DFD6C9';
            if (isWater || isRiver) {
              baseColor = '#8EB7D5';
            }

            let fill = baseColor;
            let strokeVal = 'rgba(45, 41, 38, 0.04)';

            if (editMode === 'boundary') {
              strokeVal = 'rgba(239, 68, 68, 0.18)'; // active gentle red grid lines for boundary editing
            } else if (editMode === 'obstacle') {
              strokeVal = 'rgba(217, 119, 6, 0.18)'; // active gentle orange grid lines for obstacle editing
            }

            if (!inBounds) {
              if (editMode === 'boundary') {
                fill = '#E5DDD1'; // keep it pale but visible for drawing
                strokeVal = 'rgba(239, 68, 68, 0.12)';
              } else {
                fill = '#DFD6C9'; // distinct clay outer landscape
                strokeVal = 'none';
              }
            }

            // Apply 3D Slope Normal-Based Diffuse Lighting to Terrain
            const is3D = viewMode !== '2d' && !viewMode.startsWith('elev_');
            if (is3D && terrainType !== 'flat' && !isWater && !isRiver) {
              // X slope: (right - left)
              const slX = (z10 + z11)/2 - (z00 + z01)/2;
              // Y slope: (bottom - top)
              const slY = (z01 + z11)/2 - (z00 + z10)/2;

              // Normal vector is [-slX, -slY, 1] normalized
              const len = Math.sqrt(slX * slX + slY * slY + 1.0);
              const nx = -slX / len;
              const ny = -slY / len;
              const nz = 1.0 / len;

              // Sun direction vector L = [0.35, -0.53, 0.77] (afternoon high-contrast sun)
              const lx = 0.35;
              const ly = -0.53;
              const lz = 0.77;

              const dot = nx * lx + ny * ly + nz * lz;
              // Map dot (0.4 to 1.0) to shading intensity multiplier
              const factor = (dot - 0.75) * 1.5; // -0.52 to 0.37

              const shadeRGB = (colorHex: string, f: number) => {
                const r = parseInt(colorHex.slice(1, 3), 16);
                const g = parseInt(colorHex.slice(3, 5), 16);
                const b = parseInt(colorHex.slice(5, 7), 16);
                const adj = Math.round(f * 25);
                const nr = Math.max(0, Math.min(255, r + adj));
                const ng = Math.max(0, Math.min(255, g + adj));
                const nb = Math.max(0, Math.min(255, b + adj));
                return `rgb(${nr}, ${ng}, ${nb})`;
              };

              fill = shadeRGB(baseColor, factor);
            } else if (!is3D && terrainType !== 'flat' && !isWater && !isRiver) {
              // 2D elevation height shading
              const avgZ = (z00 + z10 + z01 + z11) / 4;
              const intensity = Math.floor(avgZ * 12);
              const shadeRGB = (colorHex: string, val: number) => {
                const r = parseInt(colorHex.slice(1, 3), 16);
                const g = parseInt(colorHex.slice(3, 5), 16);
                const b = parseInt(colorHex.slice(5, 7), 16);
                const nr = Math.max(0, Math.min(255, r + val));
                const ng = Math.max(0, Math.min(255, g + val));
                const nb = Math.max(0, Math.min(255, b + val));
                return `rgb(${nr}, ${ng}, ${nb})`;
              };
              fill = shadeRGB(baseColor, intensity);
            }

            // Draw Topographic Contour Lines (Every 0.35 units of height)
            const contours: any[] = [];
            const contourLevel = 0.35;
            if (terrainType !== 'flat' && !isWater && !isRiver) {
              const minZ = Math.min(z00, z10, z01, z11);
              const maxZ = Math.max(z00, z10, z01, z11);
              const hStart = Math.ceil(minZ / contourLevel) * contourLevel;
              for (let h = hStart; h <= maxZ; h += contourLevel) {
                const crossings = [];
                // Edge 00 -> 10
                if ((z00 <= h && z10 >= h) || (z10 <= h && z00 >= h)) {
                  const t = z10 === z00 ? 0.5 : (h - z00) / (z10 - z00);
                  crossings.push(project(x + t, y, h));
                }
                // Edge 10 -> 11
                if ((z10 <= h && z11 >= h) || (z11 <= h && z10 >= h)) {
                  const t = z11 === z10 ? 0.5 : (h - z10) / (z11 - z10);
                  crossings.push(project(x + 1, y + t, h));
                }
                // Edge 11 -> 01
                if ((z11 <= h && z01 >= h) || (z01 <= h && z11 >= h)) {
                  const t = z01 === z11 ? 0.5 : (h - z11) / (z01 - z11);
                  crossings.push(project(x + 1 - t, y + 1, h));
                }
                // Edge 01 -> 00
                if ((z01 <= h && z00 >= h) || (z00 <= h && z01 >= h)) {
                  const t = z00 === z01 ? 0.5 : (h - z01) / (z00 - z01);
                  crossings.push(project(x, y + 1 - t, h));
                }

                if (crossings.length >= 2) {
                  contours.push(
                    <line
                      key={`contour-${x}-${y}-${h}`}
                      x1={crossings[0].x}
                      y1={crossings[0].y}
                      x2={crossings[1].x}
                      y2={crossings[1].y}
                      stroke={inBounds ? "rgba(45, 41, 38, 0.11)" : "rgba(45, 41, 38, 0.06)"}
                      strokeWidth={0.7}
                      pointerEvents="none"
                    />
                  );
                }
              }
            }

            const isObs = params?.obstacles?.some(obs => obs.x === x && obs.y === y);
            if (isObs) {
              const avgZ = (z00 + z10 + z01 + z11) / 4;
              const pCenter = project(x + 0.5, y + 0.5, avgZ + 0.05);
              return (
                <g key={drawable.id} id={drawable.id} className="cursor-pointer" onClick={(e) => handleCellClick(x, y, e)}>
                  <polygon
                    points={pointsStr}
                    fill="#D9D4CF"
                    stroke="#EF4444"
                    strokeWidth={0.8}
                  />
                  <text
                    x={pCenter.x}
                    y={pCenter.y + 3}
                    textAnchor="middle"
                    fill="#DC2626"
                    fontSize="9"
                    fontWeight="black"
                  >
                    ✕
                  </text>
                </g>
              );
            }

            return (
              <g key={drawable.id}>
                <polygon
                  id={drawable.id}
                  points={pointsStr}
                  fill={fill}
                  stroke={strokeVal}
                  strokeWidth={0.5}
                  className="cursor-pointer transition hover:brightness-95"
                  onClick={(e) => handleCellClick(x, y, e)}
                />
                {contours}
              </g>
            );
          }

          if (drawable.type === 'courtyard') {
            const { court, zTerrain } = drawable.data;
            const status = courtyardReport.statuses.find(s => s.courtyardId === court.id);
            const isInvalid = status ? !status.isValid : false;

            // Compute central projected point for label tag badge
            let sumPx = 0, sumPy = 0;
            court.gridCoords.forEach((pt: any) => {
              const p = project(pt.x + 0.5, pt.y + 0.5, zTerrain + 0.05);
              sumPx += p.x;
              sumPy += p.y;
            });
            const centerPx = court.gridCoords.length > 0 ? sumPx / court.gridCoords.length : 0;
            const centerPy = court.gridCoords.length > 0 ? sumPy / court.gridCoords.length : 0;

            return (
              <g
                id={drawable.id}
                key={drawable.id}
                opacity={isBoundaryEdit ? dimOpacity : 0.95}
                className={editMode !== 'view' ? 'pointer-events-none' : 'cursor-pointer'}
                onClick={() => {
                  if (onOpenCourtyardValidator) onOpenCourtyardValidator();
                }}
              >
                {court.gridCoords.map((pt: any, i: number) => {
                  const p00 = project(pt.x, pt.y, zTerrain + 0.03);
                  const p10 = project(pt.x + 1, pt.y, zTerrain + 0.03);
                  const p11 = project(pt.x + 1, pt.y + 1, zTerrain + 0.03);
                  const p01 = project(pt.x, pt.y + 1, zTerrain + 0.03);
                  const pointsStr = `${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`;

                  return (
                    <polygon
                      key={`court-cell-${i}`}
                      points={pointsStr}
                      fill={isInvalid ? 'rgba(239, 68, 68, 0.45)' : '#BFC9A2'}
                      stroke={isInvalid ? '#DC2626' : '#8D9B6A'}
                      strokeWidth={isInvalid ? 1.6 : 0.6}
                      strokeDasharray={isInvalid ? '3,1' : undefined}
                    />
                  );
                })}

                {/* If invalid courtyard, display central warning tag */}
                {isInvalid && (
                  <g transform={`translate(${centerPx}, ${centerPy - 12})`}>
                    <rect
                      x="-38"
                      y="-9"
                      width="76"
                      height="18"
                      rx="3"
                      fill="#DC2626"
                      stroke="#991B1B"
                      strokeWidth="0.8"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      ⚠️ کمتر از ۲ جهت
                    </text>
                  </g>
                )}
              </g>
            );
          }

          if (drawable.type === 'entrance') {
            const { ent, zTerrain } = drawable.data;
            const p00 = project(ent.x, ent.y, zTerrain + 0.04);
            const p10 = project(ent.x + 1, ent.y, zTerrain + 0.04);
            const p11 = project(ent.x + 1, ent.y + 1, zTerrain + 0.04);
            const p01 = project(ent.x, ent.y + 1, zTerrain + 0.04);
            const pointsStr = `${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`;
            const tcX = (p00.x + p11.x) / 2;
            const tcY = (p00.y + p11.y) / 2;

            // Calculate angle pointing towards connected core
            let targetX = ent.x + 0.5;
            let targetY = ent.y + 0.5;
            if (state.cores && state.cores.length > 0) {
              let targetCore = state.cores.find((c: any) => ent.id && ent.id.includes(c.id));
              if (!targetCore) {
                let minD = Infinity;
                state.cores.forEach((c: any) => {
                  let sx = 0, sy = 0;
                  if (c.gridCoords && c.gridCoords.length > 0) {
                    c.gridCoords.forEach((pt: any) => { sx += pt.x; sy += pt.y; });
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
                if (targetCore.gridCoords && targetCore.gridCoords.length > 0) {
                  let sx = 0, sy = 0;
                  targetCore.gridCoords.forEach((pt: any) => { sx += pt.x; sy += pt.y; });
                  targetX = sx / targetCore.gridCoords.length + 0.5;
                  targetY = sy / targetCore.gridCoords.length + 0.5;
                } else {
                  targetX = targetCore.x + 0.5;
                  targetY = targetCore.y + 0.5;
                }
              }
            }
            const coreProj = project(targetX, targetY, zTerrain + 0.04);
            const angleDeg = (Math.atan2(coreProj.y - tcY, coreProj.x - tcX) * 180) / Math.PI;

            return (
              <g
                id={drawable.id}
                key={drawable.id}
                className={editMode !== 'view' && editMode !== 'delete_design' ? 'pointer-events-none' : 'cursor-pointer group'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellClick(ent.x, ent.y, e);
                }}
              >
                <polygon
                  points={pointsStr}
                  fill="url(#grey-hatch)"
                  stroke="#4B5563"
                  strokeWidth={1.2}
                />
                <g transform={`translate(${tcX}, ${tcY}) rotate(${angleDeg})`} className="pointer-events-none">
                  <path
                    d="M -7,-5 L 7,0 L -7,5 L -4,0 Z"
                    fill="#DC2626"
                    stroke="#FFFFFF"
                    strokeWidth={0.8}
                  />
                </g>
              </g>
            );
          }

          if (drawable.type === 'public_space') {
            const { ps, zTerrain } = drawable.data;
            const p00 = project(ps.x, ps.y, zTerrain + 0.04);
            const p10 = project(ps.x + 1, ps.y, zTerrain + 0.04);
            const p11 = project(ps.x + 1, ps.y + 1, zTerrain + 0.04);
            const p01 = project(ps.x, ps.y + 1, zTerrain + 0.04);
            const pointsStr = `${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`;
            const tcX = (p00.x + p11.x) / 2;
            const tcY = (p00.y + p11.y) / 2;

            return (
              <g
                id={drawable.id}
                key={drawable.id}
                className={editMode !== 'view' && editMode !== 'delete_design' ? 'pointer-events-none' : 'cursor-pointer group'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellClick(ps.x, ps.y, e);
                }}
              >
                <polygon
                  points={pointsStr}
                  fill="url(#public-plaza)"
                  stroke="#595533"
                  strokeWidth={1.2}
                />
                <g transform={`translate(${tcX}, ${tcY})`} className="pointer-events-none">
                  <text textAnchor="middle" y={4.5} fill="#3A3821" fontSize="13" fontWeight="900" fontFamily="sans-serif">H</text>
                </g>
              </g>
            );
          }

          if (drawable.type === 'green_space') {
            const { pt, tier, zTerrain } = drawable.data;
            const p00 = project(pt.x, pt.y, zTerrain + 0.035);
            const p10 = project(pt.x + 1, pt.y, zTerrain + 0.035);
            const p11 = project(pt.x + 1, pt.y + 1, zTerrain + 0.035);
            const p01 = project(pt.x, pt.y + 1, zTerrain + 0.035);
            const pointsStr = `${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`;

            const isTier1 = tier === 1;
            // Tier 1: Cluster Perimeter Buffer (Same color as courtyards/میان‌سراها: #BFC9A2)
            // Tier 2: Shared Inter-Cluster Park (Ground/Terrain Color)
            const fillColor = isTier1 ? '#BFC9A2' : '#EDE5D9';
            const strokeColor = isTier1 ? '#8D9B6A' : 'rgba(45, 41, 38, 0.05)';

            return (
              <g key={drawable.id} id={drawable.id}>
                <polygon
                  points={pointsStr}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isTier1 ? 0.8 : 0.5}
                  strokeDasharray={isTier1 ? "3 1.5" : undefined}
                />
              </g>
            );
          }

          if (drawable.type === 'path-segment') {
            const { ptA, ptB, zA, zB, pathType } = drawable.data;
            // Project centerline of segment
            const pA = project(ptA.x + 0.5, ptA.y + 0.5, zA + 0.06);
            const pB = project(ptB.x + 0.5, ptB.y + 0.5, zB + 0.06);

            const isPrimary = pathType === 'primary';
            const isSecondary = pathType === 'secondary';

            let strokeColor = '#f87171'; // pedestrian (soft red trail)
            let sWidth = 1.2;
            let isDashed = "2.5 2.5";

            if (isPrimary) {
              strokeColor = '#eab308'; // Infrastructure yellow spinal
              sWidth = 3.5;
              isDashed = "";
            } else if (isSecondary) {
              strokeColor = '#475569'; // Secondary gray street
              sWidth = 2.0;
              isDashed = "4 2";
            }

            return (
              <line
                id={drawable.id}
                key={drawable.id}
                x1={pA.x}
                y1={pA.y}
                x2={pB.x}
                y2={pB.y}
                stroke={strokeColor}
                strokeWidth={sWidth}
                strokeLinecap="round"
                strokeDasharray={isDashed || undefined}
                opacity={isBoundaryEdit ? dimOpacity : 0.88}
                className="pointer-events-none"
              />
            );
          }

          if (drawable.type === 'core') {
            const { core, baseZ, sizeZ, isSelected } = drawable.data;
            let minCoreX = 999, maxCoreX = -999, minCoreY = 999, maxCoreY = -999;
            core.gridCoords.forEach((c: any) => {
              if (c.x < minCoreX) minCoreX = c.x;
              if (c.x > maxCoreX) maxCoreX = c.x;
              if (c.y < minCoreY) minCoreY = c.y;
              if (c.y > maxCoreY) maxCoreY = c.y;
            });
            const sizeX = maxCoreX - minCoreX + 1;
            const sizeY = maxCoreY - minCoreY + 1;
            const isMini = core.type === 'mini';

            if (viewMode.startsWith('elev_')) {
              // 2D Elevation true flat projection
              let pL, pBR, pTR, pTL;
              if (viewMode === 'elev_n' || viewMode === 'elev_s') {
                pL = project(core.x, core.y, baseZ);
                pBR = project(core.x + sizeX, core.y, baseZ);
                pTR = project(core.x + sizeX, core.y, baseZ + sizeZ);
                pTL = project(core.x, core.y, baseZ + sizeZ);
              } else {
                pL = project(core.x, core.y, baseZ);
                pBR = project(core.x, core.y + sizeY, baseZ);
                pTR = project(core.x, core.y + sizeY, baseZ + sizeZ);
                pTL = project(core.x, core.y, baseZ + sizeZ);
              }

              const pointsStr = `${pL.x},${pL.y} ${pBR.x},${pBR.y} ${pTR.x},${pTR.y} ${pTL.x},${pTL.y}`;

              return (
                <g
                  id={drawable.id}
                  key={drawable.id}
                  className={editMode !== 'view' ? 'pointer-events-none' : 'cursor-pointer'}
                  opacity={dimOpacity}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCore(isSelected ? null : core.id);
                    onSelectUnit(null);
                  }}
                >
                  {/* Main tower block */}
                  <polygon
                    points={pointsStr}
                    fill={isMini ? '#2B394A' : '#1F2A38'}
                    stroke={isSelected ? '#E65100' : '#475569'}
                    strokeWidth={isSelected ? 2.5 : 1.2}
                  />
                  {/* Vertical metal truss lines to look industrial / high-tech */}
                  <line
                    x1={(pL.x + pBR.x)/2}
                    y1={pL.y}
                    x2={(pTL.x + pTR.x)/2}
                    y2={pTL.y}
                    stroke="#E65100"
                    strokeWidth={0.8}
                    strokeDasharray="3 3.5"
                    opacity={0.8}
                  />
                  
                  {/* Clean vertical label identifying the core */}
                  <text
                    x={(pL.x + pBR.x)/2}
                    y={pTL.y - 7}
                    textAnchor="middle"
                    fill="#1F2A38"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="Vazirmatn"
                  >
                    {isMini ? 'رایزر فرعی' : 'داکت متمرکز'}
                  </text>
                </g>
              );
            }

            // Project 8 vertices of towering Core box
            const p000 = project(core.x, core.y, baseZ);
            const p100 = project(core.x + sizeX, core.y, baseZ);
            const p110 = project(core.x + sizeX, core.y + sizeY, baseZ);
            const p010 = project(core.x, core.y + sizeY, baseZ);

            const p001 = project(core.x, core.y, baseZ + sizeZ);
            const p101 = project(core.x + sizeX, core.y, baseZ + sizeZ);
            const p111 = project(core.x + sizeX, core.y + sizeY, baseZ + sizeZ);
            const p011 = project(core.x, core.y + sizeY, baseZ + sizeZ);

            return (
              <g
                id={drawable.id}
                key={drawable.id}
                className={editMode !== 'view' ? 'pointer-events-none' : 'cursor-pointer'}
                opacity={dimOpacity}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCore(isSelected ? null : core.id);
                  onSelectUnit(null);
                }}
              >
                {viewMode === '2d' ? (
                  /* 2D Plan View Core decoration */
                  <g>
                    <polygon
                      points={`${p001.x},${p001.y} ${p101.x},${p101.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`}
                      fill={isMini ? '#2B394A' : '#1F2A38'}
                      stroke={isSelected ? '#E65100' : '#475569'}
                      strokeWidth={1.2}
                    />
                    <g opacity={0.7} className="pointer-events-none">
                      <line x1={p001.x} y1={p001.y} x2={p111.x} y2={p111.y} stroke="#475569" strokeWidth={0.8} />
                      {(() => {
                        const treads = [];
                        const steps = 5;
                        for (let k = 1; k < steps; k++) {
                          const f = k / steps;
                          const xStart = p001.x + (p011.x - p001.x) * f;
                          const yStart = p001.y + (p011.y - p001.y) * f;
                          const xEnd = p001.x + (p111.x - p001.x) * f;
                          const yEnd = p001.y + (p111.y - p001.y) * f;
                          treads.push(
                            <line
                              key={`tread-${k}`}
                              x1={xStart}
                              y1={yStart}
                              x2={xEnd}
                              y2={yEnd}
                              stroke="#ffffff"
                              strokeWidth={0.6}
                              opacity={0.7}
                            />
                          );
                        }
                        return treads;
                      })()}
                      <path
                        d={`M ${(p001.x + p111.x)/2 - 2} ${(p001.y + p111.y)/2 + 2} L ${(p001.x + p111.x)/2 + 3} ${(p001.y + p111.y)/2 - 3} M ${(p001.x + p111.x)/2 + 1} ${(p001.y + p111.y)/2 - 3} L ${(p001.x + p111.x)/2 + 3} ${(p001.y + p111.y)/2 - 3} L ${(p001.x + p111.x)/2 + 3} ${(p001.y + p111.y)/2 - 1}`}
                        fill="none"
                        stroke="#FF9E00"
                        strokeWidth={1}
                      />
                    </g>
                  </g>
                ) : (
                  /* 3D Dynamic Painter's-Sorted core rendering */
                  (() => {
                    const coreFaces = [
                      {
                        id: 'top',
                        points: `${p001.x},${p001.y} ${p101.x},${p101.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`,
                        depth: getDepth(core.x + sizeX / 2, core.y + sizeY / 2, baseZ + sizeZ),
                        fill: isMini ? '#2B394A' : '#1F2A38',
                        stroke: isSelected ? '#E65100' : '#475569',
                        strokeWidth: 0.8
                      },
                      {
                        id: 'sw',
                        points: `${p010.x},${p010.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`,
                        depth: getDepth(core.x + sizeX / 2, core.y + sizeY, baseZ + sizeZ / 2),
                        fill: '#182230',
                        stroke: isSelected ? '#E65100' : '#2A3445',
                        strokeWidth: 0.8
                      },
                      {
                        id: 'se',
                        points: `${p100.x},${p100.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p101.x},${p101.y}`,
                        depth: getDepth(core.x + sizeX, core.y + sizeY / 2, baseZ + sizeZ / 2),
                        fill: '#101824',
                        stroke: isSelected ? '#E65100' : '#212936',
                        strokeWidth: 0.8
                      },
                      {
                        id: 'nw',
                        points: `${p000.x},${p000.y} ${p010.x},${p010.y} ${p011.x},${p011.y} ${p001.x},${p001.y}`,
                        depth: getDepth(core.x, core.y + sizeY / 2, baseZ + sizeZ / 2),
                        fill: '#243242',
                        stroke: isSelected ? '#E65100' : '#192534',
                        strokeWidth: 0.8
                      },
                      {
                        id: 'ne',
                        points: `${p000.x},${p000.y} ${p100.x},${p100.y} ${p101.x},${p101.y} ${p001.x},${p001.y}`,
                        depth: getDepth(core.x + sizeX / 2, core.y, baseZ + sizeZ / 2),
                        fill: '#1B2636',
                        stroke: isSelected ? '#E65100' : '#1F2C3F',
                        strokeWidth: 0.8
                      }
                    ];

                    // Sort back to front
                    coreFaces.sort((a, b) => a.depth - b.depth);

                    return (
                      <g>
                        {coreFaces.map(face => (
                          <g key={face.id}>
                            <polygon
                              points={face.points}
                              fill={face.fill}
                              stroke={face.stroke}
                              strokeWidth={face.strokeWidth}
                            />
                            
                            {/* Render staircase treads inside the sw face if sw face is being drawn */}
                            {face.id === 'sw' && (() => {
                              const stepLines = [];
                              const stepsCount = Math.max(5, Math.floor(sizeZ * 3.5));
                              for (let i = 1; i < stepsCount; i++) {
                                const fract = i / stepsCount;
                                const xStart = p010.x + (p011.x - p010.x) * fract;
                                const yStart = p010.y + (p011.y - p010.y) * fract;
                                const xEnd = p110.x + (p111.x - p110.x) * fract;
                                const yEnd = p110.y + (p111.y - p110.y) * fract;
                                stepLines.push(
                                  <line
                                    key={`step-line-${i}`}
                                    x1={xStart + (xEnd - xStart) * 0.15}
                                    y1={yStart + (yEnd - yStart) * 0.15}
                                    x2={xStart + (xEnd - xStart) * 0.85}
                                    y2={yStart + (yEnd - yStart) * 0.15}
                                    stroke="#FFB07C"
                                    strokeWidth={0.7}
                                    opacity={0.5}
                                  />
                                );
                              }
                              return stepLines;
                            })()}

                            {/* Render core top gear indicator if top face is being drawn */}
                            {face.id === 'top' && !isMini && (
                              <circle
                                cx={(p001.x + p111.x)/2}
                                cy={(p001.y + p111.y)/2}
                                r={6}
                                fill="none"
                                stroke="#E65100"
                                strokeWidth={1.5}
                              />
                            )}

                            {/* Draw structural corner rods if sw or se are active */}
                            {(face.id === 'sw' || face.id === 'se') && (
                              <line
                                x1={p110.x}
                                y1={p110.y}
                                x2={p111.x}
                                y2={p111.y}
                                stroke="#E65100"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                              />
                            )}
                          </g>
                        ))}
                      </g>
                    );
                  })()
                )}
              </g>
            );
          }

          if (drawable.type === 'unit-shadow') {
            const { minX, minY, w, h, baseZ } = drawable.data;
            if (viewMode === '2d' || viewMode.startsWith('elev_')) {
              return null; // shadows only rendered in 3D perspective
            }

            // We offset the shadow slightly to represent the sun's direction
            // The sun comes from North-East/East, so shadow projects to South-West/West:
            const offset = 0.16;
            const s00 = project(minX + offset, minY + offset, baseZ + 0.01);
            const s10 = project(minX + w + offset, minY + offset, baseZ + 0.01);
            const s11 = project(minX + w + offset, minY + h + offset, baseZ + 0.01);
            const s01 = project(minX + offset, minY + h + offset, baseZ + 0.01);

            const pointsStr = `${s00.x},${s00.y} ${s10.x},${s10.y} ${s11.x},${s11.y} ${s01.x},${s01.y}`;

            return (
              <polygon
                key={drawable.id}
                id={drawable.id}
                points={pointsStr}
                fill="rgba(40, 36, 32, 0.22)"
                filter="url(#shadow-blur)"
                pointerEvents="none"
              />
            );
          }

          if (drawable.type === 'unit') {
            const { unit, minX, minY, w, h, baseZ, isSelected } = drawable.data;

            const isYard = unit.color === '#BFC9A2';

            if (viewMode.startsWith('elev_')) {
              if (isYard) {
                // In elevation view, a yard is a flat horizontal line or extremely thin rectangle on its base level
                let pL_y, pBR_y;
                if (viewMode === 'elev_n' || viewMode === 'elev_s') {
                  pL_y = project(minX, minY, baseZ);
                  pBR_y = project(minX + w, minY, baseZ);
                } else {
                  pL_y = project(minX, minY, baseZ);
                  pBR_y = project(minX, minY + h, baseZ);
                }
                return (
                  <line
                    id={drawable.id}
                    key={drawable.id}
                    x1={pL_y.x}
                    y1={pL_y.y}
                    x2={pBR_y.x}
                    y2={pBR_y.y}
                    stroke={isSelected ? '#E65100' : '#8D9B6A'}
                    strokeWidth={isSelected ? 4.5 : 2.5}
                    className={editMode !== 'view' ? 'pointer-events-none' : 'cursor-pointer'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectUnit(isSelected ? null : unit.id);
                      onSelectCore(null);
                    }}
                  />
                );
              }

              const isEntrance = unit.color === '#8b5cf6';

              // 2D Elevation true flat projection for unit containers!
              let pL, pBR, pTR, pTL;
              if (viewMode === 'elev_n' || viewMode === 'elev_s') {
                pL = project(minX, minY, baseZ);
                pBR = project(minX + w, minY, baseZ);
                pTR = project(minX + w, minY, baseZ + 1.0);
                pTL = project(minX, minY, baseZ + 1.0);
              } else {
                pL = project(minX, minY, baseZ);
                pBR = project(minX, minY + h, baseZ);
                pTR = project(minX, minY + h, baseZ + 1.0);
                pTL = project(minX, minY, baseZ + 1.0);
              }

              const pointsStr = `${pL.x},${pL.y} ${pBR.x},${pBR.y} ${pTR.x},${pTR.y} ${pTL.x},${pTL.y}`;

              if (isEntrance) {
                const tcX = (pL.x + pBR.x) / 2;
                const tcY = (pL.y + pTL.y) / 2;

                let targetX = minX + w / 2;
                let targetY = minY + h / 2;
                if (state.cores && state.cores.length > 0) {
                  let targetCore = state.cores.find((c: any) => unit.id && unit.id.includes(c.id));
                  if (!targetCore) {
                    let minD = Infinity;
                    state.cores.forEach((c: any) => {
                      let sx = 0, sy = 0;
                      if (c.gridCoords && c.gridCoords.length > 0) {
                        c.gridCoords.forEach((pt: any) => { sx += pt.x; sy += pt.y; });
                        sx = sx / c.gridCoords.length + 0.5;
                        sy = sy / c.gridCoords.length + 0.5;
                      } else {
                        sx = c.x + 0.5;
                        sy = c.y + 0.5;
                      }
                      const d = Math.hypot(sx - (minX + 0.5), sy - (minY + 0.5));
                      if (d < minD) { minD = d; targetCore = c; }
                    });
                  }
                  if (targetCore) {
                    if (targetCore.gridCoords && targetCore.gridCoords.length > 0) {
                      let sx = 0, sy = 0;
                      targetCore.gridCoords.forEach((pt: any) => { sx += pt.x; sy += pt.y; });
                      targetX = sx / targetCore.gridCoords.length + 0.5;
                      targetY = sy / targetCore.gridCoords.length + 0.5;
                    } else {
                      targetX = targetCore.x + 0.5;
                      targetY = targetCore.y + 0.5;
                    }
                  }
                }
                const zTerrain = terrainZ[`${Math.floor(minX)},${Math.floor(minY)}`] || 0;
                const coreProj = project(targetX, targetY, zTerrain + 0.04);
                const angleDeg = (Math.atan2(coreProj.y - tcY, coreProj.x - tcX) * 180) / Math.PI;

                return (
                  <g
                    id={drawable.id}
                    key={drawable.id}
                    className={editMode !== 'view' ? 'pointer-events-none' : 'cursor-pointer group'}
                    opacity={dimOpacity}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectUnit(isSelected ? null : unit.id);
                      onSelectCore(null);
                    }}
                  >
                    <polygon
                      points={pointsStr}
                      fill="url(#grey-hatch)"
                      stroke={isSelected ? '#E65100' : '#4B5563'}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                    />
                    <g transform={`translate(${tcX}, ${tcY}) rotate(${angleDeg})`} className="pointer-events-none">
                      <path
                        d="M -7,-5 L 7,0 L -7,5 L -4,0 Z"
                        fill="#DC2626"
                        stroke="#FFFFFF"
                        strokeWidth={0.8}
                      />
                    </g>
                  </g>
                );
              }
              
              // Draw container corrugated ribs
              const drawRibs = [];
              const ribCount = 6;
              for (let r = 1; r < ribCount; r++) {
                const fract = r / ribCount;
                const rx = pL.x + (pBR.x - pL.x) * fract;
                drawRibs.push(
                  <line
                    key={`rib-${r}`}
                    x1={rx}
                    y1={pL.y}
                    x2={rx}
                    y2={pTL.y}
                    stroke="rgba(0,0,0,0.18)"
                    strokeWidth={0.8}
                  />
                );
              }

              return (
                <g
                  id={drawable.id}
                  key={drawable.id}
                  className={editMode !== 'view' ? 'pointer-events-none' : 'cursor-pointer group'}
                  opacity={dimOpacity}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUnit(isSelected ? null : unit.id);
                    onSelectCore(null);
                  }}
                >
                  <polygon
                    points={pointsStr}
                    fill={unit.color}
                    fillOpacity={containerOpacity}
                    stroke={isSelected ? '#E65100' : '#ffffff'}
                    strokeWidth={isSelected ? 2.2 : 0.8}
                  />
                  {drawRibs}
                  
                  {/* Subtle 2D door / window frame graphic in center */}
                  <rect
                    x={(pL.x + pBR.x)/2 - 5}
                    y={(pL.y + pTL.y)/2 - 4}
                    width={10}
                    height={8}
                    fill={isSelected ? '#FFCC80' : '#E0E7FF'}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={0.6}
                  />
                </g>
              );
            }

            // Project 8 vertices of unit box (1 unit height coefficient = 1 level)
            const p000 = project(minX, minY, baseZ);
            const p100 = project(minX + w, minY, baseZ);
            const p110 = project(minX + w, minY + h, baseZ);
            const p010 = project(minX, minY + h, baseZ);

            const p001 = project(minX, minY, baseZ + 1.0);
            const p101 = project(minX + w, minY, baseZ + 1.0);
            const p111 = project(minX + w, minY + h, baseZ + 1.0);
            const p011 = project(minX, minY + h, baseZ + 1.0);

            // Shaded Colors based on unit types
            const colorTop = unit.color;
            const isEntrance = unit.color === '#8b5cf6';
            
            return (
              <g
                id={drawable.id}
                key={drawable.id}
                className={editMode !== 'view' ? 'pointer-events-none' : 'cursor-pointer group'}
                opacity={dimOpacity}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectUnit(isSelected ? null : unit.id);
                  onSelectCore(null);
                }}
              >
                {isEntrance ? (
                  /* 2D / 3D Flat Entrance render with grey hatching and red arrow pointing toward core */
                  (() => {
                    const tcX = (p000.x + p110.x) / 2;
                    const tcY = (p000.y + p110.y) / 2;
                    let targetX = minX + w / 2;
                    let targetY = minY + h / 2;
                    if (state.cores && state.cores.length > 0) {
                      let targetCore = state.cores.find((c: any) => unit.id && unit.id.includes(c.id));
                      if (!targetCore) {
                        let minD = Infinity;
                        state.cores.forEach((c: any) => {
                          let sx = 0, sy = 0;
                          if (c.gridCoords && c.gridCoords.length > 0) {
                            c.gridCoords.forEach((pt: any) => { sx += pt.x; sy += pt.y; });
                            sx = sx / c.gridCoords.length + 0.5;
                            sy = sy / c.gridCoords.length + 0.5;
                          } else {
                            sx = c.x + 0.5;
                            sy = c.y + 0.5;
                          }
                          const d = Math.hypot(sx - (minX + 0.5), sy - (minY + 0.5));
                          if (d < minD) { minD = d; targetCore = c; }
                        });
                      }
                      if (targetCore) {
                        if (targetCore.gridCoords && targetCore.gridCoords.length > 0) {
                          let sx = 0, sy = 0;
                          targetCore.gridCoords.forEach((pt: any) => { sx += pt.x; sy += pt.y; });
                          targetX = sx / targetCore.gridCoords.length + 0.5;
                          targetY = sy / targetCore.gridCoords.length + 0.5;
                        } else {
                          targetX = targetCore.x + 0.5;
                          targetY = targetCore.y + 0.5;
                        }
                      }
                    }
                    const zTerrain = terrainZ[`${Math.floor(minX)},${Math.floor(minY)}`] || 0;
                    const coreProj = project(targetX, targetY, zTerrain + 0.04);
                    const angleDeg = (Math.atan2(coreProj.y - tcY, coreProj.x - tcX) * 180) / Math.PI;

                    return (
                      <g>
                        <polygon
                          points={`${p000.x},${p000.y} ${p100.x},${p100.y} ${p110.x},${p110.y} ${p010.x},${p010.y}`}
                          fill="url(#grey-hatch)"
                          stroke={isSelected ? '#E65100' : '#4B5563'}
                          strokeWidth={isSelected ? 2.5 : 1.2}
                        />
                        <g transform={`translate(${tcX}, ${tcY}) rotate(${angleDeg})`} className="pointer-events-none">
                          <path
                            d="M -7,-5 L 7,0 L -7,5 L -4,0 Z"
                            fill="#DC2626"
                            stroke="#FFFFFF"
                            strokeWidth={0.8}
                          />
                        </g>
                      </g>
                    );
                  })()
                ) : isYard ? (
                  /* 2D / 3D Flat Courtyard/Yard render */
                  <g>
                    <polygon
                      points={`${p000.x},${p000.y} ${p100.x},${p100.y} ${p110.x},${p110.y} ${p010.x},${p010.y}`}
                      fill="#BFC9A2" // Architectural Grass Lawn
                      stroke={isSelected ? '#E65100' : '#8D9B6A'}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                    />
                    {/* Add a tiny beautiful green tree/plant in center */}
                    <g transform={`translate(${(p000.x + p110.x)/2}, ${(p000.y + p110.y)/2})`} opacity={0.85} className="pointer-events-none">
                      <circle r={3.5} fill="#556B2F" opacity={0.65} />
                      <circle r={1.8} fill="#8FBC8F" />
                    </g>
                  </g>
                ) : (
                  /* 3D Box faces model with corrugated shadow adjustments based on Painter's algorithm */
                  (() => {
                    const faces = [
                      {
                        id: 'top',
                        points: `${p001.x},${p001.y} ${p101.x},${p101.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`,
                        depth: getDepth(minX + w/2, minY + h/2, baseZ + 1.0),
                        brightness: 'brightness(1.02)',
                        strokeWidth: 0.6
                      },
                      {
                        id: 'sw',
                        points: `${p010.x},${p010.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`,
                        depth: getDepth(minX + w/2, minY + h, baseZ + 0.5),
                        brightness: 'brightness(0.54)',
                        strokeWidth: 0.5
                      },
                      {
                        id: 'se',
                        points: `${p100.x},${p100.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p101.x},${p101.y}`,
                        depth: getDepth(minX + w, minY + h/2, baseZ + 0.5),
                        brightness: 'brightness(0.82)',
                        strokeWidth: 0.5
                      },
                      {
                        id: 'nw',
                        points: `${p000.x},${p000.y} ${p010.x},${p010.y} ${p011.x},${p011.y} ${p001.x},${p001.y}`,
                        depth: getDepth(minX, minY + h/2, baseZ + 0.5),
                        brightness: 'brightness(0.66)',
                        strokeWidth: 0.5
                      },
                      {
                        id: 'ne',
                        points: `${p000.x},${p000.y} ${p100.x},${p100.y} ${p101.x},${p101.y} ${p001.x},${p001.y}`,
                        depth: getDepth(minX + w/2, minY, baseZ + 0.5),
                        brightness: 'brightness(0.92)',
                        strokeWidth: 0.5
                      }
                    ];

                    // Sort back to front
                    faces.sort((a, b) => a.depth - b.depth);

                    return (
                      <g>
                        {faces.map(face => (
                          <polygon
                            key={face.id}
                            points={face.points}
                            fill={colorTop}
                            fillOpacity={containerOpacity}
                            filter={face.brightness}
                            stroke={isSelected ? '#211D1A' : '#FDFCFB'}
                            strokeWidth={face.strokeWidth}
                          />
                        ))}
                      </g>
                    );
                  })()
                )}

                {/* Stack heights markings if level is elevated (+1, +2 badges) */}
                {unit.level > 0 && viewMode === '2d' && (
                  <g transform={`translate(${(p001.x + p111.x)/2}, ${(p001.y + p111.y)/2})`}>
                    <circle r={7} fill="#2D2926" />
                    <text textAnchor="middle" y={3} fill="#fff" fontSize="8" fontWeight="bold">+{unit.level}</text>
                  </g>
                )}

                {/* Highlight pulsing rings in 3D */}
                {isSelected && (
                  <>
                    <polygon
                      points={`${p001.x},${p001.y} ${p101.x},${p101.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`}
                      fill="none"
                      stroke="#E65100"
                      strokeWidth={2.0}
                      className="animate-pulse"
                    />
                    <polygon
                      points={`${p110.x},${p110.y} ${p111.x},${p111.y}`}
                      stroke="#E65100"
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </g>
            );
          }

          return null;
        })}

        {/* Render Current Boundary Line (Draft or Real depending on editMode) */}
        {(() => {
          const activeBoundaryPoints = editMode === 'boundary' ? draftBoundaryPoints : (params?.customBoundaryPoints || []);
          if (activeBoundaryPoints.length < 2) return null;
          
          if (editMode !== 'boundary') {
            // Elegant, high-contrast, professional site boundary line
            const pointsStr = activeBoundaryPoints.map(pt => {
              const zVal = terrainZ[`${pt.x},${pt.y}`] || 0;
              const p = project(pt.x + 0.5, pt.y + 0.5, zVal + 0.05);
              return `${p.x},${p.y}`;
            }).join(' ');
            return (
              <g>
                {/* Underlay for contrast */}
                <polygon
                  points={pointsStr}
                  fill="none"
                  stroke="#F7F5F2"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.8}
                />
                {/* Thick boundary stroke */}
                <polygon
                  points={pointsStr}
                  fill="none"
                  stroke="#E65100" // elegant terra cotta / orange boundary line
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 4"
                  opacity={0.9}
                />
              </g>
            );
          }

          return (
            <>
              {/* Semi-transparent red area fill when closed (3+ points) */}
              {activeBoundaryPoints.length >= 3 && (
                <polygon
                  points={activeBoundaryPoints.map(pt => {
                    const zVal = terrainZ[`${pt.x},${pt.y}`] || 0;
                    const p = project(pt.x + 0.5, pt.y + 0.5, zVal + 0.12);
                    return `${p.x},${p.y}`;
                  }).join(' ')}
                  fill="rgba(239, 68, 68, 0.14)"
                  stroke="none"
                />
              )}
              {/* Thick soft boundary line underlay */}
              <polygon
                points={activeBoundaryPoints.map(pt => {
                  const zVal = terrainZ[`${pt.x},${pt.y}`] || 0;
                  const p = project(pt.x + 0.5, pt.y + 0.5, zVal + 0.12);
                  return `${p.x},${p.y}`;
                }).join(' ')}
                fill="none"
                stroke="#DC2626"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.35}
              />
              {/* Sharp dashed boundary line overlay */}
              <polygon
                points={activeBoundaryPoints.map(pt => {
                  const zVal = terrainZ[`${pt.x},${pt.y}`] || 0;
                  const p = project(pt.x + 0.5, pt.y + 0.5, zVal + 0.12);
                  return `${p.x},${p.y}`;
                }).join(' ')}
                fill="none"
                stroke="#EF4444"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 4"
                opacity={1.0}
              />
              {/* Vertices indicator pins and Site Boundary Tag */}
              {activeBoundaryPoints.map((pt, i) => {
                const zVal = terrainZ[`${pt.x},${pt.y}`] || 0;
                const p = project(pt.x + 0.5, pt.y + 0.5, zVal + 0.15);
                return (
                  <g key={`bound-dot-${i}`} className="pointer-events-none">
                    <circle cx={p.x} cy={p.y} r={9} fill="#DC2626" stroke="#ffffff" strokeWidth={1.8} />
                    <text
                      x={p.x}
                      y={p.y + 3}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="black"
                      fill="#ffffff"
                      fontFamily="Vazirmatn"
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              {activeBoundaryPoints.length > 0 && (() => {
                const p1 = activeBoundaryPoints[0];
                const z1 = terrainZ[`${p1.x},${p1.y}`] || 0;
                const proj1 = project(p1.x + 0.5, p1.y + 0.5, z1 + 0.2);
                return (
                  <g transform={`translate(${proj1.x + 15}, ${proj1.y - 12})`} className="pointer-events-none">
                    <rect x="-45" y="-10" width="90" height="18" fill="#DC2626" rx="3" opacity="0.92" />
                    <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="Vazirmatn">
                      مرز تعیین‌شده زمین
                    </text>
                  </g>
                );
              })()}
            </>
          );
        })()}

        {/* 3D terrain directional slope arrow indicator */}
        {editMode === 'slope' && (() => {
          const activePoints = params.customBoundaryPoints || draftBoundaryPoints;
          if (activePoints.length === 0) return null;
          let sumX = 0, sumY = 0;
          activePoints.forEach(p => { sumX += p.x; sumY += p.y; });
          const cx = sumX / activePoints.length;
          const cy = sumY / activePoints.length;
          const cz = terrainZ[`${Math.floor(cx)},${Math.floor(cy)}`] || 0;

          // Vector length and offsets matching current direction selection
          let dx = 0;
          let dy = 0;
          const currentDir = params.terrainType;
          if (currentDir === 'sloped_n') { dx = 0; dy = -4.5; }
          else if (currentDir === 'sloped_s') { dx = 0; dy = 4.5; }
          else if (currentDir === 'sloped_e') { dx = 4.5; dy = 0; }
          else if (currentDir === 'sloped_w') { dx = -4.5; dy = 0; }
          else if (currentDir === 'sloped_ne') { dx = 3.2; dy = -3.2; }
          else if (currentDir === 'sloped_se') { dx = 3.2; dy = 3.2; }
          else if (currentDir === 'sloped_sw') { dx = -3.2; dy = 3.2; }
          else if (currentDir === 'sloped_nw') { dx = -3.2; dy = -3.2; }
          else { dx = 0; dy = 0; }

          if (dx === 0 && dy === 0) return null;

          const pStart = project(cx - dx, cy - dy, cz);
          const pEnd = project(cx + dx, cy + dy, cz + 1.2);
          
          return (
            <g className="pointer-events-none">
              <circle cx={pStart.x} cy={pStart.y} r={14} fill="rgba(230, 81, 0, 0.2)" stroke="#E65100" strokeWidth={1} strokeDasharray="3 3" className="animate-ping" />
              <circle cx={pStart.x} cy={pStart.y} r={6} fill="#E65100" stroke="#ffffff" strokeWidth={1.5} />
              
              <line 
                x1={pStart.x} y1={pStart.y} 
                x2={pEnd.x} y2={pEnd.y} 
                stroke="#E65100" 
                strokeWidth={5} 
                strokeLinecap="round" 
              />
              <line 
                x1={pStart.x} y1={pStart.y} 
                x2={pEnd.x} y2={pEnd.y} 
                stroke="#FFD54F" 
                strokeWidth={2} 
                strokeLinecap="round" 
              />
              
              {(() => {
                const angle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
                const headLen = 15;
                const arrowPoint1X = pEnd.x - headLen * Math.cos(angle - Math.PI / 6);
                const arrowPoint1Y = pEnd.y - headLen * Math.sin(angle - Math.PI / 6);
                const arrowPoint2X = pEnd.x - headLen * Math.cos(angle + Math.PI / 6);
                const arrowPoint2Y = pEnd.y - headLen * Math.sin(angle + Math.PI / 6);
                
                return (
                  <polygon 
                    points={`${pEnd.x},${pEnd.y} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`} 
                    fill="#E65100" 
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                );
              })()}

              <g transform={`translate(${pEnd.x}, ${pEnd.y - 18})`}>
                <rect x={-45} y={-10} width={90} height={18} fill="#2D2926" rx={3} opacity={0.88} />
                <text textAnchor="middle" y={3} fill="#ffffff" fontSize="9.5" fontWeight="bold" fontFamily="Vazirmatn">جهت شیب زمین ↗</text>
              </g>
            </g>
          );
        })()}
      </svg>
      )}

      {/* CAD DRAFTING AND DRAWING TOOLS BAR (Top-Right overlay) */}
      {!isComparePane && (
        <div className="absolute top-16 right-4 z-20 flex flex-col gap-2 bg-[#FDFCFB]/95 backdrop-blur-md p-3 border border-[#D9D4CF] shadow-xs select-none canvas-control-overlay rounded transition-all duration-200" dir="rtl">
          <div className="flex items-center justify-between gap-6 pb-1.5 border-b border-[#D9D4CF] cursor-pointer" onClick={() => setIsDrawingToolsExpanded(!isDrawingToolsExpanded)}>
            <div className="flex items-center gap-2">
              <Hammer size={13} className="text-[#E65100]" />
              <span className="text-[11px] font-bold text-[#2D2926]">طراحی زمین</span>
            </div>
            <button className="text-[#8B8378] hover:text-[#E65100] transition pr-1">
              {isDrawingToolsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {isDrawingToolsExpanded && (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setEditMode('view')}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'view'
                    ? 'bg-[#2D2926] text-white border-[#2D2926]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                <Eye size={12} />
                <span>حرکت و مشاهده آزاد (View)</span>
              </button>

              <button
                onClick={() => {
                  setEditMode('boundary');
                  if (onChangeParams && params.siteShape !== 'custom_boundary') {
                    onChangeParams({ ...params, siteShape: 'custom_boundary' });
                  }
                }}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'boundary'
                    ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
                title="با کلیک روی سلول‌های زمین، گوشه‌های محدوده را ترسیم کنید."
              >
                <GitCommit size={12} className="text-[#DC2626]" />
                <span>ترسیم محدوده زمین با لاین</span>
              </button>

              <button
                onClick={() => setEditMode('obstacle')}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'obstacle'
                    ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
                title="با کلیک روی زمین، نقاط مانع غیرقابل‌ساخت تعریف کنید."
              >
                <span className="text-[#D97706] font-bold text-[12px]">✕</span>
                <span>مشخص کردن مانع در زمین</span>
              </button>

              <button
                onClick={() => setEditMode('yard')}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'yard'
                    ? 'bg-emerald-600/10 text-emerald-700 border-emerald-600'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
                title="با کلیک روی سلول‌های خالی زمین، میانسرا (حیاط بومی) جدید ترسیم و تعریف کنید."
              >
                <Trees size={12} className="text-emerald-600" />
                <span>ترسیم و افزودن میانسرا (سبز)</span>
              </button>

              <button
                onClick={() => setEditMode('entrance_design')}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'entrance_design'
                    ? 'bg-slate-600/10 text-slate-700 border-slate-600'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
                title="با کلیک روی سلول‌های خالی زمین، ورودی محله جدید با بافت هاشور مشخص کنید."
              >
                <DoorOpen size={12} className="text-slate-600" />
                <span>ترسیم و افزودن ورودی (E)</span>
              </button>

              <button
                onClick={() => setEditMode('public_space_design')}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'public_space_design'
                    ? 'bg-[#595533]/10 text-[#595533] border-[#595533]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
                title="با کلیک روی سلول‌های خالی زمین، فضای عمومی با بافت هاشور زیتونی ایجاد کنید."
              >
                <Store size={12} className="text-[#595533]" />
                <span>ترسیم و افزودن فضای عمومی (H)</span>
              </button>

              <button
                onClick={() => setEditMode('delete_design')}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'delete_design'
                    ? 'bg-rose-600/10 text-rose-800 border-rose-600'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
                title="با کلیک روی فضاهای طراحی ورودی (E) یا عمومی (H)، آن‌ها را پاک کنید."
              >
                <Eraser size={12} className="text-rose-600" />
                <span>پاک‌کن فضاهای طراحی (حذف E و H)</span>
              </button>

              <div className="grid grid-cols-2 gap-1 mt-0.5">
                <button
                  type="button"
                  onClick={() => onClearEntrances && onClearEntrances()}
                  disabled={!(state.entrances && state.entrances.length > 0)}
                  className="py-1 px-1.5 text-[9px] font-bold border text-center transition bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF] disabled:opacity-40 disabled:pointer-events-none"
                  title="حذف کامل تمامی ورودی‌های ترسیم شده"
                >
                  حذف کل ورودی‌ها (E)
                </button>
                <button
                  type="button"
                  onClick={() => onClearPublicSpaces && onClearPublicSpaces()}
                  disabled={!(state.publicSpaces && state.publicSpaces.length > 0)}
                  className="py-1 px-1.5 text-[9px] font-bold border text-center transition bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF] disabled:opacity-40 disabled:pointer-events-none"
                  title="حذف کامل تمامی فضاهای عمومی ترسیم شده"
                >
                  حذف کل فضاهای عمومی (H)
                </button>
              </div>

              <button
                onClick={() => setEditMode('slope')}
                className={`w-full py-1 px-3 text-[10.5px] font-bold border transition flex items-center gap-2 ${
                  editMode === 'slope'
                    ? 'bg-amber-500/10 text-[#E65100]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
                title="تغییر جهت شیب و نوع توپوگرافی زمین"
              >
                <Compass size={12} className="text-[#E65100]" />
                <span>تنظیم توپوگرافی و شیب زمین</span>
              </button>

              {/* Land Boundary Shape Selection */}
              <div className="flex flex-col gap-1 mt-1.5 pt-2 border-t border-[#D9D4CF] text-right">
                <label className="font-bold text-[#2D2926] text-[10px] block">الگوی مرزگیری زمین مالکیتی:</label>
                <select
                  value={params.siteShape}
                  onChange={(e) => {
                    const selectedShape = e.target.value as any;
                    const w = params.siteWidth;
                    const nextHeight = selectedShape === 'irregular' ? Math.round(w * 0.7) : w;
                    if (onChangeParams) {
                      onChangeParams({
                        ...params,
                        siteShape: selectedShape,
                        siteHeight: nextHeight
                      });
                    }
                    if (selectedShape === 'custom_boundary') {
                      setEditMode('boundary');
                    } else {
                      setEditMode('view');
                    }
                  }}
                  className="w-full bg-white border border-[#D9D4CF] p-1 px-1.5 text-[10px] text-[#2D2926] outline-none rounded-none font-medium h-7.5 cursor-pointer"
                >
                  <option value="rectangular">بستر مربعی هموار (Boundary Square)</option>
                  <option value="irregular">بستر مستطیلی کشیده (Boundary Rectangular)</option>
                  <option value="skewed">زمین قناس و مورب (Skewed / Trapezius)</option>
                  <option value="custom_boundary">ترسیم چندضلعی دستی (قلم / انگشت)</option>
                </select>
              </div>

              <div className="flex gap-1 mt-1 pt-2.5 border-t border-[#D9D4CF]">
                <button
                  onClick={() => {
                    if (onChangeParams) {
                      onChangeParams({
                        ...params,
                        customBoundaryPoints: []
                      });
                    }
                  }}
                  className="flex-1 py-1 px-2 text-[9.5px] font-bold bg-red-50 hover:bg-red-100 text-[#DC2626] border border-[#FECACA] transition flex items-center justify-center gap-1"
                >
                  <Trash2 size={10} />
                  <span>حذف خطوط مرز</span>
                </button>

                <button
                  onClick={() => {
                    if (onChangeParams) {
                      onChangeParams({
                        ...params,
                        obstacles: []
                      });
                    }
                  }}
                  className="flex-1 py-1 px-2 text-[9.5px] font-bold bg-amber-50 hover:bg-amber-100 text-[#D97706] border border-[#FDE68A] transition flex items-center justify-center gap-1"
                >
                  <Trash2 size={10} />
                  <span>پاکسازی موانع</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editMode === 'boundary' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-[#FDFCFB]/95 backdrop-blur-md p-3 border border-red-200 shadow-md flex flex-col sm:flex-row items-center gap-3 rounded min-w-[280px] max-w-[480px]" dir="rtl">
          <div className="flex-1">
            <h4 className="text-[11.5px] font-bold text-red-700 flex items-center gap-1 mb-0.5">
              <Sparkles size={11} className="animate-spin text-[#E65100]" />
              <span>در حال طراحی مرز سفارشی زمین با ماوس</span>
            </h4>
            <p className="text-[10px] text-gray-600 leading-relaxed font-medium">
              با کلیک ماوس روی مربع‌های گرید، نقاط مرزی را به ترتیب دور زدن زمین رسم کنید (حداقل ۳ نقطه). نقاط را می‌توان مجدداً کلیک کرد تا حذف شوند.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (onChangeParams && draftBoundaryPoints.length >= 3) {
                  // Store the custom shape boundaries and initialize with default sloped direction
                  const initialSlope = params.terrainType.startsWith('sloped_') ? params.terrainType : 'sloped_s';
                  onChangeParams({
                    ...params,
                    siteShape: 'custom_boundary',
                    customBoundaryPoints: draftBoundaryPoints,
                    terrainType: initialSlope
                  });
                  setEditMode('slope');
                }
              }}
              disabled={draftBoundaryPoints.length < 3}
              className={`py-1 px-3.5 text-[10.5px] font-bold transition flex items-center gap-1 rounded-sm border ${
                draftBoundaryPoints.length >= 3
                  ? 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              تایید مرز و تعیین جهت شیب
            </button>
            <button
              onClick={() => {
                setEditMode('view');
                setDraftBoundaryPoints(params.customBoundaryPoints || []);
              }}
              className="py-1 px-3 text-[10.5px] font-bold bg-[#F7F5F2] hover:bg-[#EAE6DF] text-[#2D2926] border border-[#D9D4CF] transition rounded-sm cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {editMode === 'slope' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-[#FDFCFB]/95 backdrop-blur-md p-4 border border-amber-300 shadow-lg flex flex-col items-center gap-3.5 rounded-lg min-w-[340px] max-w-[460px] animate-fade-in" dir="rtl">
          <div className="w-full text-center">
            <h4 className="text-[12px] font-bold text-amber-800 flex items-center justify-center gap-1.5 mb-1">
              <Sparkles className="animate-pulse text-[#E65100]" size={12} />
              <span>انتخاب جهت شیب زمین (توپوگرافی)</span>
            </h4>
            <p className="text-[10px] text-gray-600 leading-relaxed font-medium">
              جهت شیب (پایین‌دست/سرازیر شدن) بستر طبیعی زمین را با کلیک روی نمادهای قطب‌نما تعیین کنید. کدهای ارتفاعی سه‌بعدی بلافاصله اعمال می‌شوند.
            </p>
          </div>

          {/* Compass grid selection layout */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] aspect-square items-center justify-center my-1 select-none">
            {/* NW */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_nw' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_nw'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">↖</span>
              <span className="text-[8px]">شمال‌غربی</span>
            </button>

            {/* N */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_n' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_n'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">↑</span>
              <span className="text-[8.5px]">شمال</span>
            </button>

            {/* NE */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_ne' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_ne'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">↗</span>
              <span className="text-[8px]">شمال‌شرقی</span>
            </button>

            {/* W */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_w' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_w'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">←</span>
              <span className="text-[8.5px]">غرب (چپ)</span>
            </button>

            {/* Compass Center - Flat Land Selection (زمین مسطح) */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'flat' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'flat'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
              }`}
              title="اراضی مسطح و هموار بدون شیب و ارتفاع فیزیکی"
            >
              <span className="text-[13px] mb-0.5">⚲</span>
              <span className="text-[8px] font-extrabold">زمین مسطح</span>
            </button>

            {/* E */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_e' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_e'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">→</span>
              <span className="text-[8.5px]">شرق (راست)</span>
            </button>

            {/* SW */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_sw' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_sw'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">↙</span>
              <span className="text-[8px]">جنوب‌غربی</span>
            </button>

            {/* S */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_s' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_s'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">↓</span>
              <span className="text-[8.5px]">جنوب (پایین)</span>
            </button>

            {/* SE */}
            <button
              onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'sloped_se' })}
              className={`p-2 border text-[11px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer ${
                params.terrainType === 'sloped_se'
                  ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                  : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
              }`}
            >
              <span className="text-[13px] mb-0.5">↘</span>
              <span className="text-[8px]">جنوب‌شرقی</span>
            </button>
          </div>

          {/* Special Landscape Topographies Section */}
          <div className="w-full border-t border-[#D9D4CF]/60 pt-2.5 flex flex-col gap-1.5 text-right">
            <span className="font-bold text-[#8B8378] text-[9.5px]">توپوگرافی‌های بستر ویژه ایران:</span>
            <div className="grid grid-cols-3 gap-1.5 w-full">
              {/* Terraced */}
              <button
                onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'terraced' })}
                className={`py-1.5 px-1 border text-[10px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer leading-tight ${
                  params.terrainType === 'terraced'
                    ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                    : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
                }`}
              >
                <span>🪜 سکوبندی</span>
                <span className="text-[7.5px] text-gray-500 mt-0.5 font-medium">پله‌پله فلات</span>
              </button>

              {/* Valley */}
              <button
                onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'valley' })}
                className={`py-1.5 px-1 border text-[10px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer leading-tight ${
                  params.terrainType === 'valley'
                    ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                    : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
                }`}
              >
                <span>⛰️ قعر دره</span>
                <span className="text-[7.5px] text-gray-500 mt-0.5 font-medium">خط گودی روان‌آب</span>
              </button>

              {/* Coastal */}
              <button
                onClick={() => onChangeParams && onChangeParams({ ...params, terrainType: 'coastal' })}
                className={`py-1.5 px-1 border text-[10px] font-bold flex flex-col items-center justify-center transition rounded-sm cursor-pointer leading-tight ${
                  params.terrainType === 'coastal'
                    ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm'
                    : 'bg-white hover:bg-[#F7F5F2] text-gray-700 border-[#D9D4CF]'
                }`}
              >
                <span>🌊 ساحلی</span>
                <span className="text-[7.5px] text-gray-500 mt-0.5 font-medium">مجاورت پهنه آبی</span>
              </button>
            </div>
          </div>

          <div className="w-full flex gap-2 border-t border-[#D9D4CF]/60 pt-3">
            <button
              onClick={() => {
                setEditMode('view');
              }}
              className="flex-1 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition rounded shadow-xs cursor-pointer text-center"
            >
              تایید نهایی شیب و شبیه‌سازی شهرک
            </button>
          </div>
        </div>
      )}

      {/* 2D / 3D AND 4-DIRECTION ELEVATIONS SELECTOR BAR */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2.5 bg-[#FDFCFB]/95 backdrop-blur-md p-3 border border-[#D9D4CF] shadow-sm select-none canvas-control-overlay rounded max-w-[325px] transition-all duration-200" dir="rtl">
        <div className="flex items-center justify-between gap-6 pb-2 border-b border-[#D9D4CF] cursor-pointer" onClick={() => setIsNavExpanded(!isNavExpanded)}>
          <div className="flex items-center gap-1.5 font-bold text-[#8B8378]">
            <Compass size={13} className="text-[#E65100]" />
            <span className="text-[11px] font-bold">ناوبری</span>
          </div>
          <button className="text-[#8B8378] hover:text-[#E65100] transition">
            {isNavExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
        
        {isNavExpanded && (
          <>
            {/* Toggle between standard, Three.js 3D, and elevations */}
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setViewMode('2d')}
                className={`py-1 px-1.5 text-[10px] font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                  viewMode === '2d'
                    ? 'bg-[#2D2926] text-white border-[#2D2926]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                <Layers size={11} />
                <span>پلان ۲بعدی</span>
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`py-1 px-1.5 text-[10px] font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                  viewMode === '3d'
                    ? 'bg-[#2D2926] text-white border-[#2D2926]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                <Compass size={11} />
                <span>آیزومتریک</span>
              </button>
              <button
                onClick={() => setViewMode('three3d')}
                className={`py-1 px-1.5 text-[10px] font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                  viewMode === 'three3d'
                    ? 'bg-[#E65100] text-white border-[#E65100]'
                    : 'bg-[#E65100]/10 hover:bg-[#E65100]/20 text-[#E65100] border-[#E65100]/40'
                }`}
                title="نمایش دید سه بعدی تعاملی با موتور Three.js و سایه‌پردازی واقعی"
              >
                <Sparkles size={11} />
                <span>رندر Three.js</span>
              </button>
              <button
                onClick={() => setViewMode('elev_n')}
                className={`py-1 px-1.5 text-[10px] font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                  viewMode === 'elev_n'
                    ? 'bg-[#E65100]/10 text-[#E65100] border-[#E65100]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                <span className="font-mono text-[9px] font-bold">N</span>
                <span>نمای شمالی</span>
              </button>
              <button
                onClick={() => setViewMode('elev_e')}
                className={`py-1 px-1.5 text-[10px] font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                  viewMode === 'elev_e'
                    ? 'bg-[#E65100]/10 text-[#E65100] border-[#E65100]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                <span className="font-mono text-[9px] font-bold">E</span>
                <span>نمای شرقی</span>
              </button>
              <button
                onClick={() => setViewMode('elev_s')}
                className={`py-1 px-1.5 text-[10px] font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                  viewMode === 'elev_s'
                    ? 'bg-[#E65100]/10 text-[#E65100] border-[#E65100]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                <span className="font-mono text-[9px] font-bold">S</span>
                <span>نمای جنوبی</span>
              </button>
              <button
                onClick={() => setViewMode('elev_w')}
                className={`py-1 px-1.5 text-[10px] font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                  viewMode === 'elev_w'
                    ? 'bg-[#E65100]/10 text-[#E65100] border-[#E65100]'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                <span className="font-mono text-[9px] font-bold">W</span>
                <span>نمای غربی</span>
              </button>
            </div>

            {/* If in 3D: let user switch drag mode between rotation and panning */}
            {viewMode === '3d' ? (
              <div className="flex gap-1">
                <button
                  onClick={() => setDragMode('rotate')}
                  className={`flex-1 py-1 px-1.5 text-[9px] font-bold border transition flex items-center justify-center gap-1 ${
                    dragMode === 'rotate'
                      ? 'bg-[#E65100]/15 text-[#E65100] border-[#E65100]'
                      : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                  }`}
                >
                  <RotateCcw size={10} className="scale-x-[-1]" />
                  <span>چرخش دوربین</span>
                </button>
                <button
                  onClick={() => setDragMode('pan')}
                  className={`flex-1 py-1 px-1.5 text-[9px] font-bold border transition flex items-center justify-center gap-1 ${
                    dragMode === 'pan'
                      ? 'bg-[#E65100]/15 text-[#E65100] border-[#E65100]'
                      : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                  }`}
                >
                  <Move size={10} />
                  <span>جابجایی سایت</span>
                </button>
              </div>
            ) : (
              <div className="text-[9px] text-[#4A443F] text-center bg-[#F7F5F2] p-1.5 border border-[#D9D4CF]">
                {viewMode === '2d' ? 'پلان دوبعدی بالا به پایین • کلیک و درگ برای پیمایش' : 'نمای ارتوگرافیک آکسونومتری با جهت فشرده'}
              </div>
            )}

            {/* Zoom In, Zoom Out, Reset Camera View buttons */}
            <div className="flex gap-1 mt-0.5 border-t border-[#D9D4CF] pt-2">
              <button
                onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
                className="flex-1 py-1 px-2 bg-white border border-[#D9D4CF] hover:bg-[#F7F5F2] transition text-[#2D2926] flex items-center justify-center gap-1"
                title="بزرگنمایی"
              >
                <ZoomIn size={11} />
                <span className="text-[10px]">زوم +</span>
              </button>
              <button
                onClick={() => setZoom(prev => Math.max(0.4, prev * 0.8))}
                className="flex-1 py-1 px-2 bg-white border border-[#D9D4CF] hover:bg-[#F7F5F2] transition text-[#2D2926] flex items-center justify-center gap-1"
                title="کوچکنمایی"
              >
                <ZoomOut size={11} />
                <span className="text-[10px]">زوم -</span>
              </button>
              <button
                onClick={resetViewport}
                className="flex-1 py-1 px-2 bg-white border border-[#D9D4CF] hover:bg-[#F7F5F2] transition text-[#E65100] flex items-center justify-center gap-1"
                title="بازنشانی دوربین"
              >
                <RotateCcw size={11} />
                <span className="text-[10px]">بازنشانی</span>
              </button>
            </div>

        {/* Floor Level Separation View Filters */}
        <div className="flex flex-col gap-1.5 pt-2.5 border-t border-[#D9D4CF]">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#2D2926]">
            <span className="flex items-center gap-1">
              <Layers size={11} className="text-[#E65100]" />
              <span>تفکیک تراز طبقات دیزاین:</span>
            </span>
            <span className="font-mono text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 border border-amber-200 rounded-xs">
              {selectedFloorFilter === 'all' ? 'همه طبقات' : selectedFloorFilter === 0 ? 'همکف (L0)' : selectedFloorFilter === 1 ? 'اول (L1)' : 'دوم (L2)'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {([
              { label: 'همه', value: 'all' },
              { label: 'همکف', value: 0 },
              { label: 'L1', value: 1 },
              { label: 'L2', value: 2 }
            ] as const).map(option => (
              <button
                key={`floor-btn-${option.value}`}
                onClick={() => setSelectedFloorFilter(option.value)}
                className={`py-1 text-[9.5px] font-black border transition rounded-xs cursor-pointer text-center ${
                  selectedFloorFilter === option.value
                    ? 'bg-[#E65100] text-white border-[#E65100] shadow-xs'
                    : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Container Hull Opacity Controller */}
        <div className="flex flex-col gap-1.5 pt-2.5 border-t border-[#D9D4CF]">
          <div className="flex justify-between items-center text-[10px] font-bold text-[#2D2926]">
            <span className="flex items-center gap-1">
              <Eye size={11} className="text-[#E65100]" />
              <span>شفافیت بدنه کانتینرها:</span>
            </span>
            <span className="font-mono text-[9.5px] bg-[#2D2926]/5 text-[#2D2926] px-1 py-0.5 rounded-sm font-bold">{Math.round(containerOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="1.00"
            step="0.05"
            value={containerOpacity}
            onChange={(e) => setContainerOpacity(parseFloat(e.target.value))}
            className="w-full h-1 bg-[#D9D4CF] rounded-lg appearance-none cursor-pointer accent-[#E65100]"
          />
          <span className="text-[7.5px] text-gray-500 text-right leading-relaxed font-medium">
            جهت مشاهده آسان هسته‌های تاسیساتی داخلی و مسیرهای زیرین، شفافیت را بکاهید.
          </span>
        </div>
          </>
        )}
      </div>

      {/* DRAG TIPS SUB-LABEL */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none bg-white/85 backdrop-blur-xs px-2.5 py-1 border border-[#D9D4CF] text-[10px] font-sans text-[#2D2926]" dir="rtl">
        {editMode !== 'view' ? (
          <span className="text-[#DC2626] font-bold">حالت ترسیم فعال: روی سلول‌های اراضی کلیک کنید.</span>
        ) : viewMode === '3d' ? (
          'درگ موس: چرخش دید • غلطک موس: زوم • جابجایی سایت با Pan' 
        ) : (
          'درگ موس: جابجایی نقشه • غلطک موس: بزرگنمایی'
        )}
      </div>

      {/* COURTYARD VALIDATION ALERT OVERLAY BANNER */}
      {courtyardReport.invalidCourtyardsCount > 0 && (
        <div 
          onClick={() => {
            if (onOpenCourtyardValidator) onOpenCourtyardValidator();
          }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-rose-50/95 backdrop-blur-md p-2.5 px-4 border border-rose-300 shadow-xl flex items-center gap-3 rounded-md text-right text-xs cursor-pointer hover:bg-rose-100/90 transition" 
          dir="rtl"
        >
          <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600 font-bold text-sm">
            <AlertTriangle size={16} className="animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-rose-900 text-[11px]">
              هشدار اعتبارسنجی حیاط‌ها (Courtyard Rule Violation)
            </span>
            <span className="text-rose-700 text-[10px] mt-0.5">
              تعداد {courtyardReport.invalidCourtyardsCount} حیاط قانون مجاورت از حداقل ۲ جهت با یونیت‌های مسکونی را نقض کرده است!
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenCourtyardValidator) onOpenCourtyardValidator();
            }}
            className="mr-2 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded transition shadow-xs cursor-pointer shrink-0"
          >
            بررسی و اصلاح
          </button>
        </div>
      )}

      {/* DETAILED CLICK OVERLAYS FOR SELECTIONS */}
      {selectedUnit && (
        <div className="absolute top-16 left-4 z-30 w-[270px] bg-[#FDFCFB]/95 backdrop-blur-md p-4 border border-[#2D2926] shadow-sm animate-fade-in rounded-sm" dir="rtl">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#D9D4CF]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm animate-pulse" style={{ backgroundColor: selectedUnit.color }}></span>
              <span className="text-xs font-bold text-[#2D2926]">{selectedUnit.nameFa}</span>
            </div>
            <button
              onClick={() => onSelectUnit(null)}
              className="text-[#8B8378] hover:text-[#E65100] transition text-sm font-sans font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
              title="بستن"
            >
              ×
            </button>
          </div>
          <p className="text-[10px] text-[#8B8378] font-mono mb-2">Unit ID: {selectedUnit.id.substring(0, 8)} | تراز: {selectedUnit.level}</p>
          <div className="text-[11.5px] text-[#4A443F] space-y-1 bg-[#F7F5F2] p-2 border border-[#D9D4CF] mb-3 rounded-xs">
            <p><strong>ظرفیت خانوار:</strong> {selectedUnit.capacity} نفر</p>
            <p><strong>مساحت تقریبی:</strong> {selectedUnit.area} مترمربع</p>
            <p><strong>وابسته به هسته:</strong> {selectedUnit.coreId.substring(0, 8)}</p>
            <p className="border-t border-[#D9D4CF] pt-1 mt-1 text-[10.5px] text-[#E65100] italic leading-snug">
              {selectedUnit.adjacencyPreferenceFa}
            </p>
          </div>
          <div className="space-y-1.5">
            {onChangeUnitUsage && (
              <>
                {/* Restore option */}
                {(selectedUnit.color === '#8b5cf6' || selectedUnit.color === '#BFC9A2') && (
                  <button
                    onClick={() => {
                      onChangeUnitUsage(selectedUnit.id, 'residential');
                    }}
                    className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-300 transition flex items-center justify-center gap-1.5 cursor-pointer text-[10.5px] font-bold rounded-xs shadow-3xs"
                  >
                    <Sparkles size={12} className="text-amber-600" />
                    <span>برگرداندن به واحد مسکونی اولیه</span>
                  </button>
                )}

                {/* Convert to Entrance option */}
                {selectedUnit.color !== '#8b5cf6' && (
                  <button
                    onClick={() => {
                      onChangeUnitUsage(selectedUnit.id, 'entrance');
                    }}
                    className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-800 border border-slate-200 hover:border-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer text-[10.5px] font-bold rounded-xs shadow-3xs"
                  >
                    <Sparkles size={12} className="text-slate-600" />
                    <span>تبدیل به ورودی محله (هاشور خاکستری)</span>
                  </button>
                )}

                {/* Convert to Yard option */}
                {selectedUnit.color !== '#BFC9A2' && (
                  <button
                    onClick={() => {
                      onChangeUnitUsage(selectedUnit.id, 'yard');
                    }}
                    className="w-full py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-300 transition flex items-center justify-center gap-1.5 cursor-pointer text-[10.5px] font-bold rounded-xs shadow-3xs"
                  >
                    <Sparkles size={12} className="text-emerald-600" />
                    <span>تبدیل به حیاط و میانسرا (سبز)</span>
                  </button>
                )}
              </>
            )}
            {onDeleteUnit && (
              <button
                onClick={() => {
                  onDeleteUnit(selectedUnit.id);
                }}
                className="w-full py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 transition flex items-center justify-center gap-1.5 cursor-pointer text-[10.5px] font-bold rounded-xs shadow-3xs"
              >
                <Trash2 size={12} />
                <span>حذف این واحد مسکونی</span>
              </button>
            )}
          </div>

          {/* Attached Undo notification panel (collapsible together with unit box) */}
          {showSuccessNotification && onUndo && (
            <div className="mt-4 pt-3 border-t-2 border-dashed border-emerald-500/20 flex flex-col gap-2 bg-[#FDFCFB] animate-fade-in">
              <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>تغییرات با موفقیت اعمال شد.</span>
              </div>
              <button
                onClick={handleTriggerUndo}
                className="w-full py-1.5 px-3 bg-[#E65100] hover:bg-[#D84315] text-white text-[10.5px] font-extrabold rounded-xs transition shadow-3xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={11} />
                <span>واگرد آخرین تغییر (Undo)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {selectedCore && (
        <div className="absolute top-16 left-4 z-30 w-[270px] bg-[#FDFCFB]/95 backdrop-blur-md p-4 border border-[#2D2926] shadow-sm animate-fade-in rounded-sm" dir="rtl">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#D9D4CF]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#1e293b]"></span>
              <span className="text-xs font-bold text-[#2D2926]">{selectedCore.nameFa}</span>
            </div>
            <button
              onClick={() => onSelectCore(null)}
              className="text-[#8B8378] hover:text-[#E65100] transition text-sm font-sans font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
              title="بستن"
            >
              ×
            </button>
          </div>
          <p className="text-[10px] text-[#8B8378] font-mono mb-2">Core ID: {selectedCore.id.substring(0, 8)}</p>
          <div className="text-[11.5px] text-[#4A443F] space-y-1 bg-[#F7F5F2] p-2 border border-[#D9D4CF] rounded-xs">
            <p><strong>بستر اشغال:</strong> {selectedCore.type === 'mini' ? '۱' : '۴'} سلول</p>
            <p><strong>ظرفیت پشتیبانی:</strong> {selectedCore.capacity} واحد مسکونی</p>
            <p><strong>تجهیزات متمرکز:</strong> شفت فاضلاب، شلنگ اطفای حریق، تصفیه‌خانه محلی</p>
          </div>
          {onDeleteCore && (
            <div className="mt-3 pt-2 border-t border-[#D9D4CF]">
              <button
                onClick={() => {
                  onDeleteCore(selectedCore.id);
                }}
                className="w-full py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 transition flex items-center justify-center gap-1.5 cursor-pointer text-[10.5px] font-bold rounded-xs shadow-3xs"
              >
                <Trash2 size={12} />
                <span>حذف این هسته داکت و تمام کانتینرهای وابسته آن</span>
              </button>
            </div>
          )}
        </div>
      )}

      {showSuccessNotification && onUndo && !selectedUnit && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-[#FDFCFB]/95 backdrop-blur-md px-4 py-2.5 border border-[#2D2926] shadow-md rounded-sm flex items-center gap-3 animate-fade-in" dir="rtl">
          <span className="text-[11.5px] text-[#4A443F] font-bold">تغییرات با موفقیت اعمال شد.</span>
          <button
            onClick={handleTriggerUndo}
            className="px-3 py-1 bg-[#E65100] hover:bg-[#D84315] text-white text-[11px] font-extrabold rounded-xs transition shadow-3xs cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={11} />
            <span>واگرد آخرین تغییر (Undo)</span>
          </button>
        </div>
      )}
    </div>
  );
}
