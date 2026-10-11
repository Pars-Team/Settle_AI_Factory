/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Unit,
  Core,
  Cluster,
  Courtyard,
  Path,
  EvaluationMetrics,
  GridCell,
  SettlementState,
  UnitType,
  CoreType,
  PathType,
  GenerationParams,
  MultiSolutionSet,
  GreenSpace,
  GreenSpaceTier
} from './types';

// Simple GUID-like generator
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Distance helper
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Checks if a unit's touch with a core is present (at any level) and is only partial
 * (a percentage of its side), not full.
 * Only small units ('single', 2x1) can connect to the core with their entire small side (length 1).
 */
function checkCoreConnectionPercentage(
  proposedCells: Array<{ x: number; y: number; level: number }>,
  coreCoords: Array<{ x: number; y: number }>,
  unitType: UnitType,
  widthCells: number,
  heightCells: number
): boolean {
  // Find which of our cells are adjacent to any core cell (at the horizontal level)
  const touchingUnitCells = new Set<string>();
  let touchesCore = false;

  for (const uCell of proposedCells) {
    for (const cCell of coreCoords) {
      const dist = Math.abs(uCell.x - cCell.x) + Math.abs(uCell.y - cCell.y);
      if (dist === 1) {
        touchingUnitCells.add(`${uCell.x},${uCell.y}`);
        touchesCore = true;
      }
    }
  }

  // Requirement 1: Every unit MUST touch its assigned core directly!
  // "هیچ یونیتی بدون دسترسی مستقیم به هسته وجود نداشته باشد."
  if (!touchesCore) return false;

  // Calculate the bounds of the touching cells
  let minX = 999, maxX = -999, minY = 999, maxY = -999;
  touchingUnitCells.forEach(key => {
    const [x, y] = key.split(',').map(Number);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const touchWidth = maxX - minX + 1;
  const touchHeight = maxY - minY + 1;
  const touchLength = Math.max(touchWidth, touchHeight);

  if (unitType === 'single') {
    // Single unit is 2x1. Long side is 2, small side is 1.
    // Small units can connect with their entire small side (length 1), but NOT their entire long side (length 2).
    const longSide = Math.max(widthCells, heightCells);
    const isTouchingLongSide = (widthCells === longSide && touchWidth > 1) || (heightCells === longSide && touchHeight > 1);
    if (isTouchingLongSide && touchLength === longSide) {
      return false; // fully touching along the long side, not allowed
    }
    return true;
  } else {
    // Medium (3x2) or Large (4x2)
    // Must connect with a percentage of one of its sides, not fully.
    // So if touching along width, touchWidth < widthCells. If touching along height, touchHeight < heightCells.
    const isHorizontalTouch = touchWidth > touchHeight;
    const isVerticalTouch = touchHeight > touchWidth;

    if (isHorizontalTouch) {
      if (touchWidth === widthCells) {
        return false; // fully touching along the width, not allowed!
      }
    } else if (isVerticalTouch) {
      if (touchHeight === heightCells) {
        return false; // fully touching along the height, not allowed!
      }
    } else {
      // touchWidth is 1 and touchHeight is 1 (touch of 1 cell)
      // Since width and height of medium/large are both >= 2, a single-cell touch is always a partial touch (< full side), so it's allowed!
      return true;
    }
  }

  return true;
}

/**
 * Ensures that EVERY unit has AT LEAST 2 open outer sides (North, South, East, West)
 * that do NOT touch any other unit, and that placing this proposed unit will NOT
 * cause any existing adjacent neighbor unit's free sides to drop below 2.
 */
function checkUnitFreeSidesConstraint(
  grid: Record<string, GridCell>,
  proposedCells: Array<{ x: number; y: number; level: number }>,
  currentUnitId?: string
): boolean {
  if (proposedCells.length === 0) return true;
  const level = proposedCells[0].level;

  let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
  for (const p of proposedCells) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Counts outer cardinal sides free of contact with OTHER units
  const countFreeSides = (
    uMinX: number, uMaxX: number, uMinY: number, uMaxY: number,
    uLevel: number,
    uId?: string,
    simulatedFootprint?: Array<{ x: number; y: number; level: number }>
  ): number => {
    const simSet = new Set<string>();
    if (simulatedFootprint) {
      simulatedFootprint.forEach(c => {
        if (c.level === uLevel) simSet.add(`${c.x},${c.y}`);
      });
    }

    const cellTouchesOtherUnit = (x: number, y: number): boolean => {
      if (simSet.has(`${x},${y}`)) {
        return uId !== currentUnitId;
      }
      const cell = grid[`${x},${y},${uLevel}`];
      return !!(cell && cell.type === 'unit' && cell.occupiedId !== uId);
    };

    let northFree = true;
    for (let x = uMinX; x <= uMaxX; x++) {
      if (cellTouchesOtherUnit(x, uMinY - 1)) { northFree = false; break; }
    }

    let southFree = true;
    for (let x = uMinX; x <= uMaxX; x++) {
      if (cellTouchesOtherUnit(x, uMaxY + 1)) { southFree = false; break; }
    }

    let westFree = true;
    for (let y = uMinY; y <= uMaxY; y++) {
      if (cellTouchesOtherUnit(uMinX - 1, y)) { westFree = false; break; }
    }

    let eastFree = true;
    for (let y = uMinY; y <= uMaxY; y++) {
      if (cellTouchesOtherUnit(uMaxX + 1, y)) { eastFree = false; break; }
    }

    let free = 0;
    if (northFree) free++;
    if (southFree) free++;
    if (westFree) free++;
    if (eastFree) free++;

    return free;
  };

  // 1. Proposed unit must have at least 2 free sides
  const selfFreeSides = countFreeSides(minX, maxX, minY, maxY, level, currentUnitId);
  if (selfFreeSides < 2) return false;

  // 2. Existing adjacent neighbor units must retain at least 2 free sides
  const adjacentUnitIds = new Set<string>();
  for (let x = minX; x <= maxX; x++) {
    const cellN = grid[`${x},${minY - 1},${level}`];
    if (cellN && cellN.type === 'unit' && cellN.occupiedId) adjacentUnitIds.add(cellN.occupiedId);
    const cellS = grid[`${x},${maxY + 1},${level}`];
    if (cellS && cellS.type === 'unit' && cellS.occupiedId) adjacentUnitIds.add(cellS.occupiedId);
  }
  for (let y = minY; y <= maxY; y++) {
    const cellW = grid[`${minX - 1},${y},${level}`];
    if (cellW && cellW.type === 'unit' && cellW.occupiedId) adjacentUnitIds.add(cellW.occupiedId);
    const cellE = grid[`${maxX + 1},${y},${level}`];
    if (cellE && cellE.type === 'unit' && cellE.occupiedId) adjacentUnitIds.add(cellE.occupiedId);
  }

  for (const neighborId of adjacentUnitIds) {
    if (neighborId === currentUnitId) continue;
    let nMinX = 9999, nMaxX = -9999, nMinY = 9999, nMaxY = -9999;
    let found = false;
    for (const key in grid) {
      const cell = grid[key];
      if (cell && cell.type === 'unit' && cell.occupiedId === neighborId && cell.level === level) {
        found = true;
        if (cell.x < nMinX) nMinX = cell.x;
        if (cell.x > nMaxX) nMaxX = cell.x;
        if (cell.y < nMinY) nMinY = cell.y;
        if (cell.y > nMaxY) nMaxY = cell.y;
      }
    }
    if (found) {
      const neighborFreeSides = countFreeSides(nMinX, nMaxX, nMinY, nMaxY, level, neighborId, proposedCells);
      if (neighborFreeSides < 2) return false;
    }
  }

  return true;
}

/**
 * Tries to place a unit of size widthCells x heightCells such that it covers target cell (tx, ty) at testL
 */
function tryPlaceUnitAt(
  state: SettlementState,
  core: Core,
  hEntry: { type: UnitType; spec: any },
  tx: number,
  ty: number,
  testL: number,
  params: GenerationParams,
  widthCells: number,
  heightCells: number,
  siteWidth: number,
  siteHeight: number,
  siteShape: string,
  customBoundaryPoints?: Array<{ x: number; y: number }>
): { success: boolean; proposedCells: Array<{ x: number; y: number; level: number }> } {
  // Try all top-left coordinates (ux, uy) such that the unit of widthCells x heightCells covers (tx, ty)
  for (let dxOff = 0; dxOff < widthCells; dxOff++) {
    for (let dyOff = 0; dyOff < heightCells; dyOff++) {
      const ux = tx - dxOff;
      const uy = ty - dyOff;

      let canBuild = true;
      const proposedCells: Array<{ x: number; y: number; level: number }> = [];
      let supportUnder = 0;

      for (let dx = 0; dx < widthCells; dx++) {
        for (let dy = 0; dy < heightCells; dy++) {
          const cx = ux + dx;
          const cy = uy + dy;
          proposedCells.push({ x: cx, y: cy, level: testL });

          // Boundary mask validation
          if (!isCellInSiteBoundary(cx, cy, siteWidth, siteHeight, siteShape, customBoundaryPoints)) {
            canBuild = false;
            break;
          }

          // Grid cell space occupancy check (on active level)
          if (state.grid[`${cx},${cy},${testL}`]) {
            canBuild = false;
            break;
          }

          // Structural Stacking load check: if level >= 1, there must be solid foundation underneath!
          if (testL > 0) {
            const supportCell = state.grid[`${cx},${cy},${testL - 1}`];
            if (supportCell && (supportCell.type === 'unit' || supportCell.type === 'core')) {
              supportUnder++;
            }
          }
        }
        if (!canBuild) break;
      }

      // To stack containers, we require physical support underneath at least 75% of the cells (75% area support rule)
      if (testL > 0 && supportUnder < (widthCells * heightCells) * 0.75) {
        canBuild = false;
      }

      // Spatial Constraint: Distance to parent core seed limit (walking distance constraint)
      const coreCenter = { x: core.x, y: core.y };
      const centerLoc = { x: ux + widthCells / 2, y: uy + heightCells / 2 };
      if (distance(coreCenter, centerLoc) > params.maxWalkDistanceCore) {
        canBuild = false;
      }

      // Slope stability constraint on Sloped Terrain:
      let minSlopeH = 999;
      let maxSlopeH = -999;
      proposedCells.forEach(cell => {
        const hVal = state.terrainZ[`${cell.x},${cell.y}`] || 0;
        if (hVal < minSlopeH) minSlopeH = hVal;
        if (hVal > maxSlopeH) maxSlopeH = hVal;
      });
      if (Math.abs(maxSlopeH - minSlopeH) > 1.4) {
        canBuild = false;
      }

      // Core connection percentage constraint:
      if (canBuild && !checkCoreConnectionPercentage(proposedCells, core.gridCoords, hEntry.type, widthCells, heightCells)) {
        canBuild = false;
      }

      // Requirement: Every unit must have at least 2 open outer sides not touching any other unit
      if (canBuild && !checkUnitFreeSidesConstraint(state.grid, proposedCells)) {
        canBuild = false;
      }

      // Requirement: Cluster separation - units of core must not touch or attach to other clusters
      if (canBuild && !checkClusterSeparationConstraint(state, proposedCells, core.id)) {
        canBuild = false;
      }

      if (canBuild) {
        return { success: true, proposedCells };
      }
    }
  }

  return { success: false, proposedCells: [] };
}

/**
 * Ensures that proposed unit cells do NOT touch or attach to any unit or core belonging to a different cluster.
 */
function checkClusterSeparationConstraint(
  state: SettlementState,
  proposedCells: Array<{ x: number; y: number; level: number }>,
  currentCoreId: string
): boolean {
  for (const cell of proposedCells) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        
        for (let l = 0; l <= Math.max(2, cell.level); l++) {
          const occ = state.grid[`${nx},${ny},${l}`];
          if (occ) {
            if (occ.type === 'unit') {
              const otherUnit = state.units.find(u => u.id === occ.occupiedId);
              if (otherUnit && otherUnit.coreId !== currentCoreId) {
                return false; // Touches or is adjacent to another cluster!
              }
            } else if (occ.type === 'core') {
              if (occ.occupiedId !== currentCoreId) {
                return false; // Touches another cluster's core!
              }
            } else if (occ.type === 'entrance') {
              return false; // Cannot block core entrance corridor
            }
          }
        }
      }
    }
  }
  return true;
}

/**
 * Creates a ground floor entrance on 20% of one of the longer sides of each core,
 * and preserves an open, unobstructed access pathway leading to it.
 */
function createCoreGroundEntrances(
  state: SettlementState,
  siteWidth: number,
  siteHeight: number
) {
  state.entrances = state.entrances || [];

  state.cores.forEach(core => {
    let minX = 999, maxX = -999, minY = 999, maxY = -999;
    core.gridCoords.forEach(c => {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    });

    const W = maxX - minX + 1;
    const H = maxY - minY + 1;

    const longSideLen = Math.max(W, H);
    const entranceLen = Math.max(1, Math.round(longSideLen * 0.20));

    let faceCells: Array<{ x: number; y: number }> = [];
    let dirX = 0;
    let dirY = 0;

    if (W >= H) {
      // Long side is horizontal
      const midX = minX + Math.floor((W - entranceLen) / 2);
      const isNorth = minY > siteHeight / 2;
      const yFace = isNorth ? minY - 1 : maxY + 1;
      dirY = isNorth ? -1 : 1;

      for (let i = 0; i < entranceLen; i++) {
        faceCells.push({ x: midX + i, y: yFace });
      }
    } else {
      // Long side is vertical
      const midY = minY + Math.floor((H - entranceLen) / 2);
      const isWest = minX > siteWidth / 2;
      const xFace = isWest ? minX - 1 : maxX + 1;
      dirX = isWest ? -1 : 1;

      for (let i = 0; i < entranceLen; i++) {
        faceCells.push({ x: xFace, y: midY + i });
      }
    }

    faceCells.forEach(facePt => {
      const entId = `entrance-${core.id}-${facePt.x}-${facePt.y}`;
      state.entrances!.push({ id: entId, x: facePt.x, y: facePt.y });

      // Extend access corridor outward
      let cx = facePt.x;
      let cy = facePt.y;
      const corridorLength = 6;

      for (let step = 0; step < corridorLength; step++) {
        if (cx < 0 || cx >= siteWidth || cy < 0 || cy >= siteHeight) break;

        const key = `${cx},${cy},0`;
        state.grid[key] = {
          x: cx,
          y: cy,
          level: 0,
          type: 'entrance',
          occupiedId: entId
        };

        cx += dirX;
        cy += dirY;
      }
    });
  });
}

/**
 * Tries to place one available household unit from householdsList next to core to cover cell (tx, ty)
 */
function tryToPlaceToCover(
  state: SettlementState,
  core: Core,
  tx: number,
  ty: number,
  level: number,
  householdsList: Array<{ type: UnitType; spec: any }>,
  coreUnitCounts: Record<string, number>,
  params: GenerationParams,
  siteWidth: number,
  siteHeight: number,
  siteShape: string,
  customBoundaryPoints?: Array<{ x: number; y: number }>,
  preferredType?: UnitType
): boolean {
  if (coreUnitCounts[core.id] >= core.capacity) return false;

  const indices: number[] = [];
  if (preferredType) {
    for (let i = 0; i < householdsList.length; i++) {
      if (householdsList[i].type === preferredType) indices.push(i);
    }
  }
  for (let i = 0; i < householdsList.length; i++) {
    if (!indices.includes(i)) indices.push(i);
  }

  for (const i of indices) {
    const hEntry = householdsList[i];
    
    // Determine size based on type
    let widthCells = 2;
    let heightCells = 1;
    if (hEntry.type === 'medium') {
      widthCells = 3;
      heightCells = 2;
    } else if (hEntry.type === 'large') {
      widthCells = 4;
      heightCells = 2;
    }

    // Try normal orientation
    let res = tryPlaceUnitAt(
      state,
      core,
      hEntry,
      tx,
      ty,
      level,
      params,
      widthCells,
      heightCells,
      siteWidth,
      siteHeight,
      siteShape,
      customBoundaryPoints
    );

    // Try rotated orientation
    if (!res.success) {
      res = tryPlaceUnitAt(
        state,
        core,
        hEntry,
        tx,
        ty,
        level,
        params,
        heightCells,
        widthCells,
        siteWidth,
        siteHeight,
        siteShape,
        customBoundaryPoints
      );
    }

    if (res.success) {
      const uId = `unit-${generateId()}`;
      const newUnit: Unit = {
        id: uId,
        type: hEntry.type,
        capacity: hEntry.spec.capacity,
        area: hEntry.spec.area,
        containerCount: hEntry.spec.containerCount,
        color: unitColors[hEntry.type],
        nameFa: hEntry.spec.nameFa,
        nameEn: hEntry.spec.nameEn,
        level,
        coreId: core.id,
        gridCoords: res.proposedCells,
        adjacencyPreference: hEntry.spec.adjEn,
        adjacencyPreferenceFa: hEntry.spec.adjFa
      };

      state.units.push(newUnit);
      
      // Write details into grid
      res.proposedCells.forEach(pt => {
        state.grid[`${pt.x},${pt.y},${pt.level}`] = {
          x: pt.x,
          y: pt.y,
          level: pt.level,
          type: 'unit',
          occupiedId: uId
        };
      });

      coreUnitCounts[core.id]++;
      householdsList.splice(i, 1);
      return true;
    }
  }

  return false;
}

/**
 * Enforces core surroundings according to user requirements on each floor level
 */
function enforceCoreSurroundings(
  state: SettlementState,
  core: Core,
  householdsList: Array<{ type: UnitType; spec: any }>,
  coreUnitCounts: Record<string, number>,
  params: GenerationParams,
  siteWidth: number,
  siteHeight: number,
  siteShape: string,
  customBoundaryPoints?: Array<{ x: number; y: number }>
) {
  let minCoreX = 999, maxCoreX = -999, minCoreY = 999, maxCoreY = -999;
  core.gridCoords.forEach(c => {
    if (c.x < minCoreX) minCoreX = c.x;
    if (c.x > maxCoreX) maxCoreX = c.x;
    if (c.y < minCoreY) minCoreY = c.y;
    if (c.y > maxCoreY) maxCoreY = c.y;
  });

  const W = maxCoreX - minCoreX + 1;
  const H = maxCoreY - minCoreY + 1;

  for (let l = 0; l < params.maxFloors; l++) {
    if (coreUnitCounts[core.id] >= core.capacity) continue;

    const northCells: Array<{ x: number; y: number }> = [];
    for (let x = minCoreX; x <= maxCoreX; x++) northCells.push({ x, y: maxCoreY + 1 });

    const southCells: Array<{ x: number; y: number }> = [];
    for (let x = minCoreX; x <= maxCoreX; x++) southCells.push({ x, y: minCoreY - 1 });

    const eastCells: Array<{ x: number; y: number }> = [];
    for (let y = minCoreY; y <= maxCoreY; y++) eastCells.push({ x: maxCoreX + 1, y });

    const westCells: Array<{ x: number; y: number }> = [];
    for (let y = minCoreY; y <= maxCoreY; y++) westCells.push({ x: minCoreX - 1, y });

    let largeFaces: Array<Array<{ x: number; y: number }>> = [];
    let smallFaces: Array<Array<{ x: number; y: number }>> = [];

    if (W >= H) {
      largeFaces = [northCells, southCells];
      smallFaces = [eastCells, westCells];
    } else {
      largeFaces = [eastCells, westCells];
      smallFaces = [northCells, southCells];
    }

    const isOccupiedByCoreUnit = (x: number, y: number) => {
      const cell = state.grid[`${x},${y},${l}`];
      if (cell && cell.type === 'unit') {
        const unit = state.units.find(u => u.id === cell.occupiedId);
        return unit && unit.coreId === core.id;
      }
      return false;
    };

    if (l === 0) {
      // Ground Floor Exception: At least 1 and at most 2 small ('single') units connected to core on ground floor!
      const existingSmallGround = state.units.filter(u => u.coreId === core.id && u.level === 0 && u.type === 'single').length;
      let neededSmall = Math.max(0, 1 - existingSmallGround);

      if (neededSmall > 0) {
        for (const face of [...smallFaces, ...largeFaces]) {
          if (neededSmall <= 0) break;
          for (const pt of face) {
            if (!isOccupiedByCoreUnit(pt.x, pt.y)) {
              const placed = tryToPlaceToCover(
                state, core, pt.x, pt.y, l, householdsList, coreUnitCounts, params, siteWidth, siteHeight, siteShape, customBoundaryPoints, 'single'
              );
              if (placed) {
                neededSmall--;
                break;
              }
            }
          }
        }
      }

      // Fill ground floor faces prioritizing large (heavy) units
      for (const face of smallFaces) {
        for (const pt of face) {
          if (!isOccupiedByCoreUnit(pt.x, pt.y)) {
            tryToPlaceToCover(state, core, pt.x, pt.y, l, householdsList, coreUnitCounts, params, siteWidth, siteHeight, siteShape, customBoundaryPoints, 'large');
          }
        }
      }

      for (const face of largeFaces) {
        for (const pt of face) {
          if (!isOccupiedByCoreUnit(pt.x, pt.y)) {
            tryToPlaceToCover(state, core, pt.x, pt.y, l, householdsList, coreUnitCounts, params, siteWidth, siteHeight, siteShape, customBoundaryPoints, 'large');
          }
        }
      }
    } else {
      // Level > 0:
      // "در باقی طبقات از تمام جهات باید به یونیت ها متصل باشه و هیچ وجه هسته نباید بدون اتصال باقی بمونه"
      // Each of the 4 faces must have at least one unit connected
      const faces = [northCells, southCells, eastCells, westCells];
      for (const face of faces) {
        const isConnected = face.some(pt => isOccupiedByCoreUnit(pt.x, pt.y));
        if (!isConnected) {
          for (const pt of face) {
            const success = tryToPlaceToCover(state, core, pt.x, pt.y, l, householdsList, coreUnitCounts, params, siteWidth, siteHeight, siteShape, customBoundaryPoints);
            if (success) break;
          }
        }
      }
    }
  }
}

/**
 * Checks if a grid coordinate lies within the chosen site shape boundaries.
 */
export function isCellInSiteBoundary(
  x: number,
  y: number,
  width: number,
  height: number,
  shape: string,
  customBoundaryPoints?: Array<{ x: number; y: number }>
): boolean {
  // Enforce setback buffer from site borders so layout stays away from edges
  if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) return false;
  
  if (shape === 'custom_boundary' && customBoundaryPoints && customBoundaryPoints.length >= 3) {
    // Point-in-Polygon (PIP) ray casting algorithm
    let inside = false;
    for (let i = 0, j = customBoundaryPoints.length - 1; i < customBoundaryPoints.length; j = i++) {
      const xi = customBoundaryPoints[i].x, yi = customBoundaryPoints[i].y;
      const xj = customBoundaryPoints[j].x, yj = customBoundaryPoints[j].y;
      
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi + 0.000001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  if (shape === 'rectangular' || shape === 'irregular') {
    return true;
  }
  
  if (shape === 'skewed') {
    // Skewed / Trapezoidal plot (زمین قناس) with oblique angle
    const rightLimit = (width - 2) - Math.floor((y / height) * (width * 0.32));
    if (x < 2 || x >= rightLimit || y < 2 || y >= height - 2) return false;
    if (x + y < Math.floor(width * 0.22)) return false;
    return true;
  }
  
  if (shape === 'custom_boundary') {
    // If we have custom boundary points, PIP ray casting was already evaluated above.
    // If we have no points yet, we can fallback to true so the grid is fully active for custom drawing.
    return true;
  }
  
  return true;
}

/**
 * Calculates terrain elevation Z scaled from 0 to 4 levels for cell (x, y)
 */
export function getTerrainHeight(x: number, y: number, width: number, height: number, terrainType: string): number {
  if (terrainType === 'flat') {
    return 0;
  }
  
  if (terrainType.startsWith('sloped')) {
    let val = 0.5;
    if (terrainType === 'sloped_n') val = (height - 1 - y) / height;
    else if (terrainType === 'sloped_s') val = y / height;
    else if (terrainType === 'sloped_e') val = x / width;
    else if (terrainType === 'sloped_w') val = (width - 1 - x) / width;
    else if (terrainType === 'sloped_ne') val = (x / width + (height - 1 - y) / height) / 2;
    else if (terrainType === 'sloped_se') val = (x / width + y / height) / 2;
    else if (terrainType === 'sloped_sw') val = ((width - 1 - x) / width + y / height) / 2;
    else if (terrainType === 'sloped_nw') val = ((width - 1 - x) / width + (height - 1 - y) / height) / 2;
    else val = (x / width + y / height) / 2; // default legacy sloped

    return Number((val * 3.2).toFixed(1)); // 0 to 3.2 units elevation
  }
  
  if (terrainType === 'terraced') {
    // Sharp terraced steps
    const progress = (x / width);
    if (progress < 0.25) return 0;
    if (progress < 0.5) return 1.0;
    if (progress < 0.75) return 2.0;
    return 3.0; // 4 clear flats
  }
  
  if (terrainType === 'valley') {
    // Valley: high on left and right, dipping in the middle
    const centerX = width / 2;
    const distToCenter = Math.abs(x - centerX) / (width / 2);
    return Number((Math.pow(distToCenter, 2) * 3).toFixed(1)); // depth up to 3 units
  }
  
  if (terrainType === 'coastal') {
    // Coastal: high land on top-left, sloping down to sandy sea level at bottom-right
    const val = 1.0 - (x / width + y / height) / 2;
    if (val < 0.28) return -0.5; // below water level (sea or sand)
    return Number(((val - 0.28) * 3.5).toFixed(1));
  }
  
  return 0;
}

/**
 * A* Pathfinding implementation.
 * Paths prefer flatter terrains, avoid steep height changes, and avoid modules/structures.
 */
interface AStarNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic cost to end
  f: number; // total cost
  parent: AStarNode | null;
}

export function findPathOnGrid(
  start: { x: number; y: number },
  end: { x: number; y: number },
  occupied: (x: number, y: number) => boolean,
  terrainZ: Record<string, number>,
  width: number,
  height: number
): Array<{ x: number; y: number }> | null {
  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();

  openSet.push({
    x: start.x,
    y: start.y,
    g: 0,
    h: Math.abs(start.x - end.x) + Math.abs(start.y - end.y),
    f: Math.abs(start.x - end.x) + Math.abs(start.y - end.y),
    parent: null
  });

  const getElevation = (x: number, y: number): number => {
    return terrainZ[`${x},${y}`] || 0;
  };

  while (openSet.length > 0) {
    let currentIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIdx].f) {
        currentIdx = i;
      }
    }
    const current = openSet[currentIdx];

    if (current.x === end.x && current.y === end.y) {
      const path: Array<{ x: number; y: number }> = [];
      let temp: AStarNode | null = current;
      while (temp !== null) {
        path.push({ x: temp.x, y: temp.y });
        temp = temp.parent;
      }
      return path.reverse();
    }

    openSet.splice(currentIdx, 1);
    closedSet.add(`${current.x},${current.y}`);

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) {
        continue;
      }

      const key = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(key)) {
        continue;
      }

      const isEnd = neighbor.x === end.x && neighbor.y === end.y;
      if (occupied(neighbor.x, neighbor.y) && !isEnd) {
        continue;
      }

      // Elevation cost: penalize steep slopes heavily (roads don't climb walls)
      const h1 = getElevation(current.x, current.y);
      const h2 = getElevation(neighbor.x, neighbor.y);
      const slopePenalty = Math.pow(Math.abs(h1 - h2), 2) * 12; // massive penalty for climbing ridges
      
      const stepCost = 1.0 + slopePenalty;
      const gScore = current.g + stepCost;

      const existing = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
      if (!existing) {
        const hScore = Math.abs(neighbor.x - end.x) + Math.abs(neighbor.y - end.y);
        openSet.push({
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: hScore,
          f: gScore + hScore,
          parent: current
        });
      } else if (gScore < existing.g) {
        existing.g = gScore;
        existing.f = gScore + existing.h;
        existing.parent = current;
      }
    }
  }

  return null;
}

/**
 * DEFAULT GENERATION PARAMETERS
 */
export const DEFAULT_PARAMS: GenerationParams = {
  siteWidth: 36,
  siteHeight: 36,
  siteShape: 'rectangular',
  terrainType: 'flat',
  demographicMode: 'total',
  totalHouseholds: 60,
  singleProp: 20,
  mediumProp: 50,
  largeProp: 30,
  maxFloors: 2,
  targetDensity: 'medium',
  maxWalkDistanceCore: 8,
  maxWalkDistanceShared: 10,
  preferredClusterSize: 6,
  maxClusterSize: 10,
  courtyardSizeRatio: 20, // 20%
  expansionReserve: 15,   // 15%
  iterations: 80,         // Candidate settlements to generated
  weights: {
    accessibility: 20,
    courtyard: 20,
    infrastructure: 15,
    density: 15,
    clustering: 15,
    expansion: 15
  }
};

const unitColors = {
  single: '#3b82f6', // Bright Steel Blue
  medium: '#f97316', // Rusty Clay Orange
  large: '#10b981'  // Oxide Cyan-Green
};

const unitSpecs = {
  single: {
    capacity: 2,
    area: 15,
    containerCount: 1,
    nameEn: 'Single Household',
    nameFa: 'واحد تک‌خانواده (۱ کانتینر)',
    adjFa: 'در جوار هسته کوچک و نزدیک پیاده‌راه‌ها',
    adjEn: 'Adjacent to mini cores and close to pedestrian paths'
  },
  medium: {
    capacity: 4,
    area: 30,
    containerCount: 2,
    nameEn: 'Medium Family',
    nameFa: 'واحد خانواده متوسط (۲ کانتینر)',
    adjFa: 'در مجاورت حیاط‌های اشتراکی',
    adjEn: 'Adjacent to communal courtyards'
  },
  large: {
    capacity: 6,
    area: 45,
    containerCount: 3,
    nameEn: 'Large Family',
    nameFa: 'واحد خانواده بزرگ (۳ کانتینر)',
    adjFa: 'طبقه همکف، با ارتباط به هسته‌های بزرگ',
    adjEn: 'Ground levels with pathways to major cores'
  }
};

/**
 * GENERATES A SINGLE SOLUTION CANDIDATE
 * Uses a strict bottom-up morphogenetic approach, constrained by terrain and site shape.
 * Growth goes: Seeds -> Growth (Units) -> Clusters -> Courtyards -> Paths -> Synthesis
 */
export function generateSingleCandidate(params: GenerationParams, indexSeed: number, bias: 'walkability' | 'expansion' | 'balanced' = 'balanced'): SettlementState {
  const { siteWidth, siteHeight, siteShape, terrainType, customBoundaryPoints, obstacles } = params;

  const state: SettlementState = {
    gridWidth: siteWidth,
    gridHeight: siteHeight,
    siteShape,
    terrainType,
    cores: [],
    units: [],
    clusters: [],
    courtyards: [],
    entrances: [],
    publicSpaces: [],
    paths: [],
    grid: {},
    terrainZ: {},
    currentStep: 6,
    totalSteps: 6,
    metrics: {
      walkability: 0,
      accessibility: 0,
      clusteringQuality: 0,
      courtyardQuality: 0,
      density: 0,
      expansionPotential: 0,
      infrastructureEfficiency: 0,
      overall: 0
    }
  };

  // Setup terrain grid z-heights & mask water on Coastal
  // (We use indexSeed and math to make iterations stochastically unique)
  const rngRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  let seedVal = indexSeed + 0.17;

  for (let x = 0; x < siteWidth; x++) {
    for (let y = 0; y < siteHeight; y++) {
      const zEle = getTerrainHeight(x, y, siteWidth, siteHeight, terrainType);
      state.terrainZ[`${x},${y}`] = zEle;

      // Mark general terrain obstacles in standard flat grid (e.g., deep water)
      if (terrainType === 'coastal' && zEle < 0) {
        state.grid[`${x},${y},0`] = { x, y, level: 0, type: 'water', occupiedId: 'water-obstacle' };
      }
      
      // If river is present (custom boundary) mark it
      if (siteShape === 'custom_boundary' && (!customBoundaryPoints || customBoundaryPoints.length < 3)) {
        const riverCenter = siteHeight * 0.74 + Math.sin(x / 2.8) * 2.0;
        if (Math.abs(y - riverCenter) < 2.0) {
          state.grid[`${x},${y},0`] = { x, y, level: 0, type: 'water', occupiedId: 'river-obstacle' };
        }
      }
    }
  }

  // Mark user obstacles from params
  if (obstacles && obstacles.length > 0) {
    obstacles.forEach(obs => {
      // Mark all levels (0 to maxFloors) as obstacle to prevent any build and stack
      const floorsHeightLimit = Math.max(2, params.maxFloors);
      for (let l = 0; l <= floorsHeightLimit; l++) {
        state.grid[`${obs.x},${obs.y},${l}`] = { x: obs.x, y: obs.y, level: l, type: 'obstacle', occupiedId: 'user-obstacle' };
      }
    });
  }

  // Determine needed household counts based on demographics mode
  let targetSingles = 0;
  let targetMediums = 0;
  let targetLarges = 0;

  if (params.demographicMode === 'total') {
    // Distribute total households using set percentages (singleProp, mediumProp, largeProp)
    const total = params.totalHouseholds;
    const pSingle = params.singleProp / 100;
    const pMedium = params.mediumProp / 100;
    const pLarge = params.largeProp / 100;

    targetSingles = Math.round(total * pSingle);
    targetMediums = Math.round(total * pMedium);
    targetLarges = Math.max(1, total - (targetSingles + targetMediums)); // guarantee totals match
  } else {
    // Custom ratios calculation
    const norm = params.singleProp + params.mediumProp + params.largeProp;
    const total = params.totalHouseholds;
    targetSingles = Math.round(total * (params.singleProp / norm));
    targetMediums = Math.round(total * (params.mediumProp / norm));
    targetLarges = Math.max(0, total - (targetSingles + targetMediums));
  }

  // Compile full flat list of household requests to grow down to ground seeds
  const householdsList: Array<{ type: UnitType; spec: typeof unitSpecs.single }> = [];
  for (let i = 0; i < targetSingles; i++) householdsList.push({ type: 'single', spec: unitSpecs.single });
  for (let i = 0; i < targetMediums; i++) householdsList.push({ type: 'medium', spec: unitSpecs.medium });
  for (let i = 0; i < targetLarges; i++) householdsList.push({ type: 'large', spec: unitSpecs.large });

  // Sort households list by weight hierarchy: large (heavy) -> medium -> single (light)
  const weightMap: Record<UnitType, number> = { large: 3, medium: 2, single: 1 };
  householdsList.sort((a, b) => weightMap[b.type] - weightMap[a.type]);

  // 1. SEED PHASE (Determine Core placements)
  // Compute how many core seeds are needed based on total built load
  let totalBuiltLoad = householdsList.length;
  // Determine core count dynamically based on the load (1 core per ~10 households, min 1 core, max 10 cores to prevent overcrowding)
  const numCores = Math.max(1, Math.min(10, Math.ceil(totalBuiltLoad / 10)));
  
  const coreSpecs = {
    mini: { capacity: 5, nameFa: 'مینی هسته (پله و منبع آب)', nameEn: 'Mini Core (Stairs & Tank)' },
    cross: { capacity: 12, nameFa: 'هسته صلیبی (آسانسور و موتورخانه)', nameEn: 'Cross Core (Lift & MEP)' },
    courtyard_core: { capacity: 22, nameFa: 'هسته حیاط‌دار (شفت تاسیساتی)', nameEn: 'Courtyard Core (Ventilation Shaft)' }
  };

  const centerX = (siteWidth - 1) / 2;
  const centerY = (siteHeight - 1) / 2;
  const edgeMargin = Math.max(4, Math.floor(Math.min(siteWidth, siteHeight) * 0.16));
  const spanX = Math.max(4, siteWidth - edgeMargin * 2);
  const spanY = Math.max(4, siteHeight - edgeMargin * 2);

  let attempts = 0;
  while (state.cores.length < numCores && attempts < 150) {
    attempts++;
    seedVal += 1.34;
    const rx = Math.floor(rngRandom(seedVal) * spanX) + edgeMargin;
    const ry = Math.floor(rngRandom(seedVal + 0.12) * spanY) + edgeMargin;

    // Reject core seeds that are too far from site center (gravitate settlement based on strategy bias)
    const dCenter = distance({ x: rx, y: ry }, { x: centerX, y: centerY });
    const centerFactor = bias === 'walkability' ? 0.20 : bias === 'expansion' ? 0.34 : 0.26;
    const maxCenterAllowed = Math.min(siteWidth, siteHeight) * (centerFactor + (attempts > 50 ? (attempts - 50) * 0.005 : 0));
    if (dCenter > maxCenterAllowed) continue;

    // Must be in site boundary
    if (!isCellInSiteBoundary(rx, ry, siteWidth, siteHeight, siteShape, customBoundaryPoints)) continue;

    // Check water obstacle
    if (state.grid[`${rx},${ry},0`]?.type === 'water') continue;

    // If Sloped/Coastal/Terraced, avoid placing seeds on extremely steep contour lines if possible!
    const zLeft = state.terrainZ[`${rx - 1},${ry}`] || 0;
    const zRight = state.terrainZ[`${rx + 1},${ry}`] || 0;
    if (Math.abs(zLeft - zRight) > 1.2) continue; // too steep for heavy infrastructure!

    // Ensure core seed has buffer distance to other seed centers
    let tooClose = false;
    const minCoreDist = params.targetDensity === 'high' ? 4.5 : params.targetDensity === 'medium' ? 6.0 : 8.2;
    
    // Core proximity constraint to prevent scattered cores (per user intent: "هسته ها با فاصله ی زیاد از هم چیده نشن")
    let withinRangeOfAtLeastOne = state.cores.length === 0;
    const maxCoreDist = Math.max(12, Math.min(siteWidth, siteHeight) * 0.42) + (attempts > 40 ? (attempts - 40) * 0.5 : 0);

    for (const existing of state.cores) {
      const distToExisting = distance({ x: rx, y: ry }, existing);
      if (distToExisting < minCoreDist) {
        tooClose = true;
        break;
      }
      if (distToExisting <= maxCoreDist) {
        withinRangeOfAtLeastOne = true;
      }
    }

    if (!tooClose && withinRangeOfAtLeastOne) {
      // Pick core seed types stochastically
      const r = rngRandom(seedVal + 0.44);
      const type: CoreType = r < 0.35 ? 'mini' : r < 0.8 ? 'cross' : 'courtyard_core';
      const spec = coreSpecs[type];
      const id = `core-${generateId()}`;

      let coreW = 2;
      let coreH = 1;
      if (type === 'cross') {
        coreW = 3;
        coreH = 2;
      } else if (type === 'courtyard_core') {
        coreW = 4;
        coreH = 2;
      }

      // Random rotation to make layouts organic and non-square
      if (rngRandom(seedVal + 0.65) > 0.5) {
        const temp = coreW;
        coreW = coreH;
        coreH = temp;
      }

      const gridCoords: Array<{ x: number; y: number }> = [];
      for (let dx = 0; dx < coreW; dx++) {
        for (let dy = 0; dy < coreH; dy++) {
          gridCoords.push({ x: rx + dx, y: ry + dy });
        }
      }

      // Check if any of these footprint cells are blocked
      let footprintBlocked = false;
      for (const pt of gridCoords) {
        if (!isCellInSiteBoundary(pt.x, pt.y, siteWidth, siteHeight, siteShape, customBoundaryPoints) || state.grid[`${pt.x},${pt.y},0`]) {
          footprintBlocked = true;
          break;
        }
      }
      if (footprintBlocked) continue;

      state.cores.push({
        id,
        type,
        x: rx,
        y: ry,
        capacity: spec.capacity,
        nameFa: spec.nameFa,
        nameEn: spec.nameEn,
        gridCoords
      });

      // Maintain occupancy levels up to maxFloors (which can block unit overlap stacked)
      const floorsHeightLimit = Math.max(2, params.maxFloors);
      for (const pt of gridCoords) {
        for (let l = 0; l <= floorsHeightLimit; l++) {
          state.grid[`${pt.x},${pt.y},${l}`] = { x: pt.x, y: pt.y, level: l, type: 'core', occupiedId: id };
        }
      }
    }
  }

  // 1.5. GROUND FLOOR ENTRANCES PHASE (20% of long side of core reserved with clear corridor)
  createCoreGroundEntrances(state, siteWidth, siteHeight);

  // 2. STOCHASTIC GROWTH PHASE (Anchor containers bottom-up around Seeds)
  let coreUnitCounts: Record<string, number> = {};
  state.cores.forEach(c => coreUnitCounts[c.id] = 0);

  // Enforce correct unit surroundings around each core first (to satisfy Persian architectural guidelines)
  for (const core of state.cores) {
    enforceCoreSurroundings(
      state,
      core,
      householdsList,
      coreUnitCounts,
      params,
      siteWidth,
      siteHeight,
      siteShape,
      customBoundaryPoints
    );
  }

  let failedCounter = 0;
  
  // Keep placing units from household requests stochastically
  for (const hEntry of householdsList) {
    let placed = false;
    let tryCount = 0;

    // Filter cores that still have available attachment capacity
    const activeCores = state.cores.filter(c => coreUnitCounts[c.id] < c.capacity);
    if (activeCores.length === 0) break; // All seed neighborhoods are completely filled

    // Try finding anchor next to elements of these active cores
    while (!placed && tryCount < 70) {
      tryCount++;
      seedVal += 0.47;
      
      const core = activeCores[Math.floor(rngRandom(seedVal) * activeCores.length)];
      
      // Determine size based on type (all are distinct non-square rectangular shapes)
      let widthCells = 2;
      let heightCells = 1;
      if (hEntry.type === 'medium') {
        widthCells = 3;
        heightCells = 2;
      } else if (hEntry.type === 'large') {
        widthCells = 4;
        heightCells = 2;
      }

      // 50% chance of vertical container rotation
      if (rngRandom(seedVal + 0.15) > 0.5) {
        const temp = widthCells;
        widthCells = heightCells;
        heightCells = temp;
      }

      // Look at physical anchors: we can attach next to the Core seed itself,
      // or crawl along the boundary of existing units in that core's cluster!
      const anchors: Array<{ x: number; y: number; level: number }> = [];
      core.gridCoords.forEach(pt => anchors.push({ x: pt.x, y: pt.y, level: 0 }));

      state.units
        .filter(u => u.coreId === core.id)
        .forEach(u => u.gridCoords.forEach(pt => anchors.push({ x: pt.x, y: pt.y, level: pt.level })));

      // Choose an anchor point biased towards the Core center to maximize tight connectivity!
      let anchorNode = anchors[0];
      if (anchors.length > 1) {
        let bestCandidate = anchors[Math.floor(rngRandom(seedVal + 0.3) * anchors.length)];
        let bestDist = distance({ x: bestCandidate.x, y: bestCandidate.y }, { x: core.x, y: core.y });
        
        for (let tries = 0; tries < 4; tries++) {
          const randSeed = seedVal + 0.3 + tries * 0.17;
          const candidate = anchors[Math.floor(rngRandom(randSeed) * anchors.length)];
          const dist = distance({ x: candidate.x, y: candidate.y }, { x: core.x, y: core.y });
          if (dist < bestDist) {
            bestDist = dist;
            bestCandidate = candidate;
          }
        }
        anchorNode = bestCandidate;
      }

      // Directions: East, West, South, North, or Stacking (vertical growth)
      const dirs = [
        { dx: 1, dy: 0, dl: 0 },
        { dx: -1, dy: 0, dl: 0 },
        { dx: 0, dy: 1, dl: 0 },
        { dx: 0, dy: -1, dl: 0 },
        { dx: 0, dy: 0, dl: 1 } // Stacking directly on top of the anchor
      ];

      const dir = dirs[Math.floor(rngRandom(seedVal + 0.55) * dirs.length)];
      const testX = anchorNode.x + dir.dx;
      const testY = anchorNode.y + dir.dy;
      const testL = anchorNode.level + dir.dl;

      // Stacking limits checking: must not exceed params.maxFloors (remember levels are 0-indexed: 0, 1, 2)
      if (testL >= params.maxFloors) continue;

      // Footprint boundary collision checks
      let canBuild = true;
      const proposedCells: Array<{ x: number; y: number; level: number }> = [];
      let supportUnder = 0;

      for (let dx = 0; dx < widthCells; dx++) {
        for (let dy = 0; dy < heightCells; dy++) {
          const cx = testX + dx;
          const cy = testY + dy;
          proposedCells.push({ x: cx, y: cy, level: testL });

          // Boundary mask validation
          if (!isCellInSiteBoundary(cx, cy, siteWidth, siteHeight, siteShape, customBoundaryPoints)) {
            canBuild = false;
            break;
          }

          // Grid cell space occupancy check (on active level)
          if (state.grid[`${cx},${cy},${testL}`]) {
            canBuild = false;
            break;
          }

          // Structural Stacking load check: if level >= 1, there must be solid foundation underneath!
          if (testL > 0) {
            const supportCell = state.grid[`${cx},${cy},${testL - 1}`];
            if (supportCell && (supportCell.type === 'unit' || supportCell.type === 'core')) {
              supportUnder++;
            }
          }
        }
        if (!canBuild) break;
      }

      // To stack containers, we require physical support underneath at least 75% of the cells (75% area support rule)
      if (testL > 0 && supportUnder < (widthCells * heightCells) * 0.75) {
        canBuild = false;
      }

      // Spatial Constraint: Distance to parent core seed limit (walking distance constraint)
      const coreCenter = { x: core.x, y: core.y };
      const centerLoc = { x: testX + widthCells / 2, y: testY + heightCells / 2 };
      if (distance(coreCenter, centerLoc) > params.maxWalkDistanceCore) {
        canBuild = false;
      }

      // Slope stability constraint on Sloped Terrain:
      // High altitude differences within the unit footprint must be minor (less than 1.5 units) to prevent collapsing!
      let minSlopeH = 999;
      let maxSlopeH = -999;
      proposedCells.forEach(cell => {
        const hVal = state.terrainZ[`${cell.x},${cell.y}`] || 0;
        if (hVal < minSlopeH) minSlopeH = hVal;
        if (hVal > maxSlopeH) maxSlopeH = hVal;
      });
      if (Math.abs(maxSlopeH - minSlopeH) > 1.4) {
        canBuild = false; // landslide / slope danger!
      }

      // Core connection percentage constraint:
      // Each unit must connect with a percentage of one of its sides, not fully.
      // Only small units ('single') can connect with their entire small side.
      if (canBuild && !checkCoreConnectionPercentage(proposedCells, core.gridCoords, hEntry.type, widthCells, heightCells)) {
        canBuild = false;
      }

      // Requirement: Every unit must have at least 2 open outer sides not touching any other unit
      if (canBuild && !checkUnitFreeSidesConstraint(state.grid, proposedCells)) {
        canBuild = false;
      }

      if (canBuild) {
        const uId = `unit-${generateId()}`;
        const newUnit: Unit = {
          id: uId,
          type: hEntry.type,
          capacity: hEntry.spec.capacity,
          area: hEntry.spec.area,
          containerCount: hEntry.spec.containerCount,
          color: unitColors[hEntry.type],
          nameFa: hEntry.spec.nameFa,
          nameEn: hEntry.spec.nameEn,
          level: testL,
          coreId: core.id,
          gridCoords: proposedCells,
          adjacencyPreference: hEntry.spec.adjEn,
          adjacencyPreferenceFa: hEntry.spec.adjFa
        };

        state.units.push(newUnit);
        
        // Write details into grid
        proposedCells.forEach(pt => {
          state.grid[`${pt.x},${pt.y},${pt.level}`] = {
            x: pt.x,
            y: pt.y,
            level: pt.level,
            type: 'unit',
            occupiedId: uId
          };
        });

        coreUnitCounts[core.id]++;
        placed = true;
      }
    }

    if (!placed) {
      failedCounter++;
      if (failedCounter > 100) {
        // Relax constraints if we are stuck to avoid stalling
        params.maxWalkDistanceCore += 0.5;
      }
    }
  }

  // 3. CLUSTERING ASSEMBLIES PHASE (Form neighborhood groups)
  state.clusters = [];
  state.cores.forEach(core => {
    const unitsInCore = state.units.filter(u => u.coreId === core.id);
    const unitIds = unitsInCore.map(u => u.id);

    // Identify outline boundary coordinates (level 0) for boundary visualizations
    // Collectors has to find edge cells that face empty spaces
    const occupants = new Set<string>();
    core.gridCoords.forEach(c => occupants.add(`${c.x},${c.y}`));
    unitsInCore.forEach(u => u.gridCoords.forEach(pt => {
      if (pt.level === 0) occupants.add(`${pt.x},${pt.y}`);
    }));

    const boundaryCells: Array<{ x: number; y: number }> = [];
    occupants.forEach(coordStr => {
      const [sx, sy] = coordStr.split(',').map(Number);
      const crossDirs = [
        { x: sx + 1, y: sy }, { x: sx - 1, y: sy },
        { x: sx, y: sy + 1 }, { x: sx, y: sy - 1 }
      ];

      let isEdge = false;
      for (const edge of crossDirs) {
        if (!isCellInSiteBoundary(edge.x, edge.y, siteWidth, siteHeight, siteShape, customBoundaryPoints)) {
          isEdge = true;
          break;
        }
        const cellGridVal = state.grid[`${edge.x},${edge.y},0`];
        if (!cellGridVal || cellGridVal.type === 'empty') {
          isEdge = true;
          break;
        }
      }

      if (isEdge) {
        boundaryCells.push({ x: sx, y: sy });
      }
    });

    const clusterColors = [
      'rgba(59, 130, 246, 0.15)',  // Soft Indigo Blue
      'rgba(249, 115, 22, 0.15)',  // Soft Rust Orange
      'rgba(16, 185, 129, 0.15)',  // Soft Emerald Teal
      'rgba(139, 92, 246, 0.15)',  // Soft Royal Purple
      'rgba(236, 72, 153, 0.15)',  // Soft Rose Pink
      'rgba(234, 179, 8, 0.15)'    // Soft Ochre Yellow
    ];
    const colIdx = state.clusters.length % clusterColors.length;

    state.clusters.push({
      id: `cluster-${core.id}`,
      coreId: core.id,
      unitIds,
      color: clusterColors[colIdx],
      boundary: boundaryCells
    });
  });

  // 4. MICRO COMMUNITIVE COURTYARDS PHASE (Pocket plazas inside cluster bounds)
  state.courtyards = [];

  state.clusters.forEach(cluster => {
    if (cluster.unitIds.length < 2) return; // too small for a courtyard

    // Find bounding box limits for this cluster and locate open nodes adjacent to its units
    const clusterCoords = new Set<string>();
    const core = state.cores.find(c => c.id === cluster.coreId);
    if (!core) return;
    
    core.gridCoords.forEach(pt => clusterCoords.add(`${pt.x},${pt.y}`));
    state.units
      .filter(u => u.coreId === cluster.coreId)
      .forEach(u => u.gridCoords.forEach(pt => {
        if (pt.level === 0) clusterCoords.add(`${pt.x},${pt.y}`);
      }));

    let minX = siteWidth, maxX = 0, minY = siteHeight, maxY = 0;
    clusterCoords.forEach(str => {
      const [x, y] = str.split(',').map(Number);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    minX = Math.max(1, minX - 2);
    maxX = Math.min(siteWidth - 2, maxX + 2);
    minY = Math.max(1, minY - 2);
    maxY = Math.min(siteHeight - 2, maxY + 2);

    const openCandidates: Array<{ x: number; y: number; perimeterScore: number }> = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Must be unbuilt, valid in site limits & not water/obstacles
        if (!state.grid[`${x},${y},0`] && isCellInSiteBoundary(x, y, siteWidth, siteHeight, siteShape, customBoundaryPoints)) {
          // Count surrounding components of this neighborhood
          let adjacencyScore = 0;
          const searchDirs = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 }
          ];

          searchDirs.forEach(sd => {
            const nx = x + sd.dx;
            const ny = y + sd.dy;
            if (clusterCoords.has(`${nx},${ny}`)) {
              adjacencyScore++;
            }
          });

          if (adjacencyScore >= 1) {
            openCandidates.push({ x, y, perimeterScore: adjacencyScore });
          }
        }
      }
    }

    // Sort candidates by high adjacency to place the courtyard centrally
    openCandidates.sort((a, b) => b.perimeterScore - a.perimeterScore);

    // Place a courtyard block proportional to courtyardSizeRatio (e.g. 2x2 up to 3x2)
    // Requirement: Courtyards MUST be adjacent to units from AT LEAST 2 directions (North, South, East, West)
    const ratioMultiplier = params.courtyardSizeRatio / 15; // scales size
    const targetW = Math.max(2, Math.floor(2 * ratioMultiplier));
    const targetH = Math.max(2, Math.floor(1.5 * ratioMultiplier));

    const unitFootprint = new Set<string>();
    state.units.forEach(u => {
      u.gridCoords.forEach(pt => unitFootprint.add(`${pt.x},${pt.y}`));
    });

    const checkCourtyardTwoDirectionsAdjacency = (
      cMinX: number, cMaxX: number,
      cMinY: number, cMaxY: number
    ): boolean => {
      let hasNorth = false;
      let hasSouth = false;
      let hasWest = false;
      let hasEast = false;

      for (let x = cMinX; x <= cMaxX; x++) {
        if (unitFootprint.has(`${x},${cMinY - 1}`) || state.grid[`${x},${cMinY - 1},0`]?.type === 'unit') {
          hasNorth = true;
        }
        if (unitFootprint.has(`${x},${cMaxY + 1}`) || state.grid[`${x},${cMaxY + 1},0`]?.type === 'unit') {
          hasSouth = true;
        }
      }

      for (let y = cMinY; y <= cMaxY; y++) {
        if (unitFootprint.has(`${cMinX - 1},${y}`) || state.grid[`${cMinX - 1},${y},0`]?.type === 'unit') {
          hasWest = true;
        }
        if (unitFootprint.has(`${cMaxX + 1},${y}`) || state.grid[`${cMaxX + 1},${y},0`]?.type === 'unit') {
          hasEast = true;
        }
      }

      let dirCount = 0;
      if (hasNorth) dirCount++;
      if (hasSouth) dirCount++;
      if (hasWest) dirCount++;
      if (hasEast) dirCount++;

      return dirCount >= 2;
    };

    let placedCourtyard = false;
    for (const cand of openCandidates) {
      if (placedCourtyard) break;

      // Try block dimensions from target down to smaller blocks if needed
      const sizeConfigurations = [
        { w: targetW, h: targetH },
        { w: 2, h: 2 },
        { w: 2, h: 1 },
        { w: 1, h: 2 },
        { w: 1, h: 1 }
      ];

      for (const config of sizeConfigurations) {
        const cMinX = cand.x;
        const cMaxX = cand.x + config.w - 1;
        const cMinY = cand.y;
        const cMaxY = cand.y + config.h - 1;

        // Check unit adjacency from at least 2 directions
        if (!checkCourtyardTwoDirectionsAdjacency(cMinX, cMaxX, cMinY, cMaxY)) {
          continue;
        }

        const courtyardPoints: Array<{ x: number; y: number }> = [];
        let overlapNode = false;

        for (let dx = 0; dx < config.w; dx++) {
          for (let dy = 0; dy < config.h; dy++) {
            const cx = cand.x + dx;
            const cy = cand.y + dy;
            courtyardPoints.push({ x: cx, y: cy });

            if (!isCellInSiteBoundary(cx, cy, siteWidth, siteHeight, siteShape, customBoundaryPoints) || state.grid[`${cx},${cy},0`]) {
              overlapNode = true;
              break;
            }
          }
          if (overlapNode) break;
        }

        if (!overlapNode && courtyardPoints.length > 0) {
          const cId = `court-${generateId()}`;
          state.courtyards.push({
            id: cId,
            clusterId: cluster.id,
            x: cand.x,
            y: cand.y,
            size: courtyardPoints.length,
            gridCoords: courtyardPoints
          });

          courtyardPoints.forEach(pt => {
            state.grid[`${pt.x},${pt.y},0`] = {
              x: pt.x,
              y: pt.y,
              level: 0,
              type: 'courtyard',
              occupiedId: cId
            };
          });
          placedCourtyard = true;
          break; // Placed one central courtyard inside this cluster successfully
        }
      }
    }
  });

  // 5. INFRASTRUCTURE PATHS EMERGENCY PHASE (emerges AFTER clusters/courts are fully completed!)
  state.paths = [];

  const occupiedForPath = (x: number, y: number): boolean => {
    const floorCell = state.grid[`${x},${y},0`];
    if (!floorCell) return false;
    // Walkways cannot climb onto permanent building blocks like units or cores
    return floorCell.type === 'unit' || floorCell.type === 'core' || floorCell.type === 'obstacle' || floorCell.type === 'water';
  };

  // Primary Spine connections: Connect core seeds together sequentially
  for (let i = 0; i < state.cores.length - 1; i++) {
    const cA = state.cores[i];
    const cB = state.cores[i + 1];

    const pCoords = findPathOnGrid(
      { x: cA.x, y: cA.y },
      { x: cB.x, y: cB.y },
      occupiedForPath,
      state.terrainZ,
      siteWidth,
      siteHeight
    );

    if (pCoords && pCoords.length > 1) {
      const pId = `path-primary-${i}`;
      state.paths.push({ id: pId, type: 'primary', coords: pCoords });
      pCoords.forEach(pt => {
        if (!state.grid[`${pt.x},${pt.y},0`]) {
          state.grid[`${pt.x},${pt.y},0`] = { x: pt.x, y: pt.y, level: 0, type: 'path', occupiedId: pId };
        }
      });
    }
  }

  // Connect boundary egress gates stochastically to the first and last cores
  const egressPortals = [
    { x: 0, y: Math.floor(siteHeight * 0.44) },
    { x: siteWidth - 1, y: Math.floor(siteHeight * 0.54) }
  ];

  if (state.cores.length > 1) {
    const firstCore = state.cores[0];
    const gate1 = findPathOnGrid(egressPortals[0], { x: firstCore.x, y: firstCore.y }, occupiedForPath, state.terrainZ, siteWidth, siteHeight);
    if (gate1) {
      state.paths.push({ id: 'gate-primary-A', type: 'primary', coords: gate1 });
      gate1.forEach(pt => {
        if (!state.grid[`${pt.x},${pt.y},0`]) state.grid[`${pt.x},${pt.y},0`] = { x: pt.x, y: pt.y, level: 0, type: 'path', occupiedId: 'gate-primary-A' };
      });
    }

    const lastCore = state.cores[state.cores.length - 1];
    const gate2 = findPathOnGrid({ x: lastCore.x, y: lastCore.y }, egressPortals[1], occupiedForPath, state.terrainZ, siteWidth, siteHeight);
    if (gate2) {
      state.paths.push({ id: 'gate-primary-B', type: 'primary', coords: gate2 });
      gate2.forEach(pt => {
        if (!state.grid[`${pt.x},${pt.y},0`]) state.grid[`${pt.x},${pt.y},0`] = { x: pt.x, y: pt.y, level: 0, type: 'path', occupiedId: 'gate-primary-B' };
      });
    }
  }

  // Secondary Connections: Connect each core directly to its respective courtyard
  state.courtyards.forEach((court, idx) => {
    const cluster = state.clusters.find(c => c.id === court.clusterId);
    if (!cluster) return;
    const core = state.cores.find(c => c.id === cluster.coreId);
    if (!core) return;

    const pCoords = findPathOnGrid(
      { x: core.x, y: core.y },
      { x: court.x, y: court.y },
      (cx, cy) => {
        // Courtyard cells are walkable for secondary paths connecting them
        const cVal0 = state.grid[`${cx},${cy},0`];
        if (cVal0 && cVal0.type === 'courtyard' && cVal0.occupiedId === court.id) return false;
        return occupiedForPath(cx, cy);
      },
      state.terrainZ,
      siteWidth,
      siteHeight
    );

    if (pCoords && pCoords.length > 1) {
      const pId = `path-secondary-court-${idx}`;
      state.paths.push({ id: pId, type: 'secondary', coords: pCoords });
      pCoords.forEach(pt => {
        if (!state.grid[`${pt.x},${pt.y},0`]) {
          state.grid[`${pt.x},${pt.y},0`] = { x: pt.x, y: pt.y, level: 0, type: 'path', occupiedId: pId };
        }
      });
    }
  });

  // Pedestrian Desire Lines: Connect subset of units back to closest Courtyard/Core stochastically
  let pedCount = 0;
  state.units.forEach((unit, idx) => {
    if (idx % 3 !== 0) return; // Sample to avoid mesh clutter
    const groundP = unit.gridCoords.find(c => c.level === 0);
    if (!groundP) return;

    const core = state.cores.find(c => c.id === unit.coreId);
    if (!core) return;

    const pCoords = findPathOnGrid(
      { x: groundP.x, y: groundP.y },
      { x: core.x, y: core.y },
      (cx, cy) => {
        if (cx === groundP.x && cy === groundP.y) return false;
        return occupiedForPath(cx, cy);
      },
      state.terrainZ,
      siteWidth,
      siteHeight
    );

    if (pCoords && pCoords.length > 1) {
      const pId = `path-pedestrian-${pedCount++}`;
      state.paths.push({ id: pId, type: 'pedestrian', coords: pCoords });
      pCoords.forEach(pt => {
        if (!state.grid[`${pt.x},${pt.y},0`]) {
          state.grid[`${pt.x},${pt.y},0`] = { x: pt.x, y: pt.y, level: 0, type: 'path', occupiedId: pId };
        }
      });
    }
  });

  // 6. GREEN SPACE GENERATION PHASE (Two-Tier System: Tier 1 Cluster Buffer & Tier 2 Shared Park)
  generateGreenSpaces(state, params);

  // Calculate scores for this candidate
  state.metrics = calculateDetailedEvaluation(state, params);

  return state;
}

/**
 * GREEN SPACE GENERATION — TWO-TIER SYSTEM
 *
 * TIER 1: CLUSTER PERIMETER BUFFER (rule-constrained, tight)
 * - SEED: core entrance point of each cluster
 * - GROWTH: expand outward from entrance seed, one grid at a time
 *   direction priority: (a) continue along entrance-facing direction, (b) wrap laterally around adjacent unit edges
 * - BLOCKED by: UNIT cells, CORE cells, another cluster's Tier 1 buffer
 * - MAX DEPTH: exactly 1 grid module beyond the outermost ground-floor unit of that cluster
 * - must form ONE continuous ring/shape per cluster, connected back to the entrance seed
 * - STOP CONDITIONS:
 *   IF next cell is UNIT -> redirect along its edge (wrap, don't stop dead)
 *   IF next cell is CORE -> stop
 *   IF next cell already Tier 1 of same cluster -> merge
 *   IF next cell is Tier 1 of a DIFFERENT cluster -> stop, mark shared edge
 *   IF depth from outer unit ring > 1 module -> stop
 *   ELSE -> convert to GREEN (tier=1), continue
 *
 * TIER 2: SHARED / INTER-CLUSTER GREEN (open, unconstrained)
 * - DEFINITION: any remaining open space NOT claimed by Tier 1 buffers, NOT a unit, NOT a core, NOT a circulation path — after all clusters have finished their Tier 1 growth.
 * - RULE: fill leftover open zones between clusters freely (no fixed max depth, no core-seeding requirement)
 */
export function generateGreenSpaces(state: SettlementState, params: GenerationParams): void {
  const { gridWidth, gridHeight, siteShape, grid, clusters, cores, units } = state;
  const customBoundaryPoints = params.customBoundaryPoints;

  state.greenSpaces = [];

  const isBlockedForGreen = (x: number, y: number): boolean => {
    const cell = grid[`${x},${y},0`];
    if (!cell) return false;
    return (
      cell.type === 'unit' ||
      cell.type === 'core' ||
      cell.type === 'path' ||
      cell.type === 'courtyard' ||
      cell.type === 'entrance' ||
      cell.type === 'public_space' ||
      cell.type === 'obstacle' ||
      cell.type === 'water'
    );
  };

  const tier1Map = new Map<string, string>(); // "x,y" -> clusterId
  const sharedEdges = new Set<string>();

  // TIER 1: CLUSTER PERIMETER BUFFER
  clusters.forEach(cluster => {
    const core = cores.find(c => c.id === cluster.coreId);
    if (!core) return;

    // Ground-floor units and core in this cluster
    const clusterUnitsAndCore = new Set<string>();
    core.gridCoords.forEach(pt => clusterUnitsAndCore.add(`${pt.x},${pt.y}`));
    units
      .filter(u => u.coreId === cluster.coreId)
      .forEach(u => u.gridCoords.forEach(pt => {
        if (pt.level === 0) clusterUnitsAndCore.add(`${pt.x},${pt.y}`);
      }));

    if (clusterUnitsAndCore.size === 0) return;

    // Entrance seed point for this cluster
    let seedX = core.x;
    let seedY = core.y;
    if (state.entrances && state.entrances.length > 0) {
      const matchEnt = state.entrances.find(e => e.id && e.id.includes(core.id));
      if (matchEnt) {
        seedX = matchEnt.x;
        seedY = matchEnt.y;
      }
    }

    let coreCenterX = 0, coreCenterY = 0;
    core.gridCoords.forEach(pt => { coreCenterX += pt.x; coreCenterY += pt.y; });
    coreCenterX = core.gridCoords.length > 0 ? coreCenterX / core.gridCoords.length : core.x;
    coreCenterY = core.gridCoords.length > 0 ? coreCenterY / core.gridCoords.length : core.y;

    let dirVecX = seedX - coreCenterX;
    let dirVecY = seedY - coreCenterY;
    if (dirVecX === 0 && dirVecY === 0) { dirVecX = 1; dirVecY = 0; }

    const isAdjacentToClusterUnits = (cx: number, cy: number): boolean => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (clusterUnitsAndCore.has(`${cx + dx},${cy + dy}`)) {
            return true;
          }
        }
      }
      return false;
    };

    const visitedInCluster = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [];

    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 }
    ];

    // Priority: continue along entrance-facing direction first, wrap laterally
    directions.sort((a, b) => {
      const dotA = a.dx * dirVecX + a.dy * dirVecY;
      const dotB = b.dx * dirVecX + b.dy * dirVecY;
      return dotB - dotA;
    });

    directions.forEach(dir => {
      const sx = seedX + dir.dx;
      const sy = seedY + dir.dy;
      const sKey = `${sx},${sy}`;

      if (
        isCellInSiteBoundary(sx, sy, gridWidth, gridHeight, siteShape, customBoundaryPoints) &&
        !isBlockedForGreen(sx, sy) &&
        isAdjacentToClusterUnits(sx, sy)
      ) {
        if (tier1Map.has(sKey)) {
          const other = tier1Map.get(sKey);
          if (other !== cluster.id) {
            sharedEdges.add(sKey);
          }
        } else {
          tier1Map.set(sKey, cluster.id);
          visitedInCluster.add(sKey);
          queue.push({ x: sx, y: sy });
        }
      }
    });

    if (queue.length === 0) {
      clusterUnitsAndCore.forEach(uStr => {
        const [ux, uy] = uStr.split(',').map(Number);
        directions.forEach(dir => {
          const sx = ux + dir.dx;
          const sy = uy + dir.dy;
          const sKey = `${sx},${sy}`;
          if (
            !visitedInCluster.has(sKey) &&
            !clusterUnitsAndCore.has(sKey) &&
            isCellInSiteBoundary(sx, sy, gridWidth, gridHeight, siteShape, customBoundaryPoints) &&
            !isBlockedForGreen(sx, sy) &&
            isAdjacentToClusterUnits(sx, sy)
          ) {
            if (tier1Map.has(sKey)) {
              if (tier1Map.get(sKey) !== cluster.id) {
                sharedEdges.add(sKey);
              }
            } else {
              tier1Map.set(sKey, cluster.id);
              visitedInCluster.add(sKey);
              queue.push({ x: sx, y: sy });
            }
          }
        });
      });
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;

      directions.forEach(dir => {
        const nx = curr.x + dir.dx;
        const ny = curr.y + dir.dy;
        const nKey = `${nx},${ny}`;

        if (visitedInCluster.has(nKey)) {
          return;
        }

        if (!isCellInSiteBoundary(nx, ny, gridWidth, gridHeight, siteShape, customBoundaryPoints)) {
          return;
        }

        if (isBlockedForGreen(nx, ny)) {
          return;
        }

        // MAX DEPTH: depth from outer unit ring > 1 module
        if (!isAdjacentToClusterUnits(nx, ny)) {
          return;
        }

        if (tier1Map.has(nKey)) {
          const existing = tier1Map.get(nKey)!;
          if (existing !== cluster.id) {
            sharedEdges.add(nKey);
          }
          return;
        }

        tier1Map.set(nKey, cluster.id);
        visitedInCluster.add(nKey);
        queue.push({ x: nx, y: ny });
      });
    }
  });

  const tier1ClusterMap = new Map<string, Array<{ x: number; y: number }>>();
  tier1Map.forEach((clusterId, key) => {
    const [x, y] = key.split(',').map(Number);
    grid[`${x},${y},0`] = {
      x,
      y,
      level: 0,
      type: 'green_space',
      tier: 1,
      occupiedId: `green-tier1-${clusterId}`
    };

    if (!tier1ClusterMap.has(clusterId)) {
      tier1ClusterMap.set(clusterId, []);
    }
    tier1ClusterMap.get(clusterId)!.push({ x, y });
  });

  tier1ClusterMap.forEach((coords, clusterId) => {
    state.greenSpaces!.push({
      id: `green-tier1-${clusterId}`,
      clusterId,
      tier: 1,
      gridCoords: coords
    });
  });

  // TIER 2: SHARED / INTER-CLUSTER GREEN (open, unconstrained)
  const tier2Coords: Array<{ x: number; y: number }> = [];

  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const key = `${x},${y}`;
      const cell0 = grid[`${key},0`];

      if (
        isCellInSiteBoundary(x, y, gridWidth, gridHeight, siteShape, customBoundaryPoints) &&
        !isBlockedForGreen(x, y) &&
        (!cell0 || cell0.type === 'empty')
      ) {
        tier2Coords.push({ x, y });
        grid[`${key},0`] = {
          x,
          y,
          level: 0,
          type: 'green_space',
          tier: 2,
          occupiedId: 'green-tier2-park'
        };
      }
    }
  }

  if (tier2Coords.length > 0) {
    state.greenSpaces!.push({
      id: 'green-tier2-park',
      tier: 2,
      gridCoords: tier2Coords
    });
  }
}

/**
 * DETAILED MULTI-OBJECTIVE EVALUATION SYSTEM
 */
export function calculateDetailedEvaluation(state: SettlementState, params: GenerationParams): EvaluationMetrics {
  const { cores, units, courtyards, paths, gridWidth, gridHeight, grid, siteShape, terrainType } = state;

  if (units.length === 0) {
    return {
      walkability: 0,
      accessibility: 0,
      clusteringQuality: 0,
      courtyardQuality: 0,
      density: 0,
      expansionPotential: 0,
      infrastructureEfficiency: 0,
      overall: 0
    };
  }

  // 1. ACCESSIBILITY (Distance to Core, Paths, Shared Spaces)
  let sumWalkCore = 0;
  let sumWalkShared = 0;
  let penaltyExceedingCore = 0;
  let penaltyExceedingShared = 0;

  units.forEach(u => {
    const centerPt = u.gridCoords[0];
    
    // Nearest core
    let distCore = 999;
    cores.forEach(c => {
      const d = distance(centerPt, { x: c.x, y: c.y });
      if (d < distCore) distCore = d;
    });
    sumWalkCore += distCore;
    if (distCore > params.maxWalkDistanceCore) {
      penaltyExceedingCore += (distCore - params.maxWalkDistanceCore) * 15;
    }

    // Nearest courtyard/shared space
    let distShared = 999;
    courtyards.forEach(court => {
      const d = distance(centerPt, { x: court.x, y: court.y });
      if (d < distShared) distShared = d;
    });
    if (courtyards.length > 0) {
      sumWalkShared += distShared;
      if (distShared > params.maxWalkDistanceShared) {
        penaltyExceedingShared += (distShared - params.maxWalkDistanceShared) * 12;
      }
    } else {
      sumWalkShared += 22; // heavy penalty if no pocket courtyards exist
      penaltyExceedingShared += 100;
    }
  });

  const avgCoreDist = sumWalkCore / units.length;
  const avgSharedDist = sumWalkShared / units.length;

  const rawAccessibility = 100 - (avgCoreDist * 4 + avgSharedDist * 3) - (penaltyExceedingCore + penaltyExceedingShared) / units.length;
  const accessibilityScore = Math.max(12, Math.min(100, Math.floor(rawAccessibility)));

  // 2. COURTYARD QUALITY (Enclosure, walking access, courtyard area coverage ratio)
  let sumEnclosureRatio = 0;
  let matchesCourtyardExpectation = 0;

  state.clusters.forEach(cluster => {
    const unitsInCluster = units.filter(u => u.coreId === cluster.coreId);
    if (unitsInCluster.length === 0) return;

    const buildCount = unitsInCluster.reduce((sum, u) => sum + u.containerCount, 0);
    const localCourts = courtyards.filter(c => c.clusterId === cluster.id);
    const courtBuiltRatio = localCourts.reduce((sum, c) => sum + c.size, 0) / (buildCount * 2 + 1);

    // Deviation from target courtyard ratio (expressed as courtyardSizeRatio / 100)
    const targetRatio = params.courtyardSizeRatio / 100;
    const deviation = Math.abs(courtBuiltRatio - targetRatio);
    sumEnclosureRatio += deviation;

    if (localCourts.length > 0) {
      matchesCourtyardExpectation += 100;
    } else {
      matchesCourtyardExpectation += 15;
    }
  });

  const avgClusterCourtyardDeviation = state.clusters.length > 0 ? (sumEnclosureRatio / state.clusters.length) : 0.5;
  const avgEnclosureScore = state.clusters.length > 0 ? (matchesCourtyardExpectation / state.clusters.length) : 0;

  const courtyardScore = Math.max(10, Math.min(100, Math.floor(avgEnclosureScore - avgClusterCourtyardDeviation * 140)));

  // 3. INFRASTRUCTURE EFFICIENCY (Core density overhead & utility lengths)
  // High core counts are capital intense. Short path layouts have higher logistics efficiency.
  const coreOverheadRatio = cores.length / (units.length / 8 + 1); // target ~1 core per 8 units
  const corePenalty = Math.max(0, coreOverheadRatio - 1.0) * 35;

  let totalPathCells = 0;
  for (const k in grid) {
    if (grid[k].type === 'path' && grid[k].level === 0) totalPathCells++;
  }
  const avgPathLengthPerUnit = units.length > 0 ? (totalPathCells / units.length) : 5.0;
  // Ideal is 2.5 to 5.0 cells path per unit. Penalty for winding paths:
  const pathPenalty = Math.max(0, avgPathLengthPerUnit - 5.0) * 12;

  const infrastructureScore = Math.max(15, Math.min(100, Math.floor(100 - (corePenalty + pathPenalty))));

  // 4. DENSITY BALANCE (Spread density even to prevent crowding or vacant sectors)
  // Calculate build density in 4 separate quadrants of the site
  const quadrantBuiltCounts = [0, 0, 0, 0];
  const halfW = gridWidth / 2;
  const halfH = gridHeight / 2;

  units.forEach(u => {
    const pt = u.gridCoords[0];
    const qX = pt.x < halfW ? 0 : 1;
    const qY = pt.y < halfH ? 0 : 2;
    quadrantBuiltCounts[qX + qY]++;
  });

  const avgQuadCount = units.length / 4;
  let quadVarianceSum = 0;
  quadrantBuiltCounts.forEach(val => quadVarianceSum += Math.pow(val - avgQuadCount, 2));
  const stdDevDensity = Math.sqrt(quadVarianceSum / 4);

  // Score begins to drop if stdDev is highly skewed, except on Custom/Coastal where rivers/seas naturally restrict construction
  const densitySkewPenalty = terrainType === 'coastal' || siteShape !== 'rectangular' ? (stdDevDensity * 1.5) : (stdDevDensity * 3.5);

  // Match target density preset
  // Low density ideal built ratio: 15-22%. Medium: 28-36%. High: 40-52%.
  let builtFootprint = 0;
  let totalSiteAvailableCells = 0;
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      if (isCellInSiteBoundary(x, y, gridWidth, gridHeight, siteShape, params.customBoundaryPoints)) {
        totalSiteAvailableCells++;
        const cell = grid[`${x},${y},0`];
        if (cell && (cell.type === 'unit' || cell.type === 'core')) builtFootprint++;
      }
    }
  }

  const footprintRatio = totalSiteAvailableCells > 0 ? (builtFootprint / totalSiteAvailableCells) : 0.25;
  let densityDeviation = 0;
  if (params.targetDensity === 'low') {
    densityDeviation = Math.abs(footprintRatio - 0.25);
  } else if (params.targetDensity === 'medium') {
    densityDeviation = Math.abs(footprintRatio - 0.50);
  } else {
    // High target density limit: up to 100% (1.0) ground coverage
    densityDeviation = Math.abs(footprintRatio - 1.0);
  }

  const densityScore = Math.max(15, Math.min(100, Math.floor(100 - densitySkewPenalty - densityDeviation * 250)));

  // 5. CLUSTER QUALITY (Size consistency, coherence relative to target limits)
  let clusterSizePenalties = 0;
  state.clusters.forEach(c => {
    const size = c.unitIds.length;
    if (size > params.maxClusterSize) {
      clusterSizePenalties += (size - params.maxClusterSize) * 14;
    }
    // Penalize when cluster size is extremely small compared to preferred size
    if (size < params.preferredClusterSize - 2) {
      clusterSizePenalties += (params.preferredClusterSize - 2 - size) * 8;
    }
  });

  const clusterQualityScore = Math.max(20, Math.min(100, Math.floor(100 - clusterSizePenalties)));

  // 6. EXPANSION POTENTIAL (buffer areas left around existing seed cores)
  // Counts cells adjacent to existing modules which remain empty on level 0,
  // matching target expansionReserve parameters.
  let expandZoneAvailable = 0;
  cores.forEach(cCenter => {
    const checkingCoords = [
      { x: cCenter.x + 3, y: cCenter.y }, { x: cCenter.x - 3, y: cCenter.y },
      { x: cCenter.x, y: cCenter.y + 3 }, { x: cCenter.x, y: cCenter.y - 3 }
    ];

    checkingCoords.forEach(pt => {
      if (isCellInSiteBoundary(pt.x, pt.y, gridWidth, gridHeight, siteShape)) {
        const check0 = grid[`${pt.x},${pt.y},0`];
        if (!check0 || check0.type === 'empty') {
          expandZoneAvailable++;
        }
      }
    });
  });

  // Calculate percentage of vacant buildable cells
  const buildReservedRatio = (totalSiteAvailableCells - builtFootprint) / (totalSiteAvailableCells + 1);
  const reserveTarget = params.expansionReserve / 100;
  const reserveDeviation = Math.max(0, reserveTarget - buildReservedRatio) * 180;

  const rawExpansion = 40 + (expandZoneAvailable * 3.5) - reserveDeviation;
  const expansionPotentialScore = Math.max(10, Math.min(100, Math.floor(rawExpansion)));

  // 7. SITE CENTERING & EDGE SETBACK (Gravitate settlement towards center of site)
  const siteCenterX = (gridWidth - 1) / 2;
  const siteCenterY = (gridHeight - 1) / 2;
  const maxCenterDist = Math.sqrt(siteCenterX * siteCenterX + siteCenterY * siteCenterY);

  let totalUnitDistToCenter = 0;
  let edgeUnitCount = 0;

  units.forEach(u => {
    const p = u.gridCoords[0];
    const d = distance(p, { x: siteCenterX, y: siteCenterY });
    totalUnitDistToCenter += d;
    if (p.x <= 2 || p.x >= gridWidth - 3 || p.y <= 2 || p.y >= gridHeight - 3) {
      edgeUnitCount++;
    }
  });

  const avgUnitDistCenter = units.length > 0 ? totalUnitDistToCenter / units.length : 0;
  const rawCentrality = 100 - (avgUnitDistCenter / (maxCenterDist * 0.40)) * 75 - (edgeUnitCount * 15);
  const centralityScore = Math.max(10, Math.min(100, Math.floor(rawCentrality)));

  // Weighted overall calculation
  const w = params.weights;
  const wSum = w.accessibility + w.courtyard + w.infrastructure + w.density + w.clustering + w.expansion;
  const normW = wSum > 0 ? wSum : 1;

  const baseOverall = (accessibilityScore * w.accessibility +
      courtyardScore * w.courtyard +
      infrastructureScore * w.infrastructure +
      densityScore * w.density +
      clusterQualityScore * w.clustering +
      expansionPotentialScore * w.expansion) /
      normW;

  // Combine base score with site centrality score (25% weight on central layout)
  const overall = Math.floor(baseOverall * 0.75 + centralityScore * 0.25);

  return {
    walkability: Math.floor(accessibilityScore * 0.95), // mapped to walkability metric for backwards compat
    accessibility: accessibilityScore,
    courtyardQuality: courtyardScore,
    infrastructureEfficiency: infrastructureScore,
    density: densityScore,
    clusteringQuality: clusterQualityScore,
    expansionPotential: expansionPotentialScore,
    overall
  };
}

/**
 * AUTOMATED MULTI-OBJECTIVE RANKING AND CANDIDATE LOOPS
 * Generates 50 to 200 candidates stochastically.
 * Compiles:
 * - Solution A (Top Accessibility)
 * - Solution B (Top Expansion Potential)
 * - Solution C (Top Weighted Overall score)
 */
export function generateMultiSolutionSet(params: GenerationParams): MultiSolutionSet {
  const iterationsCount = Math.max(30, Math.min(200, params.iterations));
  const candidates: SettlementState[] = [];
  
  let baseSeed = 0;
  if (typeof params.seed === 'string') {
    const num = Number(params.seed);
    if (!isNaN(num) && params.seed.trim() !== '') {
      baseSeed = num;
    } else {
      let hash = 0;
      for (let i = 0; i < params.seed.length; i++) {
        const char = params.seed.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      baseSeed = Math.abs(hash) % 1000000;
    }
  } else if (typeof params.seed === 'number') {
    baseSeed = params.seed;
  }

  for (let i = 0; i < iterationsCount; i++) {
    let bias: 'walkability' | 'expansion' | 'balanced' = 'balanced';
    if (i % 3 === 0) bias = 'walkability';
    else if (i % 3 === 1) bias = 'expansion';
    else bias = 'balanced';

    const candidate = generateSingleCandidate(params, baseSeed * 1000 + i, bias);
    candidates.push(candidate);
  }

  // 1. Solution A: Rank candidates for Accessibility & Walkability
  const rankedA = candidates
    .map((c, i) => ({
      index: i,
      score: c.metrics.accessibility * 0.65 + c.metrics.walkability * 0.35
    }))
    .sort((a, b) => b.score - a.score);

  const idxA = rankedA[0]?.index ?? 0;

  // 2. Solution B: Rank candidates for Expansion Potential & Buffer Capacity
  const rankedB = candidates
    .map((c, i) => ({
      index: i,
      score: c.metrics.expansionPotential * 0.75 + c.metrics.infrastructureEfficiency * 0.25
    }))
    .sort((a, b) => b.score - a.score);

  // Pick best candidate for B that is NOT equal to idxA
  let idxB = rankedB[0]?.index ?? 0;
  for (const item of rankedB) {
    if (item.index !== idxA) {
      idxB = item.index;
      break;
    }
  }

  // 3. Solution C: Rank candidates for Multi-Objective Balanced Score (Courtyard Enclosure, Clustering & Overall Score)
  const rankedC = candidates
    .map((c, i) => ({
      index: i,
      score: c.metrics.courtyardQuality * 0.40 + c.metrics.clusteringQuality * 0.35 + c.metrics.overall * 0.25
    }))
    .sort((a, b) => b.score - a.score);

  // Pick best candidate for C that is NOT equal to idxA AND NOT equal to idxB
  let idxC = rankedC[0]?.index ?? 0;
  for (const item of rankedC) {
    if (item.index !== idxA && item.index !== idxB) {
      idxC = item.index;
      break;
    }
  }

  // Clone states and tag candidate identifiers
  const solutionA = JSON.parse(JSON.stringify(candidates[idxA])) as SettlementState;
  solutionA.candidateKey = 'A';

  const solutionB = JSON.parse(JSON.stringify(candidates[idxB])) as SettlementState;
  solutionB.candidateKey = 'B';

  const solutionC = JSON.parse(JSON.stringify(candidates[idxC])) as SettlementState;
  solutionC.candidateKey = 'C';

  return {
    solutionA,
    solutionB,
    solutionC,
    iterationsRun: iterationsCount
  };
}

/**
 * PRE-INTEGRATED TRANSITIONAL FULL-SCALE SIMULATION BUILDER
 * (Maintains single-schema generation compatibility with old structures)
 */
export function generateFullSettlementProcess(width = 36, height = 36): SettlementState {
  const params: GenerationParams = {
    ...DEFAULT_PARAMS,
    siteWidth: width,
    siteHeight: height
  };
  const set = generateMultiSolutionSet(params);
  return set.solutionC; // Default return is the overall highest score
}
