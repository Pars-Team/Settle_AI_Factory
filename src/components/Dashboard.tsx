/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { SettlementState, GenerationParams, MultiSolutionSet } from '../types';
import { 
  Play, 
  Pause, 
  Award, 
  Sparkles, 
  Sliders, 
  CheckCircle2, 
  GitBranch, 
  FileText, 
  Camera,
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { validateCourtyards } from '../utils/courtyardValidator';

interface DashboardProps {
  state: SettlementState;
  activeStage: number;
  setActiveStage: (stage: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  params: GenerationParams;
  onChangeParams: (newParams: GenerationParams) => void;
  selectedSolutionKey: 'A' | 'B' | 'C';
  onChangeSelectedSolutionKey: (key: 'A' | 'B' | 'C') => void;
  solutions: MultiSolutionSet | null;
  onRegenerate: () => void;
  onOpenReport?: () => void;
  onOpenExport?: () => void;
  onOpenCourtyardValidator?: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function Dashboard({
  state,
  activeStage,
  setActiveStage,
  isPlaying,
  setIsPlaying,
  params,
  onChangeParams,
  selectedSolutionKey,
  onChangeSelectedSolutionKey,
  solutions,
  onRegenerate,
  onOpenReport,
  onOpenExport,
  onOpenCourtyardValidator,
  isOpen,
  onToggle
}: DashboardProps) {
  const { cores, units, courtyards, paths, metrics } = state;
  const courtyardReport = validateCourtyards(state);

  // Local active subtab for analysis results
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'kpi' | 'telemetry'>('kpi');

  // Statistics counters
  const totalContainers = units.length;
  const totalPopulation = units.reduce((acc, u) => acc + u.capacity, 0);
  const totalFamilyArea = units.reduce((acc, u) => acc + u.area, 0);

  const getStageDescription = (stage: number): string => {
    switch (stage) {
      case 1:
        return 'قرارگیری پله‌های اضطراری خودگردان و هسته‌های تاسیساتی (Cores) به عنوان فوانداسیون جاذبه اولیه کلاسترها.';
      case 2:
        return 'رشد کانتینرها به صورت پایین به بالا در مجاورت فیزیکی هسته‌ها جهت ممانعت از بادزدگی و توزیع بار ستونی.';
      case 3:
        return 'پدیداری کلاسترها یا نواحی خودسازمانده؛ این فاز انسجام بافت محلی کانتینرها را مدیریت می‌کند.';
      case 4:
        return 'جهت‌گیری هوشمند بازشو کانتینرها به فضای امن مرکزی کلاستر به عنوان میانسرا (حیاط مشترک پیاده).';
      case 5:
        return 'رسم شاه‌راه‌های ارتباطی ثانویه به پله‌ها و اتصال کوچه‌های کفی با رعایت بستر توپوگرافی خاک.';
      case 6:
        return 'تکمیل چرخه تکامل مورفوژنتیک. انسجام همسایگی، کانون‌های پیاده، باغچه میانسراها و دسترسی‌های ایمن.';
      default:
        return '';
    }
  };

  const getMetricTheme = (score: number) => {
    if (score >= 80) return { text: 'text-[#E65100]', progress: 'bg-[#E65100]' };
    if (score >= 60) return { text: 'text-[#2D2926]', progress: 'bg-[#2D2926]' };
    return { text: 'text-[#8B8378]', progress: 'bg-[#8B8378]' };
  };

  return (
    <div
      className={`h-full border-r border-[#D9D4CF] bg-[#FDFCFB] flex flex-col relative transition-all duration-300 ease-in-out select-none ${
        isOpen ? 'w-[380px]' : 'w-0'
      }`}
      dir="rtl"
    >
      {/* Sidebar toggle tab */}
      <button
        onClick={onToggle}
        className="absolute right-[-28px] top-1/2 -translate-y-1/2 bg-[#2D2926] text-white hover:bg-[#E65100] transition active:scale-95 duration-200 h-16 w-7 flex items-center justify-center rounded-r shadow-md border border-[#2D2926]"
        title={isOpen ? 'بستن پنل آنالیز و تکامل' : 'باز کردن پنل آنالیز و تکامل'}
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Internal Content Wrapper */}
      <div className={`h-full flex flex-col overflow-hidden min-w-[380px] ${!isOpen ? 'opacity-0 pointer-events-none' : ''}`}>
        
        {/* Header Title indicator */}
        <div className="p-4 border-b border-[#D9D4CF] flex items-center justify-between bg-[#F6F4F0]">
          <div className="flex items-center gap-2">
            <GitBranch size={15} className="text-[#E65100]" />
            <h2 className="text-[12px] font-serif font-black text-[#2D2926] tracking-tight">
              آنالیز و نتایج شبیه‌سازی
            </h2>
          </div>
          <span className="text-[9px] bg-[#E65100]/10 text-[#E65100] border border-[#E65100]/30 px-1.5 py-0.5 font-bold font-mono">
            CANDIDATES: {solutions?.iterationsRun || 80}
          </span>
        </div>

        {/* PARALLEL CANDIDATES SELECTOR CARDS */}
        <div className="p-3 bg-[#F7F5F2] border-b border-[#D9D4CF] flex flex-col gap-2">
          <span className="text-[9.5px] font-bold text-[#8B8378] uppercase block">
            طرح‌های تکامل یافته موازی (Parallel Solver Solutions):
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {/* Candidate A Card */}
            <div 
              onClick={() => onChangeSelectedSolutionKey('A')}
              className={`cursor-pointer p-2 border transition rounded-sm flex flex-col justify-between ${
                selectedSolutionKey === 'A' 
                  ? 'bg-white border-[#2D2926] ring-1 ring-[#2D2926]' 
                  : 'bg-white border-[#D9D4CF] hover:border-[#8B8378]'
              }`}
            >
              <div>
                <span className="text-[8.5px] font-bold text-[#E65100] block">طرح الف</span>
                <span className="text-[9px] font-medium text-[#2D2926] leading-tight block truncate mt-0.5">بیشترین سهولت پیاده</span>
              </div>
              <div className="border-t border-[#EEEBE6] pt-1 mt-1.5 flex justify-between text-[10px] font-mono">
                <span className="text-gray-500">دسترسی:</span>
                <strong className="text-emerald-700">{solutions?.solutionA.metrics.accessibility}٪</strong>
              </div>
            </div>

            {/* Candidate B Card */}
            <div 
              onClick={() => onChangeSelectedSolutionKey('B')}
              className={`cursor-pointer p-2 border transition rounded-sm flex flex-col justify-between ${
                selectedSolutionKey === 'B' 
                  ? 'bg-white border-[#2D2926] ring-1 ring-[#2D2926]' 
                  : 'bg-white border-[#D9D4CF] hover:border-[#8B8378]'
              }`}
            >
              <div>
                <span className="text-[8.5px] font-bold text-[#E65100] block">طرح ب</span>
                <span className="text-[9px] font-medium text-[#2D2926] leading-tight block truncate mt-0.5">توسعه‌پذیر لبه‌ای</span>
              </div>
              <div className="border-t border-[#EEEBE6] pt-1 mt-1.5 flex justify-between text-[10px] font-mono">
                <span className="text-gray-500">ظرفیت:</span>
                <strong className="text-emerald-700">{solutions?.solutionB.metrics.expansionPotential}٪</strong>
              </div>
            </div>

            {/* Candidate C Card */}
            <div 
              onClick={() => onChangeSelectedSolutionKey('C')}
              className={`cursor-pointer p-2 border transition rounded-sm flex flex-col justify-between ${
                selectedSolutionKey === 'C' 
                  ? 'bg-[#E65100]/5 border-[#E65100] ring-1 ring-[#E65100]' 
                  : 'bg-white border-[#D9D4CF] hover:border-[#8B8378]'
              }`}
            >
              <div>
                <span className="text-[8.5px] font-bold text-white bg-[#E65100] px-1 rounded-2xs inline-block">طرح ج ✧</span>
                <span className="text-[9px] font-bold text-[#2D2926] leading-tight block truncate mt-0.5">تعادل چندهدفه بهینه</span>
              </div>
              <div className="border-t border-[#EEEBE6] pt-1 mt-1.5 flex justify-between text-[10px] font-mono">
                <span className="text-gray-500">نمره کل:</span>
                <strong className="text-[#E65100]">{solutions?.solutionC.metrics.overall}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ANALYSIS TAB PANEL SWITCHERS (KPI vs TELEMETRY) */}
        <div className="grid grid-cols-2 border-b border-[#D9D4CF] text-xs font-bold font-serif">
          <button
            onClick={() => setActiveAnalysisTab('kpi')}
            className={`py-2 text-center transition ${
              activeAnalysisTab === 'kpi'
                ? 'border-b-2 border-b-[#E65100] text-[#E65100] bg-white lg:bg-[#EEEBE6]/20'
                : 'text-[#8B8378] hover:text-[#2D2926] bg-white'
            }`}
          >
            سنجش کیفی و کارایی بافت
          </button>
          <button
            onClick={() => setActiveAnalysisTab('telemetry')}
            className={`py-2 text-center transition ${
              activeAnalysisTab === 'telemetry'
                ? 'border-b-2 border-b-[#E65100] text-[#E65100] bg-white lg:bg-[#EEEBE6]/20'
                : 'text-[#8B8378] hover:text-[#2D2926] bg-white'
            }`}
          >
            آمار فیزیکی و مصالح
          </button>
        </div>

        {/* Dynamic scrollable subtab content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin max-h-[calc(100vh-22rem)]">
          
          {/* TAB 1: KPI INDICATORS */}
          {activeAnalysisTab === 'kpi' && (
            <div className="flex flex-col gap-3.5 animate-fade-in text-right">
              
              <div className="flex justify-between items-center bg-[#EEEBE6]/30 p-2 border border-[#D9D4CF]">
                <span className="text-[10px] font-bold text-[#8B8378]">امتیاز توزیع فضایی طرح فعال:</span>
                <strong className="text-sm font-serif italic text-[#E65100]">{metrics.overall} / ۱۰۰</strong>
              </div>

              {/* COURTYARD VALIDATOR STATUS WIDGET */}
              <div 
                onClick={onOpenCourtyardValidator}
                className={`p-2.5 border rounded cursor-pointer transition flex flex-col gap-1.5 ${
                  courtyardReport.allValid
                    ? 'bg-emerald-50/50 border-emerald-300 hover:border-emerald-500'
                    : 'bg-rose-50/70 border-rose-300 hover:border-rose-500 ring-1 ring-rose-200'
                }`}
              >
                <div className="flex justify-between items-center text-[10.5px]">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck size={13} className={courtyardReport.allValid ? 'text-emerald-700' : 'text-rose-600'} />
                    <span className={courtyardReport.allValid ? 'text-emerald-900' : 'text-rose-900'}>
                      اعتبارسنجی مجاورت حیاط‌ها
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded ${
                    courtyardReport.allValid
                      ? 'bg-emerald-200/80 text-emerald-800'
                      : 'bg-rose-200 text-rose-800'
                  }`}>
                    {courtyardReport.allValid ? '✅ مجاز' : `⚠️ ${courtyardReport.invalidCourtyardsCount} غیرمجاز`}
                  </span>
                </div>
                <p className="text-[9.5px] text-[#4A443F] leading-tight">
                  {courtyardReport.allValid
                    ? 'تمام حیاط‌ها حداقل از ۲ جهت با یونیت‌های مسکونی مجاورت دارند.'
                    : `هشدار: ${courtyardReport.invalidCourtyardsCount} حیاط دارای کمتر از ۲ جهت مجاورت با یونیت‌ها است.`}
                </p>
                <span className="text-[9px] font-bold text-[#E65100] underline mt-0.5">
                  مشاهده ماتریس جهت‌ها و جزئیات اعتبارسنجی ←
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  {
                    key: 'accessibility',
                    title: 'ارتباط با پله‌های فرار عمودی',
                    score: metrics.accessibility
                  },
                  {
                    key: 'courtyardQuality',
                    title: 'محصوریت و تناسب باغچه میانسراها',
                    score: metrics.courtyardQuality
                  },
                  {
                    key: 'infrastructureEfficiency',
                    title: 'راندمان کابل‌کشی و لوله‌کشی تاسیسات',
                    score: metrics.infrastructureEfficiency
                  },
                  {
                    key: 'density',
                    title: 'سطح اشغال تراکم بهینه اراضی',
                    score: metrics.density
                  },
                  {
                    key: 'clusteringQuality',
                    title: 'انسجام و پایداری کلاستر همسایگی',
                    score: metrics.clusteringQuality
                  },
                  {
                    key: 'expansionPotential',
                    title: 'فضای رزور جهت توسعه موقت به دائم',
                    score: metrics.expansionPotential
                  }
                ].map(item => {
                  const theme = getMetricTheme(item.score);
                  return (
                    <div key={item.key} className="p-2 border border-[#D9D4CF] bg-white rounded-xs">
                      <div className="flex justify-between items-center text-[10.5px] mb-1">
                        <strong className="text-[#2D2926] font-bold">{item.title}</strong>
                        <span className={`font-mono font-bold ${theme.text}`}>{item.score}٪</span>
                      </div>
                      <div className="w-full h-1 bg-[#EEEBE6] overflow-hidden rounded-full">
                        <div 
                          className={`h-full transition-all duration-700 ${theme.progress}`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TELEMETRY CENSUS DATA */}
          {activeAnalysisTab === 'telemetry' && (
            <div className="flex flex-col gap-3 animate-fade-in text-right text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2.5 border border-[#D9D4CF] text-center">
                  <span className="text-[9px] text-[#8B8378] font-bold block">کانتینرهای استقراریافته</span>
                  <strong className="text-sm font-bold text-[#2D2926] block mt-0.5">{totalContainers} بلوک</strong>
                </div>
                <div className="bg-white p-2.5 border border-[#D9D4CF] text-center">
                  <span className="text-[9px] text-[#8B8378] font-bold block">شهروندان موقت اسکان شده</span>
                  <strong className="text-sm font-bold text-[#E65100] block mt-0.5">{totalPopulation} نفر</strong>
                </div>
                <div className="bg-white p-2.5 border border-[#D9D4CF] text-center">
                  <span className="text-[9px] text-[#8B8378] font-bold block">غلاف‌های عمودی خدماتی</span>
                  <strong className="text-sm font-bold text-[#2D2926] block mt-0.5">{cores.length} هسته</strong>
                </div>
                <div className="bg-white p-2.5 border border-[#D9D4CF] text-center">
                  <span className="text-[9px] text-[#8B8378] font-bold block">حیاط‌های مرکزی و میانسرا</span>
                  <strong className="text-sm font-bold text-[#E65100] block mt-0.5">{courtyards.length} محوطه</strong>
                </div>
              </div>

              <div className="bg-white p-3 border border-[#D9D4CF] flex flex-col gap-1.5 text-[10.5px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">مجموع زیربنای ناخالص مسکونی:</span>
                  <strong className="text-[#2D2926] font-mono">{totalFamilyArea} مترمربع</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">متراژ معابر پیاده و شریانی کلاستر:</span>
                  <strong className="text-[#2D2926] font-mono">{~~(paths.reduce((s, p) => s + p.coords.length, 0) * 3)} متر</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">سقف مجاز کانتینر طبقاتی در ارتفاع:</span>
                  <strong className="text-[#2D2926] font-mono">{params.maxFloors} طبقه</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">شاخص بذر فعال تولیدی بوم:</span>
                  <strong className="text-[#E65100] font-mono font-bold">SEED #{params.seed ?? 0}</strong>
                </div>
              </div>
              
              {onOpenReport && (
                <button
                  onClick={onOpenReport}
                  className="w-full mt-1.5 py-2 px-3 bg-[#E65100]/10 hover:bg-[#E65100]/20 text-[#E65100] border border-[#E65100]/30 transition flex items-center justify-center gap-1 cursor-pointer text-[10px] font-bold"
                >
                  <FileText size={12} />
                  <span>بررسی تفصیلی گزارش کارایی کلاسترها</span>
                </button>
              )}

              {onOpenExport && (
                <button
                  onClick={onOpenExport}
                  className="w-full mt-1.5 py-2 px-3 bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 transition flex items-center justify-center gap-1.5 cursor-pointer text-[10.5px] font-extrabold"
                >
                  <Camera size={12} />
                  <span>خروجی اسکرین‌شات و آلبوم نقشه‌ها</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* EVOLUTIONARY GROWTH STAGE SELECTOR (TIMELINE STEP-BY-STEP PLAY) */}
        <div className="p-3 border-t border-[#D9D4CF] bg-[#F7F5F2] flex flex-col gap-2 mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-bold text-[#8B8378] uppercase">فاز فیزیکی تکامل همسایگی (Growth Phase):</span>
            <span className="text-[10px] bg-[#2D2926] text-white px-2 py-0.2 font-mono tracking-wider font-bold">STAGE {activeStage}/6</span>
          </div>

          <div className="grid grid-cols-6 gap-1 bg-white p-1 rounded-sm border border-[#D9D4CF]">
            {[1, 2, 3, 4, 5, 6].map(stg => (
              <button
                key={stg}
                onClick={() => {
                  setActiveStage(stg);
                  setIsPlaying(false);
                }}
                className={`py-1 rounded font-mono font-bold text-center text-xs transition cursor-pointer ${
                  activeStage === stg
                    ? 'bg-[#E65100] text-white shadow-xs'
                    : 'text-[#8B8378] hover:bg-[#F7F5F2]'
                }`}
                title={`پرش دستی به فاز ساختاری ${stg}`}
              >
                {stg}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 bg-white/70 p-2.5 border border-[#D9D4CF] rounded-sm text-[10px]">
            <p className="text-[#4A443F] leading-relaxed">
              <strong className="text-[#E65100]">فاز فعال {activeStage}:</strong> {getStageDescription(activeStage)}
            </p>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-full py-1.5 px-3 transition text-xs font-bold border rounded-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                isPlaying
                  ? 'bg-[#E65100] text-white border-[#E65100]'
                  : 'bg-white border-[#D9D4CF] text-[#2D2926] hover:bg-[#F7F5F2]'
              }`}
            >
              {isPlaying ? <Pause size={12} className="animate-pulse" /> : <Play size={12} />}
              <span>{isPlaying ? 'توقف انیمیشن مورفوژنتیک' : 'آغاز پیش‌نمایش انیمیشن همه‌جانبه'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
