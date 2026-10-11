/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettlementState, Courtyard } from '../types';

export interface CourtyardValidationStatus {
  courtyardId: string;
  clusterId: string;
  x: number;
  y: number;
  size: number;
  directionCount: number; // Number of cardinal directions (0-4) with adjacent residential units
  adjacentDirections: {
    north: boolean;
    south: boolean;
    west: boolean;
    east: boolean;
  };
  isValid: boolean; // True if directionCount >= 2
  messageFa: string;
}

export interface SettlementCourtyardValidationReport {
  totalCourtyards: number;
  validCourtyardsCount: number;
  invalidCourtyardsCount: number;
  allValid: boolean;
  statuses: CourtyardValidationStatus[];
  invalidCourtyardIds: string[];
}

/**
 * Validates courtyard placement rules across a settlement state.
 * Rule: Every courtyard MUST be adjacent to residential units from AT LEAST 2 directions (North, South, East, West).
 */
export function validateCourtyards(state: SettlementState): SettlementCourtyardValidationReport {
  if (!state || !state.courtyards || state.courtyards.length === 0) {
    return {
      totalCourtyards: 0,
      validCourtyardsCount: 0,
      invalidCourtyardsCount: 0,
      allValid: true,
      statuses: [],
      invalidCourtyardIds: []
    };
  }

  // Build a Set of all unit cell locations on level 0 (and all levels)
  const unitFootprint = new Set<string>();
  
  // From state.units
  if (state.units) {
    state.units.forEach(u => {
      u.gridCoords.forEach(pt => {
        unitFootprint.add(`${pt.x},${pt.y}`);
      });
    });
  }

  // Also check state.grid for unit cells
  if (state.grid) {
    for (const key in state.grid) {
      const cell = state.grid[key];
      if (cell && cell.type === 'unit') {
        unitFootprint.add(`${cell.x},${cell.y}`);
      }
    }
  }

  const statuses: CourtyardValidationStatus[] = state.courtyards.map(court => {
    let hasNorth = false;
    let hasSouth = false;
    let hasWest = false;
    let hasEast = false;

    // Check all cells of the courtyard for adjacent unit cells in 4 cardinal directions
    court.gridCoords.forEach(pt => {
      if (unitFootprint.has(`${pt.x},${pt.y - 1}`)) hasNorth = true;
      if (unitFootprint.has(`${pt.x},${pt.y + 1}`)) hasSouth = true;
      if (unitFootprint.has(`${pt.x - 1},${pt.y}`)) hasWest = true;
      if (unitFootprint.has(`${pt.x + 1},${pt.y}`)) hasEast = true;
    });

    let directionCount = 0;
    if (hasNorth) directionCount++;
    if (hasSouth) directionCount++;
    if (hasWest) directionCount++;
    if (hasEast) directionCount++;

    const isValid = directionCount >= 2;

    let messageFa = '';
    if (isValid) {
      messageFa = `تایید شده: مجاورت از ${directionCount} جهت با یونیت‌های مسکونی`;
    } else if (directionCount === 1) {
      messageFa = `نقض قانون: حیاط فقط از ۱ جهت با یونیت مجاورت دارد (حداقل ۲ جهت الزامی است)`;
    } else {
      messageFa = `نقض قانون: حیاط مجاورت مستقیمی با یونیت‌های مسکونی ندارد`;
    }

    return {
      courtyardId: court.id,
      clusterId: court.clusterId,
      x: court.x,
      y: court.y,
      size: court.size,
      directionCount,
      adjacentDirections: {
        north: hasNorth,
        south: hasSouth,
        west: hasWest,
        east: hasEast
      },
      isValid,
      messageFa
    };
  });

  const invalidStatuses = statuses.filter(s => !s.isValid);
  const invalidCourtyardIds = invalidStatuses.map(s => s.courtyardId);

  return {
    totalCourtyards: statuses.length,
    validCourtyardsCount: statuses.length - invalidStatuses.length,
    invalidCourtyardsCount: invalidStatuses.length,
    allValid: invalidStatuses.length === 0,
    statuses,
    invalidCourtyardIds
  };
}
