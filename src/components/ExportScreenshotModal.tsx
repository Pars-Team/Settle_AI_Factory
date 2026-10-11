/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Camera, Printer, Table, Layers, 
  Award, Compass, CheckCircle2, ChevronLeft, 
  Info, Sparkles, Sliders, LayoutGrid
} from 'lucide-react';
import { SettlementState, GenerationParams, MultiSolutionSet } from '../types';
import { isCellInSiteBoundary, generateMultiSolutionSet } from '../generator';
import { ThreeJSRenderer } from './ThreeJSRenderer';

interface ExportScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SettlementState;
  params: GenerationParams;
  solutions?: MultiSolutionSet;
}

export default function ExportScreenshotModal({ isOpen, onClose, state, params, solutions }: ExportScreenshotModalProps) {
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'blueprint'>('light');
  const [include3D, setInclude3D] = useState<boolean>(true); // Enabled by default for rich 3D PDF appendix
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showReferenceOverlay, setShowReferenceOverlay] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'solA' | 'solB' | 'solC'>('all');

  // Compute multi-solution set (A, B, C) if not provided as prop
  const activeSolutions = useMemo(() => {
    if (solutions) return solutions;
    if (params) return generateMultiSolutionSet(params);
    return null;
  }, [solutions, params]);

  const solA = activeSolutions?.solutionA || state;
  const solB = activeSolutions?.solutionB || state;
  const solC = activeSolutions?.solutionC || state;

  // Set document title dynamically whenever modal is open so browser PDF print dialog picks up automatic filename
  useEffect(() => {
    if (!isOpen) return;
    const originalTitle = document.title;
    const count = state?.units?.length || 0;
    const seed = params?.seed ?? 0;
    const autoFilename = `Units_${count}_Seed_${seed}`;
    
    document.title = autoFilename;

    return () => {
      document.title = originalTitle;
    };
  }, [isOpen, state?.units?.length, params?.seed]);

  // Pre-calculate boundary check map once to avoid ray-casting inside hot render loops
  const inBoundsMap = useMemo(() => {
    if (!state) return [];
    const { gridWidth, gridHeight, siteShape } = state;
    const map: boolean[][] = [];
    const activeBoundaryPoints = params?.customBoundaryPoints || [];
    for (let x = 0; x < gridWidth; x++) {
      map[x] = [];
      for (let y = 0; y < gridHeight; y++) {
        map[x][y] = isCellInSiteBoundary(x, y, gridWidth, gridHeight, siteShape, activeBoundaryPoints);
      }
    }
    return map;
  }, [state?.gridWidth, state?.gridHeight, state?.siteShape, params?.customBoundaryPoints]);

  if (!isOpen) return null;

  const { gridWidth, gridHeight, cores, units, courtyards, paths, metrics, siteShape, terrainType } = state;

  // General metrics calculations
  const totalHouseholds = units.length;
  const maxFloor = Math.max(...units.map(u => u.level), 0) + 1;
  const singlesCount = units.filter(u => u.type === 'single').length;
  const mediumsCount = units.filter(u => u.type === 'medium').length;
  const largesCount = units.filter(u => u.type === 'large').length;
  const totalArea = units.reduce((acc, u) => acc + u.area, 0);

  // Translate terrain types to Persian
  const getTerrainNameFa = (t: typeof terrainType) => {
    const map: Record<string, string> = {
      flat: 'اراضی کاملاً مسطح و هموار دشت',
      sloped: 'اراضی شیب‌دار کوهپایه‌ای شرق به غرب',
      sloped_n: 'شیب طبیعی ملایم رو به شمال',
      sloped_s: 'شیب طبیعی ملایم رو به جنوب (آفتاب‌گیر)',
      sloped_e: 'شیب طبیعی ملایم رو به شرق',
      sloped_w: 'شیب طبیعی ملایم رو به غرب',
      sloped_ne: 'شیب طبیعی ترکیبی شمال‌شرقی',
      sloped_se: 'شیب طبیعی ترکیبی جنوب‌شرقی',
      sloped_sw: 'شیب طبیعی ترکیبی جنوب‌غربی',
      sloped_nw: 'شیب طبیعی ترکیبی شمال‌غربی',
      terraced: 'سکوبندی پله‌پله فلات کوهستانی',
      valley: 'خط گودی قعر دره روان‌آب طبیعی',
      coastal: 'ساحل ممتد در مجاورت پهنه رودخانه'
    };
    return map[t] || t;
  };

  // Translate site shape to Persian
  const getShapeFa = (s: typeof siteShape) => {
    switch (s) {
      case 'rectangular': return 'مستطیل همگون مرزبندی منظم';
      case 'irregular': return 'چندضلعی ناپایدار عوارض طبیعی';
      case 'skewed': return 'زمین قناس و غیرگونیا (ذوزنقه‌ای شهری)';
      case 'custom_boundary': return 'ترسیم دستی اختصاصی کاربر';
      default: return s;
    }
  };

  const getQualityLabel = (score: number) => {
    if (score >= 80) return { text: 'بسیار عالی و استاندارد طلایی', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if (score >= 60) return { text: 'مطلوب و بهینه فضایی', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { text: 'نیازمند اصلاح توزیع هسته‌ها', color: 'text-rose-600 bg-rose-50 border-rose-200' };
  };

  // Trigger browser print dialog with AUTOMATIC FILENAME based on unit count and seed
  const handlePrint = () => {
    const count = totalHouseholds || state?.units?.length || 0;
    const seed = params?.seed ?? 0;
    const pdfName = `Units_${count}_Seed_${seed}`;
    
    document.title = pdfName;
    
    requestAnimationFrame(() => {
      window.print();
    });
  };

  // High-fidelity 2D map renderer for any solution state (A, B, C or current state)
  const render2DFloorPlan = (
    targetState: SettlementState = state, 
    floorLvl: number | 'all' = 'all', 
    isPrintTarget: boolean = false,
    keyPrefix: string = 'sol'
  ) => {
    const tGridWidth = targetState.gridWidth || gridWidth;
    const tGridHeight = targetState.gridHeight || gridHeight;
    const tUnits = targetState.units || [];
    const tCores = targetState.cores || [];
    const tCourtyards = targetState.courtyards || [];
    const tPaths = targetState.paths || [];
    const tPublicSpaces = targetState.publicSpaces || [];
    const tEntrances = targetState.entrances || [];

    const cellSize = 10;
    const padding = 12;
    const w = tGridWidth * cellSize + padding * 2;
    const h = tGridHeight * cellSize + padding * 2;

    const activeBoundaryPoints = params.customBoundaryPoints || [];
    const floorUnits = floorLvl === 'all' ? tUnits : tUnits.filter(u => u.level === floorLvl);
    
    // Transparent ground overlay reference opacity on upper levels
    const contextOpacity = floorLvl === 'all' ? 0.35 : (floorLvl === 0 ? 0.8 : (showReferenceOverlay ? 0.16 : 0));

    // Get theme class for vector objects
    const getVectorColors = () => {
      if (!isPrintTarget && themeMode === 'dark') {
        return {
          gridDot: '#444444',
          maskFill: '#151311',
          boundaryStroke: '#E65100',
          pathStroke: '#555555',
          coreFill: '#1E293B',
          coreStroke: '#ffffff',
          scaleText: 'text-gray-400 bg-[#2D2926]/90 border-[#444444]'
        };
      } else if (!isPrintTarget && themeMode === 'blueprint') {
        return {
          gridDot: 'rgba(255,255,255,0.15)',
          maskFill: '#0b1d3d',
          boundaryStroke: '#38bdf8',
          pathStroke: '#1e3a8a',
          coreFill: '#38bdf8',
          coreStroke: '#0f172a',
          scaleText: 'text-blue-100 bg-[#1e293b]/90 border-blue-900'
        };
      }
      return {
        gridDot: '#D9D4CF',
        maskFill: '#F3F1EC',
        boundaryStroke: '#E65100',
        pathStroke: '#9CA3AF',
        coreFill: '#334155',
        coreStroke: '#ffffff',
        scaleText: 'text-[#2D2926] bg-white/95 border-[#D9D4CF]'
      };
    };

    const vColors = getVectorColors();

    return (
      <div className="relative w-full h-full flex items-center justify-center bg-transparent">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full max-h-[100%] max-w-[100%]" style={{ imageRendering: 'crisp-edges' }}>
          <defs>
            <pattern id={`dots-pattern-${keyPrefix}-${floorLvl}-${isPrintTarget}`} width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.65" fill={vColors.gridDot} opacity="0.6" />
            </pattern>
            <pattern id={`public-plaza-${keyPrefix}-${floorLvl}-${isPrintTarget}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill={(!isPrintTarget && themeMode === 'blueprint') ? 'rgba(56,189,248,0.1)' : '#FEF3C7'} opacity="0.5" />
              <line x1="0" y1="0" x2="0" y2="5" stroke={(!isPrintTarget && themeMode === 'blueprint') ? '#38bdf8' : '#F59E0B'} strokeWidth="0.6" opacity="0.35" />
            </pattern>
            <pattern id={`grey-hatch-${keyPrefix}-${floorLvl}-${isPrintTarget}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#F3F4F6" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="#9CA3AF" strokeWidth="0.8" opacity="0.4" />
            </pattern>
            <pattern id={`courtyard-garden-${keyPrefix}-${floorLvl}-${isPrintTarget}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
              <rect width="4" height="4" fill={(!isPrintTarget && themeMode === 'blueprint') ? 'rgba(56,189,248,0.05)' : '#ECFDF5'} opacity="0.5" />
              <line x1="0" y1="0" x2="0" y2="4" stroke={(!isPrintTarget && themeMode === 'blueprint') ? '#38bdf8' : '#10B981'} strokeWidth="0.5" opacity="0.35" />
            </pattern>
            <pattern id={`obstacle-hatch-${keyPrefix}-${floorLvl}-${isPrintTarget}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="#FEE2E2" opacity={(!isPrintTarget && themeMode === 'dark') ? 0.15 : 0.6} />
              <line x1="0" y1="0" x2="0" y2="4" stroke="#EF4444" strokeWidth="0.8" opacity="0.4" />
            </pattern>
          </defs>

          {/* Grid Paper dots background */}
          {showGrid && (
            <rect x={padding} y={padding} width={tGridWidth * cellSize} height={tGridHeight * cellSize} fill={`url(#dots-pattern-${keyPrefix}-${floorLvl}-${isPrintTarget})`} />
          )}

          {/* 1. Draw Outside Boundary Masking */}
          {(() => {
            const masks = [];
            for (let x = 0; x < tGridWidth; x++) {
              for (let y = 0; y < tGridHeight; y++) {
                const isIn = isCellInSiteBoundary(x, y, tGridWidth, tGridHeight, targetState.siteShape, activeBoundaryPoints);
                if (!isIn) {
                  masks.push(
                    <rect
                      key={`mask-${x}-${y}`}
                      x={x * cellSize + padding}
                      y={y * cellSize + padding}
                      width={cellSize}
                      height={cellSize}
                      fill={vColors.maskFill}
                      opacity={(!isPrintTarget && themeMode === 'blueprint') ? 0.8 : 0.65}
                    />
                  );
                }
              }
            }
            return masks;
          })()}

          {/* 2. Obstacles */}
          {params.obstacles?.map((obs, idx) => (
            <rect
              key={`obs-${idx}`}
              x={obs.x * cellSize + padding}
              y={obs.y * cellSize + padding}
              width={cellSize}
              height={cellSize}
              fill={`url(#obstacle-hatch-${keyPrefix}-${floorLvl}-${isPrintTarget})`}
              stroke="#FCA5A5"
              strokeWidth="0.4"
            />
          ))}

          {/* 3. Courtyards */}
          {tCourtyards.map((court, idx) => (
            <g key={`court-g-${idx}`} opacity={contextOpacity}>
              {court.gridCoords.map((coord, cIdx) => (
                <rect
                  key={`court-cell-${idx}-${cIdx}`}
                  x={coord.x * cellSize + padding}
                  y={coord.y * cellSize + padding}
                  width={cellSize}
                  height={cellSize}
                  fill={`url(#courtyard-garden-${keyPrefix}-${floorLvl}-${isPrintTarget})`}
                  stroke={(!isPrintTarget && themeMode === 'blueprint') ? '#38bdf8' : '#A7F3D0'}
                  strokeWidth="0.3"
                />
              ))}
            </g>
          ))}

          {/* 4. Public Plazas */}
          {tPublicSpaces.map((ps, idx) => {
            const cx = ps.x * cellSize + padding;
            const cy = ps.y * cellSize + padding;
            return (
              <g key={`ps-${idx}`} opacity={contextOpacity}>
                <rect
                  x={cx}
                  y={cy}
                  width={cellSize}
                  height={cellSize}
                  fill={`url(#public-plaza-${keyPrefix}-${floorLvl}-${isPrintTarget})`}
                  stroke={(!isPrintTarget && themeMode === 'blueprint') ? '#38bdf8' : '#F59E0B'}
                  strokeWidth="0.5"
                />
                <text
                  x={cx + cellSize / 2}
                  y={cy + cellSize / 2 + 1.2}
                  fill={(!isPrintTarget && themeMode === 'blueprint') ? '#38bdf8' : '#B45309'}
                  fontSize="4.5"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  H
                </text>
              </g>
            );
          })}

          {/* 5. Linear Pathways */}
          {tPaths.map((path, idx) => {
            const pts = path.coords.map(c => `${c.x * cellSize + cellSize/2 + padding},${c.y * cellSize + cellSize/2 + padding}`).join(' ');
            return (
              <polyline
                key={`path-${idx}`}
                points={pts}
                fill="none"
                stroke={(!isPrintTarget && themeMode === 'blueprint') ? '#38bdf8' : vColors.pathStroke}
                strokeWidth={path.type === 'primary' ? 2.6 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={contextOpacity}
              />
            );
          })}

          {/* 6. Cores */}
          {tCores.map((core, idx) => {
            let minCoreX = 999, maxCoreX = -999, minCoreY = 999, maxCoreY = -999;
            core.gridCoords.forEach((c: any) => {
              if (c.x < minCoreX) minCoreX = c.x;
              if (c.x > maxCoreX) maxCoreX = c.x;
              if (c.y < minCoreY) minCoreY = c.y;
              if (c.y > maxCoreY) maxCoreY = c.y;
            });
            const sizeX = maxCoreX - minCoreX + 1;
            const sizeY = maxCoreY - minCoreY + 1;

            const cx = minCoreX * cellSize + padding;
            const cy = minCoreY * cellSize + padding;
            const cw = sizeX * cellSize;
            const ch = sizeY * cellSize;

            return (
              <g key={`core-2d-${idx}`} opacity={floorLvl === 'all' ? 0.75 : 0.95}>
                <rect
                  x={cx + 0.6}
                  y={cy + 0.6}
                  width={cw - 1.2}
                  height={ch - 1.2}
                  fill={vColors.coreFill}
                  stroke={vColors.coreStroke}
                  strokeWidth="0.6"
                />
                <line x1={cx + 1} y1={cy + 1} x2={cx + cw - 1} y2={cy + ch - 1} stroke={vColors.coreStroke} strokeWidth="0.4" opacity="0.6" />
                <line x1={cx + cw - 1} y1={cy + 1} x2={cx + 1} y2={cy + ch - 1} stroke={vColors.coreStroke} strokeWidth="0.4" opacity="0.6" />
              </g>
            );
          })}

          {/* 7. Units */}
          {floorUnits.map((unit) => {
            const xs = unit.gridCoords.map(c => c.x);
            const ys = unit.gridCoords.map(c => c.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const uw = maxX - minX + 1;
            const uh = maxY - minY + 1;

            const cx = minX * cellSize + padding;
            const cy = minY * cellSize + padding;
            const cw = uw * cellSize;
            const ch = uh * cellSize;

            const uColor = (!isPrintTarget && themeMode === 'blueprint') ? 'none' : (unit.color || '#3b82f6');
            const sColor = (!isPrintTarget && themeMode === 'blueprint') ? '#60a5fa' : '#ffffff';

            const isUpperLvl = unit.level > 0;
            const borderDash = isUpperLvl && floorLvl === 'all' ? '2,1.5' : undefined;
            const finalOpacity = floorLvl === 'all' ? (unit.level === 0 ? 0.55 : unit.level === 1 ? 0.82 : 1) : 1;

            return (
              <g key={`unit-2d-${unit.id}`} opacity={finalOpacity}>
                <rect
                  x={cx + 0.5}
                  y={cy + 0.5}
                  width={cw - 1.0}
                  height={ch - 1.0}
                  fill={uColor}
                  stroke={sColor}
                  strokeWidth={(!isPrintTarget && themeMode === 'blueprint') ? "0.6" : "0.5"}
                  strokeDasharray={borderDash}
                  rx="1"
                />
                
                {unit.level > 0 && floorLvl === 'all' && (
                  <g transform={`translate(${cx + cw/2}, ${cy + ch/2})`}>
                    <circle r="3" fill="#2D2926" />
                    <text textAnchor="middle" y="1.0" fill="#fff" fontSize="3.2" fontWeight="bold">+{unit.level}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 8. Labels inside units */}
          {floorLvl !== 'all' && (!isPrintTarget && themeMode === 'blueprint' ? false : true) && floorUnits.map((unit) => {
            const xs = unit.gridCoords.map(c => c.x);
            const ys = unit.gridCoords.map(c => c.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const uw = maxX - minX + 1;
            const uh = maxY - minY + 1;

            const tx = (minX + uw / 2) * cellSize + padding;
            const ty = (minY + uh / 2) * cellSize + padding + 1.2;

            const letterMap = { single: 'S', medium: 'M', large: 'L' };
            const label = letterMap[unit.type] || 'U';

            return (
              <text
                key={`unit-lbl-${unit.id}`}
                x={tx}
                y={ty}
                fill="#FFFFFF"
                fontSize="4"
                fontWeight="900"
                textAnchor="middle"
                className="select-none pointer-events-none"
              >
                {label}
              </text>
            );
          })}

          {/* 9. Site Entrances */}
          {(floorLvl === 'all' || floorLvl === 0) && tEntrances.map((ent, idx) => {
            const cx = ent.x * cellSize + padding;
            const cy = ent.y * cellSize + padding;
            return (
              <g key={`ent-marker-${idx}`} opacity={contextOpacity}>
                <rect
                  x={cx + 0.5}
                  y={cy + 0.5}
                  width={cellSize - 1.0}
                  height={cellSize - 1.0}
                  fill={`url(#grey-hatch-${keyPrefix}-${floorLvl}-${isPrintTarget})`}
                  stroke="#4B5563"
                  strokeWidth="0.5"
                />
                <text
                  x={cx + cellSize/2}
                  y={cy + cellSize/2 + 1.3}
                  fill="#1F2937"
                  fontSize="4.5"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  E
                </text>
              </g>
            );
          })}

          {/* 10. Site Boundary Line */}
          {(() => {
            if (activeBoundaryPoints.length < 2) {
              return (
                <rect
                  x={padding}
                  y={padding}
                  width={tGridWidth * cellSize}
                  height={tGridHeight * cellSize}
                  fill="none"
                  stroke={vColors.boundaryStroke}
                  strokeWidth="1.2"
                  strokeDasharray="4 2"
                />
              );
            }
            const pointsStr = activeBoundaryPoints.map(pt => `${pt.x * cellSize + padding},${pt.y * cellSize + padding}`).join(' ');
            return (
              <g>
                <polygon
                  points={pointsStr}
                  fill="none"
                  stroke={(!isPrintTarget && themeMode === 'dark') ? '#2D2926' : '#ffffff'}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polygon
                  points={pointsStr}
                  fill="none"
                  stroke={vColors.boundaryStroke}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4.5 2.5"
                />
              </g>
            );
          })()}
        </svg>

        {/* Scaled Legend Overlay */}
        <div className={`absolute bottom-1 right-1 px-2 py-0.8 border rounded-2xs text-[7px] font-mono flex items-center gap-1.5 shadow-2xs backdrop-blur-xs ${vColors.scaleText}`}>
          <span className="font-sans font-bold">شمال ↑</span>
          <span className="w-px h-2 bg-gray-200"></span>
          <span>پلان ۱:۳۰۰</span>
        </div>
      </div>
    );
  };

  // High-Resolution 3D isometric renderer wrapper
  const renderIsometricView = (targetState: SettlementState = state, isPrintTarget: boolean = false) => {
    return (
      <div className={`relative w-full ${isPrintTarget ? 'h-full min-h-[140mm]' : 'h-[250px]'} border border-[#D9D4CF]/60 flex items-center justify-center overflow-hidden bg-[#FDFCFB]`}>
        <div className="absolute top-1.5 left-2 text-[7.5px] font-mono opacity-50 z-10 text-gray-500">THREE.JS HIGH-RES 3D RENDER</div>
        <ThreeJSRenderer state={targetState} width={isPrintTarget ? 1600 : 900} height={isPrintTarget ? 1200 : 675} />
      </div>
    );
  };

  // Technical specs table
  const renderSpecsTable = () => (
    <div className="border border-[#D9D4CF] overflow-hidden rounded-2xs text-[10.5px]">
      <table className="w-full text-right border-collapse">
        <tbody>
          <tr className="border-b border-[#D9D4CF] bg-[#F7F5F2]">
            <td className="p-2 font-extrabold text-gray-500 w-[38%] border-l border-[#D9D4CF]">شناسه بذر طرح</td>
            <td className="p-2 font-mono font-bold text-[#E65100]">#{params.seed ?? 0}</td>
          </tr>
          <tr className="border-b border-[#D9D4CF]">
            <td className="p-2 font-extrabold text-gray-500 border-l border-[#D9D4CF]">تعداد خانوار تحت پوشش</td>
            <td className="p-2 font-bold text-[#2D2926]">{totalHouseholds} خانوار</td>
          </tr>
          <tr className="border-b border-[#D9D4CF] bg-[#F7F5F2]">
            <td className="p-2 font-extrabold text-gray-500 border-l border-[#D9D4CF]">تعداد طبقات مسکونی</td>
            <td className="p-2 font-bold text-[#2D2926]">{maxFloor} طبقه (همکف + {maxFloor - 1} طبقه فوقانی)</td>
          </tr>
          <tr className="border-b border-[#D9D4CF]">
            <td className="p-2 font-extrabold text-gray-500 border-l border-[#D9D4CF]">مجموع مساحت زیربنا</td>
            <td className="p-2 font-mono font-bold text-[#2D2926]">{totalArea} مترمربع</td>
          </tr>
          <tr className="border-b border-[#D9D4CF] bg-[#F7F5F2]">
            <td className="p-2 font-extrabold text-gray-500 border-l border-[#D9D4CF]">نوع توپوگرافی بستر</td>
            <td className="p-2 font-bold text-gray-700 text-[10px] leading-tight">{getTerrainNameFa(terrainType)}</td>
          </tr>
          <tr className="border-b border-[#D9D4CF]">
            <td className="p-2 font-extrabold text-gray-500 border-l border-[#D9D4CF]">فرمول هندسه محدوده</td>
            <td className="p-2 font-bold text-gray-700 text-[10px] leading-tight">{getShapeFa(siteShape)}</td>
          </tr>
          <tr>
            <td className="p-2 font-extrabold text-gray-500 border-l border-[#D9D4CF]">ترکیب متراژ واحدها</td>
            <td className="p-2 space-y-1 text-[9.5px]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#2563EB] inline-block rounded-3xs"></span>
                <span>تک‌خواب ({params.singleProp}%): <strong>{singlesCount} واحد</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#EA580C] inline-block rounded-3xs"></span>
                <span>متوسط ({params.mediumProp}%): <strong>{mediumsCount} واحد</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#16A34A] inline-block rounded-3xs"></span>
                <span>بزرگ ({params.largeProp}%): <strong>{largesCount} واحد</strong></span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // Quality metrics dashboard
  const renderQualityMetrics = () => {
    const overallLabel = getQualityLabel(metrics.overall);
    return (
      <div className="border border-[#D9D4CF] p-3.5 bg-[#FDFCFB] rounded-2xs space-y-3 text-[10.5px]">
        <div className="flex justify-between items-center pb-2 border-b border-[#D9D4CF]/60">
          <div>
            <span className="text-[9px] text-[#8B8378] font-bold block">امتیاز انطباق فضایی کانون:</span>
            <strong className="text-xs font-serif font-black text-[#E65100] block mt-0.5">{metrics.overall}٪ از ۱۰۰</strong>
          </div>
          <span className={`text-[8.5px] font-bold px-1.5 py-0.5 border rounded-3xs ${overallLabel.color}`}>
            {overallLabel.text}
          </span>
        </div>

        <div className="space-y-2.5">
          {[
            { label: 'شاخص سهولت دسترسی پیاده (Walkability)', val: metrics.walkability, color: 'bg-blue-600' },
            { label: 'کارایی خطوط لوله و مهندسی تاسیسات (MEP)', val: metrics.infrastructureEfficiency, color: 'bg-orange-600' },
            { label: 'کیفیت تناسب میانسرا و سایه‌اندازی (Courtyards)', val: metrics.courtyardQuality, color: 'bg-amber-500' },
            { label: 'پتانسیل توسعه پذیری کانون ارگانیک (Expansion)', val: metrics.expansionPotential, color: 'bg-emerald-600' }
          ].map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="flex justify-between text-[9.5px] text-gray-600">
                <span className="font-bold">{item.label}</span>
                <strong className="font-mono font-bold text-[#2D2926]">{item.val}٪</strong>
              </div>
              <div className="w-full h-1 bg-gray-100 overflow-hidden rounded-full">
                <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Helper to render printable pages for a specific candidate solution (Option A, B, or C)
  const renderCandidateSolutionPrintPages = (
    sol: SettlementState, 
    optionNameFa: string, 
    optionCode: string, 
    badgeColor: string, 
    keyPrefix: string
  ) => {
    const solUnits = sol.units || [];
    const lvl0Count = solUnits.filter(u => u.level === 0).length;
    const lvl1Count = solUnits.filter(u => u.level === 1).length;
    const lvl2Count = solUnits.filter(u => u.level === 2).length;

    return (
      <>
        {/* Page: Master Site Plan */}
        <div className="print-page w-[297mm] h-[209.5mm] border-box bg-white flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-center pb-3 border-b-2 border-[#2D2926] h-[35px] shrink-0">
            <div className="flex items-center gap-2">
              <span className={`${badgeColor} text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-3xs tracking-wider`}>
                {optionCode} • MASTER PLAN
              </span>
              <h1 className="font-serif font-black text-xs text-[#2D2926]">
                {optionNameFa} - پلان چیدمان سراسری کانون اسکان
              </h1>
            </div>
            <div className="text-left font-mono text-[7.5px] text-gray-400 space-y-0.2">
              <div>بذر شبیه‌سازی: <strong className="text-[#E65100] font-bold">#{params.seed ?? 0}</strong></div>
              <div>واحدها: {solUnits.length} کانتینر | امتیاز: {sol.metrics?.overall}%</div>
            </div>
          </div>

          <div className="h-[148mm] w-full flex items-center justify-center py-2 shrink-0">
            <div className="w-full h-full flex items-center justify-center">
              {render2DFloorPlan(sol, 'all', true, `${keyPrefix}-master`)}
            </div>
          </div>

          <div className="pt-2 border-t border-[#D9D4CF] flex justify-between items-center text-[7.5px] text-[#8B8378] h-[20px] shrink-0">
            <span>سامانه شبیه‌ساز مورفوژنتیک اسکان موقت • {optionNameFa} (Master Plan)</span>
            <span className="font-mono">SEED: #{params.seed ?? 0} • {solUnits.length} UNITS</span>
          </div>
        </div>

        {/* Page: Level 0 Floor Plan */}
        <div className="print-page w-[297mm] h-[209.5mm] border-box bg-white flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-center pb-3 border-b-2 border-[#2D2926] h-[35px] shrink-0">
            <div className="flex items-center gap-2">
              <span className={`${badgeColor} text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-3xs tracking-wider`}>
                {optionCode} • LEVEL 0
              </span>
              <h1 className="font-serif font-black text-xs text-[#2D2926]">
                {optionNameFa} - پلان تفکیکی تراز همکف (Level 0 Floor Plan)
              </h1>
            </div>
            <div className="text-left font-mono text-[7.5px] text-gray-400 space-y-0.2">
              <div>بذر: <strong className="text-[#E65100] font-bold">#{params.seed ?? 0}</strong></div>
              <div>واحدهای تراز همکف: {lvl0Count} کانتینر</div>
            </div>
          </div>

          <div className="h-[148mm] w-full flex items-center justify-center py-2 shrink-0">
            <div className="w-full h-full flex items-center justify-center">
              {render2DFloorPlan(sol, 0, true, `${keyPrefix}-lvl0`)}
            </div>
          </div>

          <div className="pt-2 border-t border-[#D9D4CF] flex justify-between items-center text-[7.5px] text-[#8B8378] h-[20px] shrink-0">
            <span>سامانه شبیه‌ساز مورفوژنتیک اسکان موقت • {optionNameFa} (Level 0)</span>
            <span className="font-mono">SEED: #{params.seed ?? 0}</span>
          </div>
        </div>

        {/* Page: Level 1 Floor Plan (ONLY rendered if units exist on level 1) */}
        {lvl1Count > 0 && (
          <div className="print-page w-[297mm] h-[209.5mm] border-box bg-white flex flex-col justify-between overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b-2 border-[#2D2926] h-[35px] shrink-0">
              <div className="flex items-center gap-2">
                <span className={`${badgeColor} text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-3xs tracking-wider`}>
                  {optionCode} • LEVEL 1
                </span>
                <h1 className="font-serif font-black text-xs text-[#2D2926]">
                  {optionNameFa} - پلان تفکیکی تراز اول (Level 1 Floor Plan)
                </h1>
              </div>
              <div className="text-left font-mono text-[7.5px] text-gray-400 space-y-0.2">
                <div>بذر: <strong className="text-[#E65100] font-bold">#{params.seed ?? 0}</strong></div>
                <div>واحدهای تراز اول: {lvl1Count} کانتینر</div>
              </div>
            </div>

            <div className="h-[148mm] w-full flex items-center justify-center py-2 shrink-0">
              <div className="w-full h-full flex items-center justify-center">
                {render2DFloorPlan(sol, 1, true, `${keyPrefix}-lvl1`)}
              </div>
            </div>

            <div className="pt-2 border-t border-[#D9D4CF] flex justify-between items-center text-[7.5px] text-[#8B8378] h-[20px] shrink-0">
              <span>سامانه شبیه‌ساز مورفوژنتیک اسکان موقت • {optionNameFa} (Level 1)</span>
              <span className="font-mono">SEED: #{params.seed ?? 0}</span>
            </div>
          </div>
        )}

        {/* Page: Level 2 Floor Plan (ONLY rendered if units exist on level 2) */}
        {lvl2Count > 0 && (
          <div className="print-page w-[297mm] h-[209.5mm] border-box bg-white flex flex-col justify-between overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b-2 border-[#2D2926] h-[35px] shrink-0">
              <div className="flex items-center gap-2">
                <span className={`${badgeColor} text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-3xs tracking-wider`}>
                  {optionCode} • LEVEL 2
                </span>
                <h1 className="font-serif font-black text-xs text-[#2D2926]">
                  {optionNameFa} - پلان تفکیکی تراز دوم (Level 2 Floor Plan)
                </h1>
              </div>
              <div className="text-left font-mono text-[7.5px] text-gray-400 space-y-0.2">
                <div>بذر: <strong className="text-[#E65100] font-bold">#{params.seed ?? 0}</strong></div>
                <div>واحدهای تراز دوم: {lvl2Count} کانتینر</div>
              </div>
            </div>

            <div className="h-[148mm] w-full flex items-center justify-center py-2 shrink-0">
              <div className="w-full h-full flex items-center justify-center">
                {render2DFloorPlan(sol, 2, true, `${keyPrefix}-lvl2`)}
              </div>
            </div>

            <div className="pt-2 border-t border-[#D9D4CF] flex justify-between items-center text-[7.5px] text-[#8B8378] h-[20px] shrink-0">
              <span>سامانه شبیه‌ساز مورفوژنتیک اسکان موقت • {optionNameFa} (Level 2)</span>
              <span className="font-mono">SEED: #{params.seed ?? 0}</span>
            </div>
          </div>
        )}
      </>
    );
  };

  // PORTAL: Render full Landscape A4 Album strictly for physical browser printing
  const printPortalContent = (
    <div id="print-album-root" className="hidden print:block absolute inset-0 bg-white font-sans text-[#2D2926]" dir="rtl">
      
      {/* PAGE 1: شناسنامه فنی و گزارش ارزیابی کیفی اسکان موقت کانون (TEXT ONLY) */}
      <div className="print-page w-[297mm] h-[209.5mm] border-box bg-white flex flex-col justify-between overflow-hidden">
        <div className="flex justify-between items-center pb-3 border-b-2 border-[#2D2926] h-[35px] shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-[#E65100] text-white text-[8px] font-extrabold px-1 py-0.5 rounded-3xs tracking-wider">A4 LANDSCAPE</span>
            <h1 className="font-serif font-black text-xs text-[#2D2926]">بخش ۱: شناسنامه ارزیابی کیفی و مقایسه سه طرح الف، ب و ج</h1>
          </div>
          <div className="text-left font-mono text-[7.5px] text-gray-400 space-y-0.2">
            <div>بذر شبیه‌سازی: <strong className="text-[#E65100] font-bold">#{params.seed ?? 0}</strong></div>
            <div>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
          </div>
        </div>

        <div className="flex gap-6 items-stretch flex-1 min-h-0 py-3">
          {/* Right Column: Specifications and Technical Data */}
          <div className="w-[48%] flex flex-col gap-3">
            <h3 className="text-[11px] font-extrabold text-[#2D2926] flex items-center gap-1.5 shrink-0 border-b pb-1.5 border-[#D9D4CF]">
              <Table size={12} className="text-[#E65100]" />
              <span>جدول مشخصات و ظرفیت فنی کلاسترها</span>
            </h3>
            {renderSpecsTable()}
            
            <div className="border border-[#D9D4CF]/60 p-3 bg-[#FDFCFB] rounded-2xs space-y-1.5 mt-auto text-[9.5px] text-gray-500 leading-relaxed">
              <strong className="text-[#2D2926] font-bold block text-[10px]">💡 راهنمای کلاسترینگ و مدولار سازی:</strong>
              <p>
                این کانون بر اساس الگوریتم‌های ژنتیکی و با توجه به معیارهای دسترسی به هسته‌های ارتباطی عمودی، همجواری فضاهای همگانی (H)، موقعیت ورودی‌های اصلی محوطه (E) و پهنه‌بندی توپوگرافیک طراحی گردیده است.
              </p>
            </div>
          </div>

          {/* Left Column: Metrics and Comparison of Options A, B, C */}
          <div className="w-[52%] flex flex-col gap-3">
            <h3 className="text-[11px] font-extrabold text-[#2D2926] flex items-center gap-1.5 shrink-0 border-b pb-1.5 border-[#D9D4CF]">
              <Award size={12} className="text-[#E65100]" />
              <span>مقایسه کیفی سه طرح پیشنهادی (الف، ب، ج)</span>
            </h3>
            
            <div className="space-y-2 text-[10px]">
              {/* Option A Card */}
              <div className="p-2.5 border border-blue-200 bg-blue-50/40 rounded-2xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-blue-900">طرح الف (پاسخگویی و دسترسی حداکثری)</span>
                  <span className="font-mono font-bold text-blue-700">{solA.metrics?.overall}% امتیاز</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[9px] text-gray-600">
                  <div>• سهولت دسترسی: <strong className="text-blue-800">{solA.metrics?.walkability}%</strong></div>
                  <div>• تاسیسات MEP: <strong>{solA.metrics?.infrastructureEfficiency}%</strong></div>
                </div>
              </div>

              {/* Option B Card */}
              <div className="p-2.5 border border-amber-200 bg-amber-50/40 rounded-2xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-900">طرح ب (پتانسیل توسعه ارگانیک)</span>
                  <span className="font-mono font-bold text-amber-700">{solB.metrics?.overall}% امتیاز</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[9px] text-gray-600">
                  <div>• توسعه‌پذیری: <strong className="text-amber-800">{solB.metrics?.expansionPotential}%</strong></div>
                  <div>• کیفیت میانسرا: <strong>{solB.metrics?.courtyardQuality}%</strong></div>
                </div>
              </div>

              {/* Option C Card */}
              <div className="p-2.5 border border-emerald-200 bg-emerald-50/40 rounded-2xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-emerald-900">طرح ج (توازن جامع - چیدمان برتر)</span>
                  <span className="font-mono font-bold text-emerald-700">{solC.metrics?.overall}% امتیاز</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[9px] text-gray-600">
                  <div>• امتیاز کل: <strong className="text-emerald-800">{solC.metrics?.overall}%</strong></div>
                  <div>• دسترسی: <strong>{solC.metrics?.walkability}%</strong></div>
                </div>
              </div>
            </div>

            <div className="border border-[#D9D4CF]/60 p-2.5 bg-[#FDFCFB] rounded-2xs text-[8.5px] text-gray-500 mt-auto">
              <span className="font-bold text-[#E65100] block text-[9px]">📋 آلبوم شامل پلان‌های کامل هر سه طرح:</span>
              <p className="mt-0.5">نقشه‌های دوبعدی تمام طبقات (همکف، اول، دوم) به همراه مسترپلان هر سه طرح الف، ب و ج در صفحات بعدی پیوست شده‌اند.</p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-[#D9D4CF] flex justify-between items-center text-[7.5px] text-[#8B8378] h-[20px] shrink-0">
          <span>سامانه شبیه‌ساز مورفوژنتیک اسکان موقت مدولار • مهندسین مشاور تراز</span>
          <span className="font-mono">GEN_HASH: S_{params.seed ?? 0}_{totalHouseholds}F</span>
        </div>
      </div>

      {/* Pages for OPTION A (طرح الف) */}
      {renderCandidateSolutionPrintPages(solA, 'طرح الف (دسترسی حداکثری)', 'طرح الف', 'bg-blue-600', 'solA')}

      {/* Pages for OPTION B (طرح ب) */}
      {renderCandidateSolutionPrintPages(solB, 'طرح ب (توسعه ارگانیک)', 'طرح ب', 'bg-orange-600', 'solB')}

      {/* Pages for OPTION C (طرح ج) */}
      {renderCandidateSolutionPrintPages(solC, 'طرح ج (توازن جامع)', 'طرح ج', 'bg-emerald-600', 'solC')}

      {/* Page: HIGH-RES 3D ISOMETRIC RENDER APPENDIX */}
      {include3D && (
        <div className="print-page w-[297mm] h-[209.5mm] border-box bg-white flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-center pb-3 border-b-2 border-[#2D2926] h-[35px] shrink-0">
            <div className="flex items-center gap-2">
              <span className="bg-[#E65100] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-3xs tracking-wider">
                3D HIGH-RES APPENDIX
              </span>
              <h1 className="font-serif font-black text-xs text-[#2D2926]">
                پیوست آلبوم: رندر سه بعدی پرسپکتیو با کیفیت بالا (High-Resolution 3D Render)
              </h1>
            </div>
            <div className="text-left font-mono text-[7.5px] text-gray-400 space-y-0.2">
              <div>بذر: <strong className="text-[#E65100] font-bold">#{params.seed ?? 0}</strong></div>
              <div>نورپردازی جهت‌دار و سایه‌های نرم ۴K</div>
            </div>
          </div>

          <div className="h-[148mm] w-full flex items-center justify-center py-2 shrink-0">
            <div className="w-full h-full border border-[#D9D4CF]/60 rounded-xs overflow-hidden shadow-xs flex items-center justify-center">
              {renderIsometricView(solC, true)}
            </div>
          </div>

          <div className="pt-2 border-t border-[#D9D4CF] flex justify-between items-center text-[7.5px] text-[#8B8378] h-[20px] shrink-0">
            <span>سامانه شبیه‌ساز مورفوژنتیک اسکان موقت • نمای سه بعدی پرسپکتیو ایزومتریک</span>
            <span className="font-mono">SEED: #{params.seed ?? 0}</span>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2926]/40 p-4 backdrop-blur-xs transition-all overflow-y-auto" dir="rtl">
      
      {/* On-Screen Shell Container */}
      <div className="relative w-full max-w-6xl bg-[#F6F5F2] shadow-2xl flex flex-col md:flex-row max-h-[92vh] overflow-hidden border border-[#D9D4CF] rounded-sm select-none">
        
        {/* LEFT SIDEBAR: Controls */}
        <div className="w-full md:w-80 bg-white border-l border-[#D9D4CF] p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D9D4CF]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#E65100]/10 text-[#E65100] rounded-xs">
                  <Camera size={15} />
                </div>
                <h3 className="font-serif font-extrabold text-xs text-[#2D2926]">خروجی آلبوم PDF کامل</h3>
              </div>
              <button 
                onClick={onClose}
                className="p-1 border border-gray-200 hover:bg-gray-100 transition rounded-xs cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            {/* Automatic Filename Info */}
            <div className="bg-[#E65100]/5 border border-[#E65100]/20 p-3 rounded-xs space-y-1.5">
              <span className="text-[10px] font-bold text-[#E65100] block flex items-center gap-1">
                <Sparkles size={11} />
                <span>نام‌گذاری خودکار فایل PDF:</span>
              </span>
              <p className="text-[9.5px] font-mono text-[#2D2926] bg-white p-1.5 border border-gray-200 rounded-2xs text-center font-bold">
                Units_{totalHouseholds}_Seed_{params.seed ?? 0}.pdf
              </p>
              <p className="text-[8.5px] text-[#4A443F] leading-relaxed">
                هنگام ذخیره به عنوان PDF، این نام به طور هوشمند و خودکار بر روی فایل خروجی اعمال خواهد شد.
              </p>
            </div>

            {/* Layout Toggles */}
            <div className="space-y-2">
              <label className="text-[9.5px] font-bold text-gray-500 block">پیکربندی آلبوم خروجی:</label>
              
              <div className="space-y-2">
                {/* 3D view toggle */}
                <div className="flex items-center justify-between p-2 bg-[#FDFCFB] border border-gray-100 rounded-xs">
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-gray-700">شامل رندر سه بعدی با کیفیت بالا</span>
                    <span className="text-[8px] text-gray-400">به عنوان پیوست آلبوم با سایه‌پردازی ۴K</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={include3D} 
                    onChange={(e) => setInclude3D(e.target.checked)} 
                    className="w-3.5 h-3.5 accent-[#E65100] cursor-pointer"
                  />
                </div>

                {/* Ground Reference overlay toggle */}
                <div className="flex items-center justify-between p-2 bg-[#FDFCFB] border border-gray-100 rounded-xs">
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-gray-700">ترسیم پس‌زمینه طبقات فوقانی</span>
                    <span className="text-[8px] text-gray-400">نمایش کمرنگ راه‌ها و میانسراها</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showReferenceOverlay} 
                    onChange={(e) => setShowReferenceOverlay(e.target.checked)} 
                    className="w-3.5 h-3.5 accent-[#E65100] cursor-pointer"
                  />
                </div>

                {/* Grid toggle switch */}
                <div className="flex items-center justify-between p-2 bg-[#FDFCFB] border border-gray-100 rounded-xs">
                  <span className="text-[9.5px] font-bold text-gray-700">نمایش خطوط شطرنجی پس‌زمینه</span>
                  <input 
                    type="checkbox" 
                    checked={showGrid} 
                    onChange={(e) => setShowGrid(e.target.checked)} 
                    className="w-3.5 h-3.5 accent-[#E65100] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Quick theme selector for screen preview */}
            <div className="space-y-1.5">
              <label className="text-[9.5px] font-bold text-gray-500 block">تم بصری پیش‌نمایش مانیتور:</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'light', name: '🎨 روشن' },
                  { id: 'dark', name: '🕶️ تاریک' },
                  { id: 'blueprint', name: '📐 آبی' }
                ].map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => setThemeMode(theme.id as any)}
                    className={`py-1 text-[8.5px] font-bold border transition rounded-xs cursor-pointer text-center ${
                      themeMode === theme.id
                        ? 'bg-[#2D2926] text-white border-[#2D2926]'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklist of inclusions */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xs space-y-1.5">
              <span className="text-[9.5px] font-extrabold text-gray-600 block flex items-center gap-1">
                <Sliders size={11} className="text-[#E65100]" />
                <span>محتوای کامل پی دی اف خروجی:</span>
              </span>
              <div className="space-y-1 text-[9px] text-gray-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} className="text-emerald-500" />
                  <span>صفحه ۱: ارزیابی مقایسه‌ای سه طرح الف، ب، ج</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} className="text-[#2563EB]" />
                  <span>طرح الف: پلان تمام طبقات (Master + L0, L1, L2)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} className="text-[#EA580C]" />
                  <span>طرح ب: پلان تمام طبقات (Master + L0, L1, L2)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} className="text-[#16A34A]" />
                  <span>طرح ج: پلان تمام طبقات (Master + L0, L1, L2)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} className="text-amber-500" />
                  <span>رندر سه بعدی ایزومتریک با کیفیت بالا</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-1.5 pt-4 border-t border-gray-200">
            <button
              onClick={handlePrint}
              className="w-full py-2.5 px-3 bg-[#E65100] hover:bg-[#D84315] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-orange-700/10 rounded-xs"
            >
              <Printer size={13} />
              <span>دانلود / دریافت PDF با نام هوشمند</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 px-3 bg-white border border-[#D9D4CF] hover:bg-gray-50 text-[#8B8378] font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer rounded-xs"
            >
              <span>بازگشت به شبیه‌ساز</span>
              <ChevronLeft size={12} />
            </button>
          </div>
        </div>

        {/* RIGHT PREVIEW CANVAS */}
        <div className="flex-1 bg-[#D9D4CF]/35 p-6 overflow-y-auto space-y-6 select-text flex flex-col items-center">
          
          <div className="text-center space-y-2 py-1 shrink-0 w-full max-w-4xl">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-extrabold text-gray-700 flex items-center gap-1">
                <Sparkles size={12} className="text-[#E65100]" />
                <span>پیش‌نمایش زنده پلان‌ها و آلبوم PDF</span>
              </h4>

              {/* Tab Selector for Preview */}
              <div className="flex bg-white border border-gray-300 p-0.5 rounded-2xs text-[9px] font-bold">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2 py-0.5 rounded-3xs transition cursor-pointer ${
                    activeTab === 'all' ? 'bg-[#2D2926] text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  همه صفحات
                </button>
                <button
                  onClick={() => setActiveTab('solA')}
                  className={`px-2 py-0.5 rounded-3xs transition cursor-pointer ${
                    activeTab === 'solA' ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  طرح الف
                </button>
                <button
                  onClick={() => setActiveTab('solB')}
                  className={`px-2 py-0.5 rounded-3xs transition cursor-pointer ${
                    activeTab === 'solB' ? 'bg-orange-600 text-white' : 'text-orange-700 hover:bg-orange-50'
                  }`}
                >
                  طرح ب
                </button>
                <button
                  onClick={() => setActiveTab('solC')}
                  className={`px-2 py-0.5 rounded-3xs transition cursor-pointer ${
                    activeTab === 'solC' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  طرح ج
                </button>
              </div>
            </div>
          </div>

          {/* PREVIEW SHEET 1: Specs & Report */}
          {(activeTab === 'all') && (
            <div className={`relative w-full max-w-4xl aspect-[297/210] shadow-xl p-6 flex flex-col justify-between overflow-hidden border border-[#D9D4CF]/60 rounded-xs bg-white text-[#2D2926]`}>
              <div className="flex justify-between items-center pb-3 border-b-2 border-[#2D2926] gap-3 shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#E65100] text-white text-[7.5px] font-extrabold px-1.2 py-0.2 rounded-3xs">PAGE 1</span>
                    <h1 className="font-serif font-black text-[12.5px]">شناسنامه ارزیابی کیفی و مقایسه سه طرح الف، ب و ج</h1>
                  </div>
                  <p className="text-[9px] text-gray-500">گزارش توجیهی و معیارهای ارزیابی کیفی استقرار مورفولوژیک</p>
                </div>
                <div className="text-left font-mono text-[8px] text-gray-400 space-y-0.2">
                  <div>DATE: {new Date().toLocaleDateString('fa-IR')}</div>
                  <div>SEED ID: <strong className="text-[#E65100] font-bold">#{params.seed ?? 0}</strong></div>
                </div>
              </div>

              <div className="flex gap-5 items-stretch flex-1 min-h-0 py-3">
                <div className="w-[50%] flex flex-col justify-between gap-2 overflow-hidden text-[#2D2926]">
                  <div className="space-y-1.5">
                    <h3 className="text-[9.5px] font-extrabold flex items-center gap-1 text-[#2D2926]">
                      <Table size={10} className="text-[#E65100]" />
                      <span>جدول مشخصات و ظرفیت فنی کلاسترها</span>
                    </h3>
                    {renderSpecsTable()}
                  </div>
                </div>

                <div className="w-[50%] flex flex-col justify-between gap-2 overflow-hidden text-[#2D2926]">
                  <div className="space-y-1.5">
                    <h3 className="text-[9.5px] font-extrabold flex items-center gap-1 text-[#2D2926]">
                      <Award size={10} className="text-[#E65100]" />
                      <span>ارزیابی کیفی و مقایسه سه طرح</span>
                    </h3>
                    {renderQualityMetrics()}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#D9D4CF] flex justify-between items-center text-[7.5px] text-gray-400 shrink-0">
                <span>سامانه شبیه‌ساز مورفوژنتیک اسکان موقت مدولار • مهندسین مشاور تراز</span>
                <span className="font-mono">Units_{totalHouseholds}_Seed_{params.seed ?? 0}</span>
              </div>
            </div>
          )}

          {/* PREVIEW SHEETS FOR OPTION A */}
          {(activeTab === 'all' || activeTab === 'solA') && (
            <div className="w-full max-w-4xl space-y-4">
              <div className="flex items-center gap-2 border-b border-blue-300 pb-1 text-blue-900 font-extrabold text-xs">
                <LayoutGrid size={14} className="text-blue-600" />
                <span>طرح الف (پاسخگویی و دسترسی حداکثری - Walkability)</span>
              </div>
              <div className={`relative w-full aspect-[297/210] shadow-xl p-6 flex flex-col justify-between overflow-hidden border border-blue-200 rounded-xs ${
                themeMode === 'dark' ? 'bg-[#151311] text-white' : (themeMode === 'blueprint' ? 'bg-[#0f2a5c] text-blue-100' : 'bg-white text-[#2D2926]')
              }`}>
                <div className="flex justify-between items-center pb-2 border-b-2 border-blue-600">
                  <span className="font-extrabold text-xs">طرح الف - مسترپلان کلی کلاسترها (Master Plan)</span>
                  <span className="font-mono text-[9px]">امتیاز: {solA.metrics?.overall}%</span>
                </div>
                <div className="flex-1 py-3 flex items-center justify-center">
                  <div className="w-[92%] h-[92%]">
                    {render2DFloorPlan(solA, 'all', false, 'prev-solA-master')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW SHEETS FOR OPTION B */}
          {(activeTab === 'all' || activeTab === 'solB') && (
            <div className="w-full max-w-4xl space-y-4">
              <div className="flex items-center gap-2 border-b border-orange-300 pb-1 text-orange-900 font-extrabold text-xs">
                <LayoutGrid size={14} className="text-orange-600" />
                <span>طرح ب (پتانسیل توسعه ارگانیک - Expansion)</span>
              </div>
              <div className={`relative w-full aspect-[297/210] shadow-xl p-6 flex flex-col justify-between overflow-hidden border border-orange-200 rounded-xs ${
                themeMode === 'dark' ? 'bg-[#151311] text-white' : (themeMode === 'blueprint' ? 'bg-[#0f2a5c] text-blue-100' : 'bg-white text-[#2D2926]')
              }`}>
                <div className="flex justify-between items-center pb-2 border-b-2 border-orange-600">
                  <span className="font-extrabold text-xs">طرح ب - مسترپلان کلی کلاسترها (Master Plan)</span>
                  <span className="font-mono text-[9px]">امتیاز: {solB.metrics?.overall}%</span>
                </div>
                <div className="flex-1 py-3 flex items-center justify-center">
                  <div className="w-[92%] h-[92%]">
                    {render2DFloorPlan(solB, 'all', false, 'prev-solB-master')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW SHEETS FOR OPTION C */}
          {(activeTab === 'all' || activeTab === 'solC') && (
            <div className="w-full max-w-4xl space-y-4">
              <div className="flex items-center gap-2 border-b border-emerald-300 pb-1 text-emerald-900 font-extrabold text-xs">
                <LayoutGrid size={14} className="text-emerald-600" />
                <span>طرح ج (توازن جامع مورفوژنتیک - بالاترین امتیاز)</span>
              </div>
              <div className={`relative w-full aspect-[297/210] shadow-xl p-6 flex flex-col justify-between overflow-hidden border border-emerald-200 rounded-xs ${
                themeMode === 'dark' ? 'bg-[#151311] text-white' : (themeMode === 'blueprint' ? 'bg-[#0f2a5c] text-blue-100' : 'bg-white text-[#2D2926]')
              }`}>
                <div className="flex justify-between items-center pb-2 border-b-2 border-emerald-600">
                  <span className="font-extrabold text-xs">طرح ج - مسترپلان کلی کلاسترها (Master Plan)</span>
                  <span className="font-mono text-[9px]">امتیاز: {solC.metrics?.overall}%</span>
                </div>
                <div className="flex-1 py-3 flex items-center justify-center">
                  <div className="w-[92%] h-[92%]">
                    {render2DFloorPlan(solC, 'all', false, 'prev-solC-master')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3D Render Appendix Preview */}
          {include3D && (
            <div className="w-full max-w-4xl space-y-2">
              <div className="flex items-center gap-2 border-b border-gray-300 pb-1 text-gray-800 font-extrabold text-xs">
                <Sparkles size={14} className="text-[#E65100]" />
                <span>پیوست رندر سه بعدی ایزومتریک با کیفیت بالا (High-Resolution 3D Render)</span>
              </div>
              <div className="relative w-full aspect-[297/210] shadow-xl p-6 flex flex-col justify-between overflow-hidden border border-gray-300 rounded-xs bg-white text-[#2D2926]">
                <div className="flex justify-between items-center pb-2 border-b-2 border-[#2D2926]">
                  <span className="font-serif font-extrabold text-xs">نمای پرسپکتیو سه بعدی ایزومتریک با سایه‌های نرم ۴K</span>
                  <span className="font-mono text-[9px]">SEED: #{params.seed ?? 0}</span>
                </div>
                <div className="flex-1 py-2 flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full">
                    {renderIsometricView(solC, false)}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Global Print-Only Overrides Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: 297mm 210mm;
            margin: 0;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #root {
            display: none !important;
          }
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 297mm !important;
            height: auto !important;
            overflow: visible !important;
          }

          #print-album-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          .print-page {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            width: 297mm !important;
            height: 209.5mm !important;
            max-height: 209.5mm !important;
            padding: 10mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          .print-page:last-child, .print-page:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .print-page-break {
            display: none !important;
          }
        }
      `}</style>

      {/* Mount Portal under document.body for pristine print delivery */}
      {createPortal(printPortalContent, document.body)}

    </div>
  );
}
