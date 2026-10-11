/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { generateMultiSolutionSet, DEFAULT_PARAMS } from './generator';
import { SettlementState, GenerationParams, MultiSolutionSet } from './types';
import SettlementCanvas from './components/SettlementCanvas';
import InputsPanel from './components/InputsPanel';
import Dashboard from './components/Dashboard';
import ReportModal from './components/ReportModal';
import ExportScreenshotModal from './components/ExportScreenshotModal';
import CourtyardValidatorModal from './components/CourtyardValidatorModal';
import { TutorialModal } from './components/TutorialModal';
import { validateCourtyards } from './utils/courtyardValidator';
import { Sparkles, HelpCircle, FileText, Camera, Layers, BarChart3, Sliders, Download, Upload, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

export default function App() {
  // Read initial params safely from localStorage or default
  const [params, setParams] = useState<GenerationParams>(() => {
    const saved = localStorage.getItem('settle_params');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.siteWidth === 'number' && typeof parsed.totalHouseholds === 'number') {
          const allowed = [20, 60, 120, 160, 200];
          if (!allowed.includes(parsed.totalHouseholds)) {
            parsed.totalHouseholds = 60;
          }
          return parsed;
        }
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_PARAMS;
  });

  const [solutions, setSolutions] = useState<MultiSolutionSet | null>(null);

  // History stack for Undo operations on unit edits
  const [historyStack, setHistoryStack] = useState<Array<{
    type: 'delete' | 'change_usage' | 'delete_core' | 'toggle_courtyard' | 'toggle_entrance' | 'toggle_public_space';
    solutionKey: 'solutionA' | 'solutionB' | 'solutionC';
    previousCores?: any[];
    previousUnits?: any[];
    previousGrid: Record<string, any>;
    previousClusters?: any[];
    previousCourtyards?: any[];
    previousEntrances?: any[];
    previousPublicSpaces?: any[];
    unitId: string | null;
  }>>([]);
  
  // Read selected solution key from localStorage or default 'C'
  const [selectedSolutionKey, setSelectedSolutionKey] = useState<'A' | 'B' | 'C'>(() => {
    const saved = localStorage.getItem('settle_solution_key');
    if (saved === 'A' || saved === 'B' || saved === 'C') {
      return saved;
    }
    return 'C';
  });

  const [activeStage, setActiveStage] = useState<number>(6); // Start on final synthesis stage
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedCoreId, setSelectedCoreId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isCourtyardValidatorOpen, setIsCourtyardValidatorOpen] = useState<boolean>(false);

  const handleCleanInvalidCourtyards = () => {
    if (!solutions) return;
    const targetKey = selectedSolutionKey === 'A' ? 'solutionA' : selectedSolutionKey === 'B' ? 'solutionB' : 'solutionC';
    const activeSol = solutions[targetKey];
    if (!activeSol) return;

    const report = validateCourtyards(activeSol);
    if (report.invalidCourtyardsCount === 0) return;

    const invalidSet = new Set(report.invalidCourtyardIds);
    const updatedCourtyards = activeSol.courtyards.filter(c => !invalidSet.has(c.id));
    const updatedGrid = { ...activeSol.grid };

    for (const key in updatedGrid) {
      if (updatedGrid[key]?.type === 'courtyard' && invalidSet.has(updatedGrid[key].occupiedId)) {
        delete updatedGrid[key];
      }
    }

    const updatedSolution = {
      ...activeSol,
      courtyards: updatedCourtyards,
      grid: updatedGrid
    };

    setSolutions({
      ...solutions,
      [targetKey]: updatedSolution
    });
  };

  // Synchronized camera/viewport states
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'three3d' | 'elev_n' | 'elev_s' | 'elev_e' | 'elev_w'>('3d');
  const [editMode, setEditMode] = useState<'view' | 'boundary' | 'obstacle' | 'slope' | 'yard' | 'entrance_design' | 'public_space_design' | 'delete_design'>('view');
  const [pitch, setPitch] = useState<number>(42);
  const [yaw, setYaw] = useState<number>(-35);
  const [zoom, setZoom] = useState<number>(1.1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: -20 });
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | 'all'>('all');
  const [containerOpacity, setContainerOpacity] = useState<number>(0.85);

  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [compareLeftKey, setCompareLeftKey] = useState<'A' | 'B' | 'C'>('A');
  const [compareRightKey, setCompareRightKey] = useState<'A' | 'B' | 'C'>('B');

  // Collapsible Sidebars drawers controls
  const [leftOpen, setLeftOpen] = useState<boolean>(false);
  const [rightOpen, setRightOpen] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<1 | 2>(1); // 1: Land inputs, 2: Demographics inputs

  // Trigger initial stochastic optimization on mount, loading from existing seed in params
  useEffect(() => {
    const initialSeed = params.seed ?? Math.floor(Math.random() * 100000);
    const initialParams = { ...params, seed: initialSeed };
    setParams(initialParams);
    const res = generateMultiSolutionSet(initialParams);
    setSolutions(res);
  }, []);

  // Save params to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('settle_params', JSON.stringify(params));
  }, [params]);

  // Save selected solution key to localStorage
  useEffect(() => {
    localStorage.setItem('settle_solution_key', selectedSolutionKey);
  }, [selectedSolutionKey]);

  // Handler for sliders modifying settings dynamically
  const handleParamsChange = (newParams: GenerationParams) => {
    const updatedParams = { ...newParams, seed: newParams.seed ?? params.seed };
    setParams(updatedParams);
    const res = generateMultiSolutionSet(updatedParams);
    setSolutions(res);
  };

  // Explicit regeneration handler to stochastically shuffle candidates seed index
  const handleRegenerate = () => {
    const newSeed = Math.floor(Math.random() * 100000);
    const updatedParams = { ...params, seed: newSeed };
    setParams(updatedParams);
    const res = generateMultiSolutionSet(updatedParams);
    setSolutions(res);
    setSelectedUnitId(null);
    setSelectedCoreId(null);
    setActiveStage(6); // Go directly to final synthesis stage to preview the finalized layout
    setIsPlaying(false);
  };

  const handleImport = (importedParams: GenerationParams, selectedKey?: 'A' | 'B' | 'C') => {
    setParams(importedParams);
    const res = generateMultiSolutionSet(importedParams);
    setSolutions(res);
    if (selectedKey) {
      setSelectedSolutionKey(selectedKey);
    }
    setSelectedUnitId(null);
    setSelectedCoreId(null);
    setActiveStage(6); // Go directly to final synthesis stage
    setIsPlaying(false);
  };

  const [isJSONExpanded, setIsJSONExpanded] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isLiveSyncActive, setIsLiveSyncActive] = useState<boolean>(false);
  const fileHandleRef = useRef<any>(null);

  const handleClearLiveSync = () => {
    fileHandleRef.current = null;
    setIsLiveSyncActive(false);
  };

  const handleExportJSON = async () => {
    let activeState = null;
    if (solutions) {
      if (selectedSolutionKey === 'A') activeState = solutions.solutionA;
      else if (selectedSolutionKey === 'B') activeState = solutions.solutionB;
      else activeState = solutions.solutionC;
    }

    const rhinoData = activeState ? {
      units: activeState.units.map(unit => {
        const xs = unit.gridCoords.map(c => c.x);
        const ys = unit.gridCoords.map(c => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const width = maxX - minX + 1;
        const depth = maxY - minY + 1;
        const height = 1; // 1 level per container
        
        const x = minX + width / 2;
        const y = minY + depth / 2;
        const z = unit.level + 0.5;

        return {
          id: unit.id,
          coreId: unit.coreId,
          type: unit.type,
          position: { x, y, z },
          dimensions: { width, depth, height },
          metadata: {
            area: unit.area,
            capacity: unit.capacity,
            level: unit.level,
            color: unit.color,
            nameFa: unit.nameFa,
            nameEn: unit.nameEn
          }
        };
      }),
      cores: activeState.cores.map(core => {
        const xs = core.gridCoords.map(c => c.x);
        const ys = core.gridCoords.map(c => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const width = maxX - minX + 1;
        const depth = maxY - minY + 1;
        const connectedUnits = activeState!.units.filter(u => u.coreId === core.id);
        const maxLvl = connectedUnits.length > 0 ? Math.max(...connectedUnits.map(u => u.level)) : 0;
        const height = maxLvl + 2;

        const x = minX + width / 2;
        const y = minY + depth / 2;
        const z = height / 2;

        return {
          id: core.id,
          type: core.type,
          position: { x, y, z },
          dimensions: { width, depth, height },
          metadata: {
            capacity: core.capacity,
            nameFa: core.nameFa,
            nameEn: core.nameEn
          }
        };
      })
    } : null;

    const configData = {
      generatorApp: "SettlementMorphogeneticGenerator",
      version: "1.6.0",
      exportTime: new Date().toISOString(),
      seed: params.seed,
      selectedSolutionKey: selectedSolutionKey || 'C',
      params: params,
      rhinoExport: rhinoData
    };

    const triggerLegacyDownload = () => {
      const dataStr = JSON.stringify(configData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `settlement_config_seed_${params.seed ?? 0}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    if ('showSaveFilePicker' in window) {
      try {
        if (!fileHandleRef.current) {
          const options = {
            suggestedName: `settlement-output.json`,
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] },
            }],
          };
          fileHandleRef.current = await (window as any).showSaveFilePicker(options);
          setIsLiveSyncActive(true);
        }
        
        const writable = await fileHandleRef.current.createWritable();
        await writable.write(JSON.stringify(configData, null, 2));
        await writable.close();
        setImportError(null);
      } catch (err: any) {
        console.error("Error saving file:", err);
        if (err.name !== 'AbortError') {
          triggerLegacyDownload();
          if (err.name === 'SecurityError' || err.message?.includes('sub frame') || err.message?.includes('cross origin')) {
            setImportError("امکان اتصال زنده مستقیم در فریم داخلی وجود ندارد. برای استفاده از همگام‌سازی مستقیم با Rhino/Grasshopper، برنامه را از طریق نماد بالای سمت راست صفحه نمایشگر در تب مستقل (New Tab) باز کنید. (فایل پیکربندی فعلی دانلود شد)");
          } else {
            setImportError("خطا در همگام‌سازی فایل زنده. فایل به صورت عادی دانلود شد.");
          }
        }
      }
    } else {
      triggerLegacyDownload();
    }
  };

  const handleImportJSON = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        if (json.generatorApp !== "SettlementMorphogeneticGenerator" && !json.params) {
          setImportError("فایل وارد شده معتبر نیست. لطفاً یک فایل پیکربندی کواست صادر شده را بارگذاری کنید.");
          return;
        }

        const importedParams: GenerationParams = json.params;
        const selectedKey: 'A' | 'B' | 'C' = json.selectedSolutionKey || 'C';

        if (typeof importedParams.siteWidth !== 'number' || typeof importedParams.totalHouseholds !== 'number') {
          setImportError("پارامترهای پیکربندی خراب یا ناسازگار هستند.");
          return;
        }

        handleImport(importedParams, selectedKey);
        setIsJSONExpanded(false);
      } catch (err) {
        setImportError("قالب‌بندی فایل نامعتبر است.");
      }
    };
    reader.readAsText(file);
  };

  const cloneSolutionState = (sol: SettlementState) => {
    return {
      cores: JSON.parse(JSON.stringify(sol.cores)),
      units: JSON.parse(JSON.stringify(sol.units)),
      grid: JSON.parse(JSON.stringify(sol.grid)),
      clusters: JSON.parse(JSON.stringify(sol.clusters)),
      courtyards: JSON.parse(JSON.stringify(sol.courtyards)),
      entrances: JSON.parse(JSON.stringify(sol.entrances || [])),
      publicSpaces: JSON.parse(JSON.stringify(sol.publicSpaces || []))
    };
  };

  const handleDeleteUnit = (unitId: string) => {
    if (!solutions) return;
    
    // Auto-detect which solution contains the unit
    let targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' | null = null;
    if (solutions.solutionA.units.some(u => u.id === unitId)) {
      targetSolutionKey = 'solutionA';
    } else if (solutions.solutionB.units.some(u => u.id === unitId)) {
      targetSolutionKey = 'solutionB';
    } else if (solutions.solutionC.units.some(u => u.id === unitId)) {
      targetSolutionKey = 'solutionC';
    }

    if (!targetSolutionKey) return;
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    const unitToDelete = activeSolution.units.find(u => u.id === unitId);
    if (!unitToDelete) return;

    // Push state before change to history stack
    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'delete',
      solutionKey: targetSolutionKey!,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      unitId: unitId
    }]);

    const updatedUnits = activeSolution.units.filter(u => u.id !== unitId);

    const updatedGrid = { ...activeSolution.grid };
    unitToDelete.gridCoords.forEach(pt => {
      const cellKey = `${pt.x},${pt.y},${pt.level}`;
      delete updatedGrid[cellKey];
    });

    const updatedClusters = activeSolution.clusters.map(cluster => ({
      ...cluster,
      unitIds: cluster.unitIds.filter(id => id !== unitId)
    }));

    const updatedSolution = {
      ...activeSolution,
      units: updatedUnits,
      grid: updatedGrid,
      clusters: updatedClusters
    };

    setSolutions({
      ...solutions,
      [targetSolutionKey]: updatedSolution
    });

    setSelectedUnitId(null);
  };

  const handleDeleteCore = (coreId: string) => {
    if (!solutions) return;

    // Auto-detect which solution contains the core
    let targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' | null = null;
    if (solutions.solutionA.cores.some(c => c.id === coreId)) {
      targetSolutionKey = 'solutionA';
    } else if (solutions.solutionB.cores.some(c => c.id === coreId)) {
      targetSolutionKey = 'solutionB';
    } else if (solutions.solutionC.cores.some(c => c.id === coreId)) {
      targetSolutionKey = 'solutionC';
    }

    if (!targetSolutionKey) return;
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    const coreToDelete = activeSolution.cores.find(c => c.id === coreId);
    if (!coreToDelete) return;

    // Push state before change to history stack
    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'delete_core',
      solutionKey: targetSolutionKey!,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      unitId: coreId
    }]);

    // 1. Delete the core itself
    const updatedCores = activeSolution.cores.filter(c => c.id !== coreId);

    // 2. Filter out units that belong to this core
    const unitsToDelete = activeSolution.units.filter(u => u.coreId === coreId);
    const updatedUnits = activeSolution.units.filter(u => u.coreId !== coreId);

    // 3. Update the grid: remove both the core's grid coords and the deleted units' grid coords
    const updatedGrid = { ...activeSolution.grid };
    
    // Clear core cells (across all potential levels 0 to 6)
    coreToDelete.gridCoords.forEach(pt => {
      for (let l = 0; l <= 6; l++) {
        const cellKey = `${pt.x},${pt.y},${l}`;
        if (updatedGrid[cellKey]?.occupiedId === coreId) {
          delete updatedGrid[cellKey];
        }
      }
    });

    // Clear deleted units cells
    unitsToDelete.forEach(unit => {
      unit.gridCoords.forEach(pt => {
        const cellKey = `${pt.x},${pt.y},${unit.level}`;
        if (updatedGrid[cellKey]?.occupiedId === unit.id) {
          delete updatedGrid[cellKey];
        }
      });
    });

    // 4. Remove clusters belonging to this core, or remove unit references
    const updatedClusters = activeSolution.clusters.filter(c => c.coreId !== coreId);

    const updatedSolution = {
      ...activeSolution,
      cores: updatedCores,
      units: updatedUnits,
      grid: updatedGrid,
      clusters: updatedClusters
    };

    setSolutions({
      ...solutions,
      [targetSolutionKey]: updatedSolution
    });

    setSelectedCoreId(null);
  };

  const handleToggleCourtyardCell = (x: number, y: number) => {
    if (!solutions) return;
    const targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' = 
      selectedSolutionKey === 'A' ? 'solutionA' : selectedSolutionKey === 'B' ? 'solutionB' : 'solutionC';
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    // Push current state to history stack for undo support
    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'toggle_courtyard',
      solutionKey: targetSolutionKey,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      previousCourtyards: prevState.courtyards,
      unitId: `${x},${y}` // reference coords
    }]);

    const cellKey = `${x},${y},0`;
    const existingCell = activeSolution.grid[cellKey];

    const updatedGrid = { ...activeSolution.grid };
    let updatedCourtyards = [...activeSolution.courtyards];

    if (existingCell && existingCell.type === 'courtyard') {
      // 1. Remove this cell from the courtyard
      const courtId = existingCell.occupiedId;
      delete updatedGrid[cellKey];

      updatedCourtyards = updatedCourtyards.map(court => {
        if (court.id === courtId) {
          const filteredCoords = court.gridCoords.filter(pt => !(pt.x === x && pt.y === y));
          return {
            ...court,
            gridCoords: filteredCoords,
            size: filteredCoords.length
          };
        }
        return court;
      }).filter(court => court.size > 0);
    } else {
      // Allow placing ONLY on empty cells to avoid breaking buildings, cores, etc.
      if (existingCell && existingCell.type !== 'empty') {
        return;
      }

      // Check for adjacent courtyard to merge with
      const isAdjacent = (pt1: {x: number, y: number}, pt2: {x: number, y: number}) => {
        return Math.abs(pt1.x - pt2.x) + Math.abs(pt1.y - pt2.y) <= 1;
      };

      const mergedCourt = updatedCourtyards.find(court => 
        court.gridCoords.some(pt => isAdjacent(pt, { x, y }))
      );

      if (mergedCourt) {
        // Merge into existing courtyard
        updatedCourtyards = updatedCourtyards.map(court => {
          if (court.id === mergedCourt.id) {
            const newCoords = [...court.gridCoords, { x, y }];
            return {
              ...court,
              gridCoords: newCoords,
              size: newCoords.length
            };
          }
          return court;
        });

        updatedGrid[cellKey] = {
          x,
          y,
          level: 0,
          type: 'courtyard',
          occupiedId: mergedCourt.id
        };
      } else {
        // Create a new courtyard
        const newCourtId = `court-manual-${Date.now()}`;
        const newCourt = {
          id: newCourtId,
          clusterId: 'manual',
          x,
          y,
          size: 1,
          gridCoords: [{ x, y }]
        };

        updatedCourtyards.push(newCourt);
        updatedGrid[cellKey] = {
          x,
          y,
          level: 0,
          type: 'courtyard',
          occupiedId: newCourtId
        };
      }
    }

    const updatedSolution = {
      ...activeSolution,
      grid: updatedGrid,
      courtyards: updatedCourtyards
    };

    setSolutions({
      ...solutions,
      [targetSolutionKey]: updatedSolution
    });
  };

  const handleToggleEntranceCell = (x: number, y: number) => {
    if (!solutions) return;
    const targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' = 
      selectedSolutionKey === 'A' ? 'solutionA' : selectedSolutionKey === 'B' ? 'solutionB' : 'solutionC';
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'toggle_entrance',
      solutionKey: targetSolutionKey,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      previousCourtyards: prevState.courtyards,
      previousEntrances: prevState.entrances,
      previousPublicSpaces: prevState.publicSpaces,
      unitId: `${x},${y}`
    }]);

    let updatedEntrances = [...(activeSolution.entrances || [])];
    let updatedPublicSpaces = [...(activeSolution.publicSpaces || [])];

    const existingEntIdx = updatedEntrances.findIndex(ent => ent.x === x && ent.y === y);
    if (existingEntIdx > -1) {
      // Toggle off
      updatedEntrances.splice(existingEntIdx, 1);
    } else {
      // Toggle on: add entrance and remove any existing public space on the same cell to prevent duplicates
      updatedEntrances.push({ id: `ent-manual-${Date.now()}`, x, y });
      updatedPublicSpaces = updatedPublicSpaces.filter(ps => !(ps.x === x && ps.y === y));
    }

    const updatedSolution = {
      ...activeSolution,
      entrances: updatedEntrances,
      publicSpaces: updatedPublicSpaces
    };

    setSolutions({
      ...solutions,
      [targetSolutionKey]: updatedSolution
    });
  };

  const handleTogglePublicSpaceCell = (x: number, y: number) => {
    if (!solutions) return;
    const targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' = 
      selectedSolutionKey === 'A' ? 'solutionA' : selectedSolutionKey === 'B' ? 'solutionB' : 'solutionC';
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'toggle_public_space',
      solutionKey: targetSolutionKey,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      previousCourtyards: prevState.courtyards,
      previousEntrances: prevState.entrances,
      previousPublicSpaces: prevState.publicSpaces,
      unitId: `${x},${y}`
    }]);

    let updatedEntrances = [...(activeSolution.entrances || [])];
    let updatedPublicSpaces = [...(activeSolution.publicSpaces || [])];

    const existingPsIdx = updatedPublicSpaces.findIndex(ps => ps.x === x && ps.y === y);
    if (existingPsIdx > -1) {
      // Toggle off
      updatedPublicSpaces.splice(existingPsIdx, 1);
    } else {
      // Toggle on: add public space and remove any existing entrance on the same cell to prevent duplicates
      updatedPublicSpaces.push({ id: `ps-manual-${Date.now()}`, x, y });
      updatedEntrances = updatedEntrances.filter(ent => !(ent.x === x && ent.y === y));
    }

    const updatedSolution = {
      ...activeSolution,
      entrances: updatedEntrances,
      publicSpaces: updatedPublicSpaces
    };

    setSolutions({
      ...solutions,
      [targetSolutionKey]: updatedSolution
    });
  };

  const handleClearEntrances = () => {
    if (!solutions) return;
    const targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' = 
      selectedSolutionKey === 'A' ? 'solutionA' : selectedSolutionKey === 'B' ? 'solutionB' : 'solutionC';
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'toggle_entrance', // generic type or custom type that can be undone
      solutionKey: targetSolutionKey,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      previousCourtyards: prevState.courtyards,
      previousEntrances: prevState.entrances,
      previousPublicSpaces: prevState.publicSpaces,
      unitId: 'all-entrances'
    }]);

    setSolutions({
      ...solutions,
      [targetSolutionKey]: {
        ...activeSolution,
        entrances: []
      }
    });
  };

  const handleClearPublicSpaces = () => {
    if (!solutions) return;
    const targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' = 
      selectedSolutionKey === 'A' ? 'solutionA' : selectedSolutionKey === 'B' ? 'solutionB' : 'solutionC';
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'toggle_public_space', // generic type or custom type that can be undone
      solutionKey: targetSolutionKey,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      previousCourtyards: prevState.courtyards,
      previousEntrances: prevState.entrances,
      previousPublicSpaces: prevState.publicSpaces,
      unitId: 'all-public-spaces'
    }]);

    setSolutions({
      ...solutions,
      [targetSolutionKey]: {
        ...activeSolution,
        publicSpaces: []
      }
    });
  };

  const handleChangeUnitUsage = (unitId: string, targetUsage?: 'residential' | 'entrance' | 'yard') => {
    if (!solutions) return;
    
    // Auto-detect which solution contains the unit
    let targetSolutionKey: 'solutionA' | 'solutionB' | 'solutionC' | null = null;
    if (solutions.solutionA.units.some(u => u.id === unitId)) {
      targetSolutionKey = 'solutionA';
    } else if (solutions.solutionB.units.some(u => u.id === unitId)) {
      targetSolutionKey = 'solutionB';
    } else if (solutions.solutionC.units.some(u => u.id === unitId)) {
      targetSolutionKey = 'solutionC';
    }

    if (!targetSolutionKey) return;
    const activeSolution = solutions[targetSolutionKey];
    if (!activeSolution) return;

    const unitToChange = activeSolution.units.find(u => u.id === unitId);
    if (!unitToChange) return;

    // Push state before change to history stack
    const prevState = cloneSolutionState(activeSolution);
    setHistoryStack(prev => [...prev, {
      type: 'change_usage',
      solutionKey: targetSolutionKey!,
      previousCores: prevState.cores,
      previousUnits: prevState.units,
      previousGrid: prevState.grid,
      previousClusters: prevState.clusters,
      unitId: unitId
    }]);

    const updatedGrid = { ...activeSolution.grid };
    let updatedUnits;

    // We need to know the true original coords for restoration/re-conversion
    const origProps = unitToChange.originalProperties;
    const originalCoords = origProps ? origProps.gridCoords : unitToChange.gridCoords;

    // If no targetUsage specified, toggle like before or default to residential if modified
    const currentUsage = unitToChange.color === '#8b5cf6' ? 'entrance' : unitToChange.color === '#BFC9A2' ? 'yard' : 'residential';
    const resolvedUsage = targetUsage || (currentUsage === 'residential' ? 'entrance' : 'residential');

    if (resolvedUsage === 'residential') {
      // Restore unit back to original residential unit
      
      // Clear current coords from grid first
      unitToChange.gridCoords.forEach(pt => {
        const cellKey = `${pt.x},${pt.y},${pt.level}`;
        delete updatedGrid[cellKey];
      });

      // Write original coords back to grid
      originalCoords.forEach(pt => {
        const cellKey = `${pt.x},${pt.y},${pt.level}`;
        updatedGrid[cellKey] = {
          x: pt.x,
          y: pt.y,
          level: pt.level,
          type: 'unit',
          occupiedId: unitId
        };
      });

      updatedUnits = activeSolution.units.map(u => {
        if (u.id === unitId) {
          if (origProps) {
            return {
              ...u,
              type: origProps.type,
              capacity: origProps.capacity,
              area: origProps.area,
              containerCount: origProps.containerCount,
              color: origProps.color,
              nameFa: origProps.nameFa,
              nameEn: origProps.nameEn,
              gridCoords: origProps.gridCoords,
              adjacencyPreference: origProps.adjacencyPreference,
              adjacencyPreferenceFa: origProps.adjacencyPreferenceFa,
              originalProperties: undefined
            };
          } else {
            // Default fallback if no originalProperties found
            return {
              ...u,
              type: 'single' as any,
              capacity: 4,
              area: 15,
              color: '#3b82f6',
              nameFa: 'واحد مسکونی کوچک',
              nameEn: 'Small Residential Unit',
              adjacencyPreferenceFa: 'نزدیکی به فضای سبز و دور از شلوغی',
              adjacencyPreference: 'Near green spaces and away from noise',
              originalProperties: undefined
            };
          }
        }
        return u;
      });
    } else if (resolvedUsage === 'entrance') {
      // Convert to ENTRANCE
      
      // Clear current coords from grid
      unitToChange.gridCoords.forEach(pt => {
        const cellKey = `${pt.x},${pt.y},${pt.level}`;
        delete updatedGrid[cellKey];
      });

      // Entrance uses only first 2 coords for smaller footprint/passage
      const newCoords = originalCoords.slice(0, 2);

      // Write remaining cells to grid
      newCoords.forEach(pt => {
        const cellKey = `${pt.x},${pt.y},${pt.level}`;
        updatedGrid[cellKey] = {
          x: pt.x,
          y: pt.y,
          level: pt.level,
          type: 'unit',
          occupiedId: unitId
        };
      });

      updatedUnits = activeSolution.units.map(u => {
        if (u.id === unitId) {
          return {
            ...u,
            type: 'single' as any,
            color: '#8b5cf6', // Gorgeous Persian Purple
            nameFa: 'واحد ورودی محله (هاشور خاکستری)',
            nameEn: 'Neighborhood Entrance Unit',
            capacity: 0,
            area: 15,
            adjacencyPreferenceFa: 'ارتباط مستقیم بیرونی و ورودی اصلی محله',
            adjacencyPreference: 'Direct exterior connection and main neighborhood entrance',
            gridCoords: newCoords,
            originalProperties: origProps || {
              type: u.type,
              capacity: u.capacity,
              area: u.area,
              containerCount: u.containerCount,
              color: u.color,
              nameFa: u.nameFa,
              nameEn: u.nameEn,
              gridCoords: u.gridCoords,
              adjacencyPreference: u.adjacencyPreference,
              adjacencyPreferenceFa: u.adjacencyPreferenceFa
            }
          };
        }
        return u;
      });
    } else if (resolvedUsage === 'yard') {
      // Convert to YARD (Courtyard/میانسرا)
      
      // Clear current coords from grid
      unitToChange.gridCoords.forEach(pt => {
        const cellKey = `${pt.x},${pt.y},${pt.level}`;
        delete updatedGrid[cellKey];
      });

      // Yard uses all coords to look like a full courtyard
      const newCoords = originalCoords;

      // Write cells to grid
      newCoords.forEach(pt => {
        const cellKey = `${pt.x},${pt.y},${pt.level}`;
        updatedGrid[cellKey] = {
          x: pt.x,
          y: pt.y,
          level: pt.level,
          type: 'unit',
          occupiedId: unitId
        };
      });

      updatedUnits = activeSolution.units.map(u => {
        if (u.id === unitId) {
          return {
            ...u,
            type: 'single' as any,
            color: '#BFC9A2', // Architectural Grass Lawn
            nameFa: 'حیاط و میانسرا (سبز)',
            nameEn: 'Yard / Courtyard (Green)',
            capacity: 0,
            area: 15,
            adjacencyPreferenceFa: 'فضای باز بازشوها، باغچه پیاده مشترک کلاستر',
            adjacencyPreference: 'Open pedestrian garden courtyard for cluster',
            gridCoords: newCoords,
            originalProperties: origProps || {
              type: u.type,
              capacity: u.capacity,
              area: u.area,
              containerCount: u.containerCount,
              color: u.color,
              nameFa: u.nameFa,
              nameEn: u.nameEn,
              gridCoords: u.gridCoords,
              adjacencyPreference: u.adjacencyPreference,
              adjacencyPreferenceFa: u.adjacencyPreferenceFa
            }
          };
        }
        return u;
      });
    }

    const updatedSolution = {
      ...activeSolution,
      units: updatedUnits,
      grid: updatedGrid
    };

    setSolutions({
      ...solutions,
      [targetSolutionKey]: updatedSolution
    });

    // Keep it selected so they can see the change immediately
    setSelectedUnitId(unitId);
  };

  const handleUndo = () => {
    if (historyStack.length === 0 || !solutions) return;
    
    const lastAction = historyStack[historyStack.length - 1];
    const newStack = historyStack.slice(0, -1);
    setHistoryStack(newStack);

    const targetKey = lastAction.solutionKey;
    const activeSolution = solutions[targetKey];
    if (!activeSolution) return;

    const restoredSolution = {
      ...activeSolution,
      cores: lastAction.previousCores || activeSolution.cores,
      units: lastAction.previousUnits || activeSolution.units,
      grid: lastAction.previousGrid,
      clusters: lastAction.previousClusters || activeSolution.clusters,
      courtyards: lastAction.previousCourtyards || activeSolution.courtyards,
      entrances: lastAction.previousEntrances || activeSolution.entrances,
      publicSpaces: lastAction.previousPublicSpaces || activeSolution.publicSpaces
    };

    setSolutions({
      ...solutions,
      [targetKey]: restoredSolution
    });

    if (lastAction.type === 'delete_core') {
      setSelectedCoreId(null);
    } else {
      setSelectedUnitId(lastAction.unitId);
    }
  };

  // Safe autoplay effect cycle for morphogenetic step-by-step growth
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setActiveStage(prev => {
        if (prev < 6) return prev + 1;
        return 1; // cyclical timeline rotation
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Extract active solution
  const settlement: SettlementState | null = solutions 
    ? (selectedSolutionKey === 'A' 
        ? solutions.solutionA 
        : selectedSolutionKey === 'B' 
          ? solutions.solutionB 
          : solutions.solutionC) 
    : null;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F7F5F2] text-[#2D2926] flex flex-col font-sans" dir="rtl">
      
      {/* 1. EDITORIAL HEADER */}
      <header className="h-14 bg-[#FDFCFB] border-b border-[#D9D4CF] px-6 flex items-center justify-between gap-4 z-40 select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-[#E65100] text-white flex items-center justify-center font-serif font-black text-sm shadow-xs transition hover:rotate-12 duration-200">
            S
          </div>
          <div>
            <h1 className="text-sm font-serif font-black tracking-wide text-[#2D2926] uppercase">
              Settle
            </h1>
            <p className="text-[9px] tracking-[0.1em] uppercase text-[#8B8378] font-bold font-mono">
              Morphogenetic Settlement Optimization
            </p>
          </div>
          <div className="text-[8px] bg-[#EEEBE6] text-[#4A443F] border border-[#D9D4CF] px-1.5 py-0.5 rounded font-mono hidden sm:inline-block">
            BOTTOM-UP SYNTHESIS
          </div>

          {/* Unified Sidebar Drawer Toggles */}
          <div className="flex items-center gap-1.5 border-r border-[#D9D4CF] pr-3 mr-1">
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold border transition duration-200 rounded-sm cursor-pointer ${
                leftOpen
                  ? 'bg-[#2D2926] text-white border-[#2D2926]'
                  : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
              }`}
            >
              <Sliders size={12} className={leftOpen ? 'text-[#E65100]' : 'text-[#8B8378]'} />
              <span className="hidden sm:inline">اراضی و قوانین</span>
            </button>

            <button
              onClick={() => setRightOpen(!rightOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold border transition duration-200 rounded-sm cursor-pointer ${
                rightOpen
                  ? 'bg-[#2D2926] text-white border-[#2D2926]'
                  : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
              }`}
            >
              <BarChart3 size={12} className={rightOpen ? 'text-[#E65100]' : 'text-[#8B8378]'} />
              <span className="hidden sm:inline">آنالیز و نتایج</span>
            </button>

            <button
              onClick={() => setIsCompareMode(!isCompareMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold border transition duration-200 rounded-sm cursor-pointer ${
                isCompareMode
                  ? 'bg-[#E65100] text-white border-[#E65100]'
                  : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
              }`}
              title="مشاهده و مقایسه دو سناریو به طور همزمان در دو قاب همگام‌سازی شده در کنار هم"
            >
              <Layers size={12} className={isCompareMode ? 'text-white' : 'text-[#8B8378]'} />
              <span>مقایسه دو سناریو</span>
            </button>

            {/* COURTYARD VALIDATOR BUTTON */}
            {settlement && (() => {
              const cReport = validateCourtyards(settlement);
              const hasViolation = cReport && !cReport.allValid;
              return (
                <button
                  onClick={() => setIsCourtyardValidatorOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold border transition duration-200 rounded-sm cursor-pointer ${
                    hasViolation
                      ? 'bg-rose-100/90 text-rose-800 border-rose-300 hover:bg-rose-200'
                      : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                  }`}
                  title="اعتبارسنجی قانون مجاورت حیاط‌ها (حداقل ۲ جهت)"
                >
                  <ShieldCheck size={12} className={hasViolation ? 'text-rose-600 animate-pulse' : 'text-emerald-600'} />
                  <span>اعتبارسنجی حیاط‌ها</span>
                  {hasViolation && (
                    <span className="text-[9px] bg-rose-600 text-white font-mono px-1 py-0.2 rounded-full">
                      {cReport.invalidCourtyardsCount}
                    </span>
                  )}
                </button>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Exchange & Outputs Dropdown */}
          <div className="relative font-sans" dir="rtl">
            <button
              onClick={() => setIsJSONExpanded(!isJSONExpanded)}
              className="flex items-center gap-1.5 bg-white hover:bg-[#F7F5F2] text-[#2D2926] text-[11px] font-bold px-3 py-1.5 border border-[#D9D4CF] transition rounded-xs cursor-pointer select-none"
            >
              <Layers size={12} className="text-[#E65100]" />
              <span>تبادل</span>
              {isLiveSyncActive && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform duration-200 ${isJSONExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isJSONExpanded && (
              <div className="absolute left-0 mt-1 z-50 w-56 bg-[#FDFCFB]/95 backdrop-blur-md p-3 border border-[#D9D4CF] shadow-md rounded flex flex-col gap-2 select-none animate-fade-in text-right">
                <div className="text-[10px] font-bold text-gray-500 pb-1 border-b border-[#D9D4CF]">امکانات تبادل داده و تصویر</div>
                
                {/* Export & Import JSON Row */}
                <div className="flex gap-1.5">
                  <button
                    onClick={handleExportJSON}
                    className={`flex-1 py-1.5 px-2 border transition text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                      isLiveSyncActive 
                        ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100/80 text-emerald-700" 
                        : "bg-white border-[#D9D4CF] hover:bg-[#F7F5F2] text-[#E65100]"
                    }`}
                    title={
                      isLiveSyncActive 
                        ? "بروزرسانی مستقیم آخرین فایل انتخاب شده در ویندوز بدون دیالوگ مجدد" 
                        : "دانلود کل پیکربندی زمین، موانع و بذرهای تصادفی به عنوان فایل JSON"
                    }
                  >
                    <Download size={11} />
                    <span>{isLiveSyncActive ? "ذخیره آنی" : "خروجی Rhino / JSON"}</span>
                  </button>
                  
                  <label
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-[#F7F5F2] text-[#2D2926] border border-[#D9D4CF] transition text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer text-center"
                    title="بارگذاری و شبیه‌سازی مجدد یک فایل صادر شده قبلی"
                  >
                    <Upload size={11} className="inline text-gray-500" />
                    <span>بارگذاری</span>
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleImportJSON} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* Screenshot Button inside Exchange Panel */}
                <button
                  onClick={() => {
                    setIsExportOpen(true);
                    setIsJSONExpanded(false);
                  }}
                  className="w-full py-1.5 px-2 bg-[#E65100]/5 hover:bg-[#E65100]/15 text-[#E65100] border border-[#E65100]/30 transition text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer rounded-xs"
                >
                  <Camera size={11} />
                  <span>خروجی عکس و آلبوم نقشه</span>
                </button>

                {isLiveSyncActive && (
                  <div className="flex items-center justify-between text-[9px] text-emerald-700 bg-emerald-50/70 border border-emerald-100 rounded-xs p-1">
                    <span className="flex items-center gap-1">
                      <span>● همگام‌سازی زنده</span>
                    </span>
                    <button 
                      onClick={handleClearLiveSync}
                      className="text-[#DC2626] hover:text-red-700 underline text-[8px] cursor-pointer"
                    >
                      قطع اتصال
                    </button>
                  </div>
                )}

                {params.seed !== undefined && (
                  <div className="text-[8px] text-gray-500 font-mono text-left pt-1 border-t border-[#EEEEEE]">
                    SEED: {params.seed}
                  </div>
                )}

                {importError && (
                  <div className="text-[9px] text-[#DC2626] leading-relaxed pt-1 font-sans border-t border-[#FECACA] bg-red-50 p-1">
                    ⚠️ {importError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 4. MAIN COCKPIT VIEWPORTS (Flexible 3-Column Workspace) */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        
        {/* PANEL A (FAR RIGHT in RTL): Inputs Wizard Steps 1 & 2 */}
        <InputsPanel
          params={params}
          onChangeParams={handleParamsChange}
          onRegenerate={handleRegenerate}
          isOpen={leftOpen}
          onToggle={() => setLeftOpen(!leftOpen)}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
        />

        {/* PANEL B (MIDDLE in RTL): Dashboard Optimization Candidates & Evolutionary Timeline */}
        {settlement && (
          <Dashboard
            state={settlement}
            activeStage={activeStage}
            setActiveStage={setActiveStage}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            params={params}
            onChangeParams={handleParamsChange}
            selectedSolutionKey={selectedSolutionKey}
            onChangeSelectedSolutionKey={setSelectedSolutionKey}
            solutions={solutions}
            onRegenerate={handleRegenerate}
            onOpenReport={() => setIsReportOpen(true)}
            onOpenExport={() => setIsExportOpen(true)}
            onOpenCourtyardValidator={() => setIsCourtyardValidatorOpen(true)}
            isOpen={rightOpen}
            onToggle={() => setRightOpen(!rightOpen)}
          />
        )}

        {/* PANEL C (FAR LEFT in RTL - Always on Left!): Settlement Canvas rendering area */}
        <div className="flex-1 h-full min-w-0 flex flex-col relative bg-[#EEEBE6]">

          {solutions ? (
            isCompareMode ? (
              <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 relative divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#D9D4CF]">
                
                {/* FIRST COMPARISON VIEWPORT (RIGHT SIDE VISUALLY IN RTL) */}
                <div className="flex-1 h-1/2 md:h-full min-w-0 flex flex-col relative">
                  <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 bg-[#FDFCFB]/90 backdrop-blur-xs px-2.5 py-1.5 border border-[#D9D4CF] shadow-sm rounded-sm select-none" dir="rtl">
                    <span className="text-[10px] text-[#2D2926] font-bold">بخش راست:</span>
                    <select
                      value={compareLeftKey}
                      onChange={(e) => setCompareLeftKey(e.target.value as 'A' | 'B' | 'C')}
                      className="bg-white border border-[#D9D4CF] text-[10.5px] font-bold text-[#2D2926] py-0.5 px-2.5 rounded-xs focus:outline-none focus:border-[#E65100] cursor-pointer"
                    >
                      <option value="A">طرح الف (سهولت پیاده)</option>
                      <option value="B">طرح ب (توسعه لبه‌ای)</option>
                      <option value="C">طرح ج (تعادل بهینه چندهدفه)</option>
                    </select>
                    <span className="text-[10px] font-black text-[#E65100] border-r border-[#D9D4CF] pr-2 mr-1">
                      امتیاز کل: {compareLeftKey === 'A' ? solutions.solutionA.metrics.overall : compareLeftKey === 'B' ? solutions.solutionB.metrics.overall : solutions.solutionC.metrics.overall}٪
                    </span>
                  </div>

                  <SettlementCanvas
                    state={compareLeftKey === 'A' ? solutions.solutionA : compareLeftKey === 'B' ? solutions.solutionB : solutions.solutionC}
                    activeStage={activeStage}
                    selectedUnitId={selectedUnitId}
                    selectedCoreId={selectedCoreId}
                    onSelectUnit={setSelectedUnitId}
                    onSelectCore={setSelectedCoreId}
                    params={params}
                    onChangeParams={handleParamsChange}
                    onImport={handleImport}
                    onDeleteUnit={handleDeleteUnit}
                    onDeleteCore={handleDeleteCore}
                    onChangeUnitUsage={handleChangeUnitUsage}
                    onToggleCourtyardCell={handleToggleCourtyardCell}
                    onToggleEntranceCell={handleToggleEntranceCell}
                    onTogglePublicSpaceCell={handleTogglePublicSpaceCell}
                    onClearEntrances={handleClearEntrances}
                    onClearPublicSpaces={handleClearPublicSpaces}
                    onUndo={handleUndo}
                    hasUndo={historyStack.length > 0}
                    isComparePane={true}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    pitch={pitch}
                    setPitch={setPitch}
                    yaw={yaw}
                    setYaw={setYaw}
                    zoom={zoom}
                    setZoom={setZoom}
                    pan={pan}
                    setPan={setPan}
                    selectedFloorFilter={selectedFloorFilter}
                    setSelectedFloorFilter={setSelectedFloorFilter}
                    containerOpacity={containerOpacity}
                    setContainerOpacity={setContainerOpacity}
                  />
                </div>

                {/* SECOND COMPARISON VIEWPORT (LEFT SIDE VISUALLY IN RTL) */}
                <div className="flex-1 h-1/2 md:h-full min-w-0 flex flex-col relative">
                  <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 bg-[#FDFCFB]/90 backdrop-blur-xs px-2.5 py-1.5 border border-[#D9D4CF] shadow-sm rounded-sm select-none" dir="rtl">
                    <span className="text-[10px] text-[#2D2926] font-bold">بخش چپ:</span>
                    <select
                      value={compareRightKey}
                      onChange={(e) => setCompareRightKey(e.target.value as 'A' | 'B' | 'C')}
                      className="bg-white border border-[#D9D4CF] text-[10.5px] font-bold text-[#2D2926] py-0.5 px-2.5 rounded-xs focus:outline-none focus:border-[#E65100] cursor-pointer"
                    >
                      <option value="A">طرح الف (سهولت پیاده)</option>
                      <option value="B">طرح ب (توسعه لبه‌ای)</option>
                      <option value="C">طرح ج (تعادل بهینه چندهدفه)</option>
                    </select>
                    <span className="text-[10px] font-black text-[#E65100] border-r border-[#D9D4CF] pr-2 mr-1">
                      امتیاز کل: {compareRightKey === 'A' ? solutions.solutionA.metrics.overall : compareRightKey === 'B' ? solutions.solutionB.metrics.overall : solutions.solutionC.metrics.overall}٪
                    </span>
                  </div>

                  <SettlementCanvas
                    state={compareRightKey === 'A' ? solutions.solutionA : compareRightKey === 'B' ? solutions.solutionB : solutions.solutionC}
                    activeStage={activeStage}
                    selectedUnitId={selectedUnitId}
                    selectedCoreId={selectedCoreId}
                    onSelectUnit={setSelectedUnitId}
                    onSelectCore={setSelectedCoreId}
                    params={params}
                    onChangeParams={handleParamsChange}
                    onImport={handleImport}
                    onDeleteUnit={handleDeleteUnit}
                    onDeleteCore={handleDeleteCore}
                    onChangeUnitUsage={handleChangeUnitUsage}
                    onToggleCourtyardCell={handleToggleCourtyardCell}
                    onToggleEntranceCell={handleToggleEntranceCell}
                    onTogglePublicSpaceCell={handleTogglePublicSpaceCell}
                    onClearEntrances={handleClearEntrances}
                    onClearPublicSpaces={handleClearPublicSpaces}
                    onUndo={handleUndo}
                    hasUndo={historyStack.length > 0}
                    isComparePane={true}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    pitch={pitch}
                    setPitch={setPitch}
                    yaw={yaw}
                    setYaw={setYaw}
                    zoom={zoom}
                    setZoom={setZoom}
                    pan={pan}
                    setPan={setPan}
                    selectedFloorFilter={selectedFloorFilter}
                    setSelectedFloorFilter={setSelectedFloorFilter}
                    containerOpacity={containerOpacity}
                    setContainerOpacity={setContainerOpacity}
                  />
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full min-h-0 relative">
                <SettlementCanvas
                  state={settlement || solutions.solutionC}
                  activeStage={activeStage}
                  selectedUnitId={selectedUnitId}
                  selectedCoreId={selectedCoreId}
                  onSelectUnit={setSelectedUnitId}
                  onSelectCore={setSelectedCoreId}
                  params={params}
                  onChangeParams={handleParamsChange}
                  onImport={handleImport}
                  onDeleteUnit={handleDeleteUnit}
                  onDeleteCore={handleDeleteCore}
                  onChangeUnitUsage={handleChangeUnitUsage}
                  onToggleCourtyardCell={handleToggleCourtyardCell}
                  onToggleEntranceCell={handleToggleEntranceCell}
                  onTogglePublicSpaceCell={handleTogglePublicSpaceCell}
                  onClearEntrances={handleClearEntrances}
                  onClearPublicSpaces={handleClearPublicSpaces}
                  onUndo={handleUndo}
                  hasUndo={historyStack.length > 0}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  editMode={editMode}
                  setEditMode={setEditMode}
                  pitch={pitch}
                  setPitch={setPitch}
                  yaw={yaw}
                  setYaw={setYaw}
                  zoom={zoom}
                  setZoom={setZoom}
                  pan={pan}
                  setPan={setPan}
                  selectedFloorFilter={selectedFloorFilter}
                  setSelectedFloorFilter={setSelectedFloorFilter}
                  containerOpacity={containerOpacity}
                  setContainerOpacity={setContainerOpacity}
                  onOpenCourtyardValidator={() => setIsCourtyardValidatorOpen(true)}
                />
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-b-[#E65100] mb-3" />
              <p className="text-[11px] text-[#8B8378]">در حال شبیه‌سازی موازی ترازهای مورفوژنتیک کلاسترها...</p>
            </div>
          )}
        </div>

      </div>

      {/* 5. DIAGNOSTICS REPORT MODAL OVERLAY */}
      {settlement && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          state={settlement}
          params={params}
        />
      )}

      {/* 5.5. SCREENSHOT EXPORT MODAL OVERLAY */}
      {settlement && (
        <ExportScreenshotModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          state={settlement}
          params={params}
          solutions={solutions || undefined}
        />
      )}

      {/* 5.6. COURTYARD PLACEMENT VALIDATOR MODAL OVERLAY */}
      {settlement && (
        <CourtyardValidatorModal
          isOpen={isCourtyardValidatorOpen}
          onClose={() => setIsCourtyardValidatorOpen(false)}
          state={settlement}
          onCleanInvalidCourtyards={handleCleanInvalidCourtyards}
        />
      )}
    </div>
  );
}
