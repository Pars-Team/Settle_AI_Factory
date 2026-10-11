/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnitType = 'single' | 'medium' | 'large';

export interface Unit {
  id: string;
  type: UnitType;
  capacity: number;
  area: number;
  containerCount: number;
  color: string;
  nameFa: string;
  nameEn: string;
  level: number; // 0, 1, 2 for container stacking
  coreId: string;
  gridCoords: Array<{ x: number; y: number; level: number }>;
  adjacencyPreference: string;
  adjacencyPreferenceFa: string;
  originalProperties?: {
    type: UnitType;
    capacity: number;
    area: number;
    containerCount: number;
    color: string;
    nameFa: string;
    nameEn: string;
    gridCoords: Array<{ x: number; y: number; level: number }>;
    adjacencyPreference: string;
    adjacencyPreferenceFa: string;
  };
}

export type CoreType = 'mini' | 'cross' | 'courtyard_core';

export interface Core {
  id: string;
  type: CoreType;
  x: number;
  y: number;
  capacity: number;
  nameFa: string;
  nameEn: string;
  gridCoords: Array<{ x: number; y: number }>;
}

export interface Cluster {
  id: string;
  coreId: string;
  unitIds: string[];
  color: string;
  boundary: Array<{ x: number; y: number }>;
}

export interface Courtyard {
  id: string;
  clusterId: string;
  x: number;
  y: number;
  size: number; // in grid cells
  gridCoords: Array<{ x: number; y: number }>;
}

export type PathType = 'primary' | 'secondary' | 'pedestrian';

export interface Path {
  id: string;
  type: PathType;
  coords: Array<{ x: number; y: number }>;
}

export interface EvaluationMetrics {
  walkability: number;            // سهولت دسترسی ساکنین به حیاط‌ها و مراکز خدمات
  accessibility: number;          // ارتباط مستقیم با هسته‌های چندمنظوره و فاصله به راه‌ها
  clusteringQuality: number;      // کیفیت همسایگی و انسجام ساختار کلاسترها
  courtyardQuality: number;       // مساحت حیاط متناسب با تعداد و شعاع پوشش
  density: number;                // تراکم بهینه فضا و جلوگیری از اتلاف زمین
  expansionPotential: number;     // توانایی گسترش ارگانیک در مرزها
  infrastructureEfficiency: number;// راندمان مسیرهای تاسیسات و راهروها
  overall: number;                // نمره کل وزنی سکونتگاه
}

export type GreenSpaceTier = 1 | 2;

export interface GreenSpace {
  id: string;
  clusterId?: string;
  tier: GreenSpaceTier;
  gridCoords: Array<{ x: number; y: number }>;
}

export interface GridCell {
  x: number;
  y: number;
  level: number;
  type: 'empty' | 'core' | 'unit' | 'courtyard' | 'path' | 'obstacle' | 'water' | 'entrance' | 'public_space' | 'green_space';
  occupiedId: string; // ID of the core, unit, courtyard, or green space
  tier?: GreenSpaceTier;
}

export type SiteShape = 'rectangular' | 'irregular' | 'skewed' | 'custom_boundary';
export type TerrainType = 
  | 'flat' 
  | 'sloped' 
  | 'sloped_n' 
  | 'sloped_s' 
  | 'sloped_e' 
  | 'sloped_w' 
  | 'sloped_ne' 
  | 'sloped_se' 
  | 'sloped_sw' 
  | 'sloped_nw' 
  | 'terraced' 
  | 'valley' 
  | 'coastal';
export type DensityPreset = 'low' | 'medium' | 'high';

export interface GenerationParams {
  siteWidth: number;
  siteHeight: number;
  siteShape: SiteShape;
  terrainType: TerrainType;
  demographicMode: 'total' | 'distribution';
  totalHouseholds: number;
  singleProp: number; // percentage (e.g. 20)
  mediumProp: number; // percentage (e.g. 50)
  largeProp: number;  // percentage (e.g. 30)
  maxFloors: number;
  targetDensity: DensityPreset;
  maxWalkDistanceCore: number;
  maxWalkDistanceShared: number;
  preferredClusterSize: number;
  maxClusterSize: number;
  courtyardSizeRatio: number; // e.g. 20 for 0.20
  expansionReserve: number; // e.g. 15 for 0.15
  iterations: number; // candidates count (50-200)
  weights: {
    accessibility: number; // weight 0-100
    courtyard: number;
    infrastructure: number;
    density: number;
    clustering: number;
    expansion: number;
  };
  customBoundaryPoints?: Array<{ x: number; y: number }>;
  obstacles?: Array<{ x: number; y: number }>;
  seed?: number | string; // Optional seed for stochastic candidate generation
}

export interface SettlementState {
  gridWidth: number;
  gridHeight: number;
  siteShape: SiteShape;
  terrainType: TerrainType;
  cores: Core[];
  units: Unit[];
  clusters: Cluster[];
  courtyards: Courtyard[];
  greenSpaces?: GreenSpace[];
  entrances?: Array<{ id: string; x: number; y: number }>;
  publicSpaces?: Array<{ id: string; x: number; y: number }>;
  paths: Path[];
  grid: Record<string, GridCell>; // key: "x,y,level"
  terrainZ: Record<string, number>; // key: "x,y" - z height scale
  currentStep: number;
  totalSteps: number;
  metrics: EvaluationMetrics;
  candidateKey?: 'A' | 'B' | 'C'; // indicates if it is Top Accessibility, Top Expansion, or Top Overall
}

export interface MultiSolutionSet {
  solutionA: SettlementState; // Highest Accessibility
  solutionB: SettlementState; // Highest Expansion
  solutionC: SettlementState; // Best Overall / Weighted
  iterationsRun: number;
}
