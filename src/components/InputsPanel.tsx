/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sliders, Map, Users, ArrowLeft, ArrowRight, Settings, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, Shuffle, Save, Copy, Trash2, Check } from 'lucide-react';
import { GenerationParams } from '../types';

interface InputsPanelProps {
  params: GenerationParams;
  onChangeParams: (newParams: GenerationParams) => void;
  onRegenerate: () => void;
  isOpen: boolean;
  onToggle: () => void;
  activeStep: 1 | 2;
  setActiveStep: (step: 1 | 2) => void;
}

export default function InputsPanel({
  params,
  onChangeParams,
  onRegenerate,
  isOpen,
  onToggle,
  activeStep,
  setActiveStep,
}: InputsPanelProps) {
  // Distribution calculation helpers
  const norm = params.singleProp + params.mediumProp + params.largeProp;
  const calcSingles = Math.round(params.totalHouseholds * (params.singleProp / (norm || 1)));
  const calcMediums = Math.round(params.totalHouseholds * (params.mediumProp / (norm || 1)));
  const calcLarges = Math.max(0, params.totalHouseholds - (calcSingles + calcMediums));

  const [isSeedPanelExpanded, setIsSeedPanelExpanded] = useState<boolean>(false);
  const [newSeedInput, setNewSeedInput] = useState<string>(String(params.seed ?? ''));
  const [seedNameInput, setSeedNameInput] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const [savedSeeds, setSavedSeeds] = useState<Array<{ name: string; value: string | number }>>(() => {
    try {
      const stored = localStorage.getItem('saved_settlement_seeds');
      return stored ? JSON.parse(stored) : [
        { name: 'بافت متراکم کوهستانی', value: 'shiraz_zagros' },
        { name: 'شبکه گسترده جلگه‌ای', value: 'gilan_plain' },
        { name: 'تراکم مرکزگرا حیاط‌دار', value: 'yazd_desert' }
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setNewSeedInput(String(params.seed ?? ''));
  }, [params.seed]);

  const handleRandomizeSeed = () => {
    const randomWords = ['gorgan_forest', 'shushtar_water', 'kashan_fin', 'hormuz_red', 'bam_mud', 'tabriz_bazaar', 'yazd_wind', 'isfahan_square'];
    const rIdx = Math.floor(Math.random() * randomWords.length);
    const rNum = Math.floor(Math.random() * 9000) + 1000;
    const rSeed = `${randomWords[rIdx]}_${rNum}`;
    setNewSeedInput(rSeed);
  };

  const handleApplySeed = () => {
    onChangeParams({
      ...params,
      seed: newSeedInput
    });
  };

  const handleSaveSeed = () => {
    if (!seedNameInput.trim()) return;
    const item = { name: seedNameInput.trim(), value: newSeedInput };
    const updated = [item, ...savedSeeds];
    setSavedSeeds(updated);
    localStorage.setItem('saved_settlement_seeds', JSON.stringify(updated));
    setSeedNameInput('');
  };

  const handleLoadSavedSeed = (val: string | number) => {
    setNewSeedInput(String(val));
    onChangeParams({
      ...params,
      seed: val
    });
  };

  const handleDeleteSavedSeed = (idxToDelete: number) => {
    const updated = savedSeeds.filter((_, idx) => idx !== idxToDelete);
    setSavedSeeds(updated);
    localStorage.setItem('saved_settlement_seeds', JSON.stringify(updated));
  };

  const handleCopySeed = (val: string | number) => {
    navigator.clipboard.writeText(String(val));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleParamChange = <K extends keyof GenerationParams>(key: K, value: GenerationParams[K]) => {
    onChangeParams({
      ...params,
      [key]: value,
    });
  };

  const handlePropChange = (changedKey: 'singleProp' | 'mediumProp' | 'largeProp', newVal: number) => {
    newVal = Math.max(0, Math.min(100, newVal));
    const otherKeys = (['singleProp', 'mediumProp', 'largeProp'] as const).filter(k => k !== changedKey);
    const key1 = otherKeys[0];
    const key2 = otherKeys[1];
    
    const currentVal1 = params[key1];
    const currentVal2 = params[key2];
    const sumOthers = currentVal1 + currentVal2;
    
    let newVal1 = 0;
    let newVal2 = 0;
    const remaining = 100 - newVal;
    
    if (sumOthers > 0) {
      newVal1 = Math.round(remaining * (currentVal1 / sumOthers));
      newVal2 = remaining - newVal1;
    } else {
      newVal1 = Math.floor(remaining / 2);
      newVal2 = remaining - newVal1;
    }
    
    onChangeParams({
      ...params,
      [changedKey]: newVal,
      [key1]: newVal1,
      [key2]: newVal2
    });
  };

  return (
    <div
      className={`h-full border-l border-[#D9D4CF] bg-[#FDFCFB] flex flex-col relative transition-all duration-300 ease-in-out select-none ${
        isOpen ? 'w-[340px]' : 'w-0'
      }`}
      dir="rtl"
    >
      {/* Sidebar toggle tab */}
      <button
        onClick={onToggle}
        className="absolute left-[-28px] top-1/2 -translate-y-1/2 bg-[#2D2926] text-white hover:bg-[#E65100] transition active:scale-95 duration-200 h-16 w-7 flex items-center justify-center rounded-l shadow-md border border-[#2D2926]"
        title={isOpen ? 'بستن پنل تنظیمات ورودی' : 'باز کردن پنل تنظیمات ورودی'}
      >
        {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Internal Content Wrapper */}
      <div className={`h-full flex flex-col overflow-hidden min-w-[340px] ${!isOpen ? 'opacity-0 pointer-events-none' : ''}`}>
        {/* Header indicator */}
        <div className="p-4 border-b border-[#D9D4CF] flex items-center gap-2 bg-[#F6F4F0]">
          <Settings size={15} className="text-[#E65100]" />
          <h2 className="text-[12px] font-serif font-black text-[#2D2926] tracking-tight">
            طراحی بستر و فرم سکونتگاه
          </h2>
        </div>

        {/* Cohesive Stepped Wizard Indicators */}
        <div className="grid grid-cols-2 border-b border-[#D9D4CF]">
          <button
            onClick={() => setActiveStep(1)}
            className={`py-3 px-2 text-center text-[10.5px] font-bold border-l border-[#D9D4CF] transition flex items-center justify-center gap-1.5 ${
              activeStep === 1
                ? 'bg-[#2D2926] text-white'
                : 'bg-white text-[#8B8378] hover:bg-[#F7F5F2]'
            }`}
          >
            <Map size={12} />
            <span>گام ۱: هندسه زمین</span>
            {activeStep > 1 && <CheckCircle2 size={10} className="text-emerald-500" />}
          </button>
          <button
            onClick={() => setActiveStep(2)}
            className={`py-3 px-2 text-center text-[10.5px] font-bold transition flex items-center justify-center gap-1.5 ${
              activeStep === 2
                ? 'bg-[#2D2926] text-white'
                : 'bg-white text-[#8B8378] hover:bg-[#F7F5F2]'
            }`}
          >
            <Users size={12} />
            <span>گام ۲: خانوار و تراکم</span>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 scrollbar-thin max-h-[calc(100vh-8rem)]">
          
          {/* SEED MANAGEMENT ACCORDION */}
          <div className="border border-[#D9D4CF] bg-[#F7F5F2] p-2.5 rounded-sm flex flex-col gap-2">
            <button 
              onClick={() => setIsSeedPanelExpanded(!isSeedPanelExpanded)}
              className="w-full flex items-center justify-between text-right font-bold text-[#2D2926] text-[11px] hover:text-[#E65100] transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#E65100]" />
                <span>🌱 مدیریت بذر تولید (Stochastic Seed)</span>
              </div>
              <span className="text-[10px] text-[#8B8378] font-mono">
                {isSeedPanelExpanded ? '[-] بستن' : '[+] باز کردن'}
              </span>
            </button>
            
            {isSeedPanelExpanded && (
              <div className="mt-2 pt-2.5 border-t border-[#D9D4CF] flex flex-col gap-3 animate-fade-in text-[11px]">
                {/* Current Seed Display & Randomize */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#4A443F]">کد بذر تولید فعلی (String or Number):</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newSeedInput}
                      onChange={(e) => setNewSeedInput(e.target.value)}
                      placeholder="متن یا عدد دلخواه..."
                      className="flex-1 bg-white border border-[#D9D4CF] px-2 py-1.5 text-xs font-mono text-[#2D2926] outline-none"
                    />
                    <button
                      onClick={handleRandomizeSeed}
                      title="بذر تصادفی جدید"
                      className="p-1.5 bg-white border border-[#D9D4CF] hover:bg-[#EEEBE6] text-[#2D2926] transition cursor-pointer rounded-xs flex items-center justify-center"
                    >
                      <Shuffle size={13} />
                    </button>
                    <button
                      onClick={handleApplySeed}
                      className="px-2.5 bg-[#E65100] hover:bg-[#BF360C] text-white font-bold text-[10.5px] transition cursor-pointer rounded-xs"
                    >
                      اعمال
                    </button>
                  </div>
                </div>

                {/* Save Seed Option */}
                <div className="flex flex-col gap-1 mt-1 bg-white p-2 border border-[#EBE8E3]">
                  <span className="font-bold text-[#8B8378] text-[9.5px]">ذخیره بذر با نام دلخواه:</span>
                  <div className="flex gap-1.5 mt-1">
                    <input
                      type="text"
                      placeholder="مثال: بافت کویری..."
                      value={seedNameInput}
                      onChange={(e) => setSeedNameInput(e.target.value)}
                      className="flex-1 bg-white border border-[#D9D4CF] px-2 py-1 text-[10px] outline-none"
                    />
                    <button
                      onClick={handleSaveSeed}
                      className="px-2.5 py-1 bg-[#2D2926] hover:bg-[#E65100] text-white font-bold text-[10px] transition cursor-pointer rounded-xs flex items-center gap-1"
                    >
                      <Save size={10} />
                      <span>ذخیره</span>
                    </button>
                  </div>
                </div>

                {/* Saved Seeds List */}
                {savedSeeds.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="font-bold text-[#8B8378] text-[9.5px] mb-0.5">بذرهای ذخیره شده:</span>
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-1 divide-y divide-[#EBE8E3] bg-white border border-[#D9D4CF] p-1.5 scrollbar-thin">
                      {savedSeeds.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 text-[10px]">
                          <div 
                            onClick={() => handleLoadSavedSeed(item.value)}
                            className="flex-1 cursor-pointer hover:text-[#E65100] transition pr-1 flex flex-col gap-0.5"
                          >
                            <span className="font-bold text-[#4A443F] leading-snug">{item.name}</span>
                            <span className="font-mono text-[9px] text-gray-500 truncate max-w-[150px]" dir="ltr">
                              {String(item.value)}
                            </span>
                          </div>
                          <div className="flex gap-1 items-center">
                            <button
                              onClick={() => handleCopySeed(item.value)}
                              title="کپی کد بذر"
                              className="p-1 text-gray-400 hover:text-[#2D2926] transition cursor-pointer"
                            >
                              {copySuccess ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                            </button>
                            <button
                              onClick={() => handleDeleteSavedSeed(idx)}
                              title="حذف"
                              className="p-1 text-gray-400 hover:text-red-600 transition cursor-pointer"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 1: LAND & TOPOGRAPHY */}
          {activeStep === 1 && (
            <div className="flex flex-col gap-5 text-right animate-fade-in text-xs">
              
              <div className="bg-[#EEEBE6]/50 p-3.5 border border-[#D9D4CF] rounded-sm">
                <span className="text-[9px] font-bold text-[#8B8378] block mb-1">راهنمای گام اول:</span>
                <p className="text-[10px] text-[#4A443F] leading-relaxed">
                  هندسه پهنه استقرار و الگوی پستی‌بلندی زمین را تعیین نمایید. در حالت <strong className="text-[#E65100]">ترسیم دستی</strong>، می‌توانید روی صفحه بوم کلیک یا لمس کنید تا مرز خاک را مشخص یا موانع جاده را تعریف نمایید.
                </p>
              </div>

              {/* Dynamic Site Geometry Display (Binned based on Households) */}
              <div className="flex flex-col gap-2.5 bg-[#F7F5F2] p-3 border border-[#D9D4CF] rounded-sm">
                <label className="font-bold text-[#2D2926] text-[11px] block">انتخاب ابعاد کلی پهنه (ابعاد زمین):</label>
                
                <div className="flex flex-col gap-1.5">
                  {[
                    { key: 'small', label: 'کوچک', desc: 'پیشنهادی برای ۲۰ تا ۶۰ خانوار', width: 32 },
                    { key: 'medium', label: 'متوسط', desc: 'پیشنهادی برای ۱۲۰ تا ۱۶۰ خانوار', width: 54 },
                    { key: 'large', label: 'بزرگ', desc: 'پیشنهادی برای ۲۰۰ خانوار به بالا', width: 80 }
                  ].map((sizeOpt) => {
                    const currentCategory = params.siteWidth <= 42 ? 'small' : params.siteWidth <= 68 ? 'medium' : 'large';
                    const isSelected = currentCategory === sizeOpt.key;
                    
                    return (
                      <button
                        key={sizeOpt.key}
                        type="button"
                        onClick={() => {
                          const w = sizeOpt.width;
                          const h = params.siteShape === 'irregular' ? Math.round(w * 0.7) : w;
                          onChangeParams({
                            ...params,
                            siteWidth: w,
                            siteHeight: h
                          });
                        }}
                        className={`w-full p-2.5 text-right border transition rounded-xs flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#E65100]/5 border-[#E65100] text-[#E65100]'
                            : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-extrabold text-[11px]">{sizeOpt.label}</span>
                          <span className="text-[10px] font-mono opacity-80" dir="ltr">
                            {sizeOpt.width} × {params.siteShape === 'irregular' ? Math.round(sizeOpt.width * 0.7) : sizeOpt.width} ({sizeOpt.width * 3}m × {Math.round((params.siteShape === 'irregular' ? sizeOpt.width * 0.7 : sizeOpt.width) * 3)}m)
                          </span>
                        </div>
                        <span className="text-[9.5px] text-gray-500 font-medium">{sizeOpt.desc}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 my-1 border-t border-[#D9D4CF]/60 pt-2">
                  <div className="bg-white border border-[#D9D4CF] p-1.5 text-center text-[10px]">
                    عرض بستر: <strong className="font-mono text-[#E65100]">{params.siteWidth}</strong> ({~~(params.siteWidth * 3)} متر)
                  </div>
                  <div className="bg-white border border-[#D9D4CF] p-1.5 text-center text-[10px]">
                    طول بستر: <strong className="font-mono text-[#E65100]">{params.siteHeight}</strong> ({~~(params.siteHeight * 3)} متر)
                  </div>
                </div>

                <p className="text-[10px] text-[#8B8378] leading-relaxed pt-1.5 border-t border-[#D9D4CF]/50">
                  🛠️ برای تغییر الگوی مرزگیری زمین مالکیتی (مربعی، کشیده یا ترسیم چندضلعی دستی)، به پنل <strong className="text-[#2D2926]">طراحی زمین</strong> در گوشه بالا-راست روی نقشه مراجعه کنید.
                </p>
              </div>

              {/* Topography notice indicating it has moved to map editor */}
              <div className="bg-[#EEEBE6] border border-[#D9D4CF] p-2.5 text-[10px] text-gray-700 rounded-xs leading-relaxed font-medium">
                🌱 <strong className="text-[#E65100]">توپوگرافی و شیب اراضی:</strong> برای تغییر نوع بستر خاک (شیب‌دار، مسطح، سکوبندی پله‌پله، دره‌ای و ساحلی) از پنل <strong className="text-[#2D2926]">طراحی زمین</strong> در گوشه بالا-راست نقشه و دکمه <strong className="text-[#2D2926]">تنظیم توپوگرافی و شیب زمین</strong> استفاده کنید.
              </div>

              {/* Step Navigation to demographics */}
              <button
                onClick={() => setActiveStep(2)}
                className="w-full bg-[#E65100] hover:bg-[#BF360C] text-white font-bold py-2.5 transition text-xs flex items-center justify-center gap-1.5 mt-4 rounded-xs cursor-pointer shadow-xs"
              >
                <span>ادامه به گام دوم: خانوارها</span>
                <ArrowLeft size={13} />
              </button>
            </div>
          )}

          {/* STEP 2: DEMOGRAPHICS, INTENSITIES & PARAMETER RULES */}
          {activeStep === 2 && (
            <div className="flex flex-col gap-4 text-right animate-fade-in text-xs">
              
              {/* Total Households Selection (Discrete Buttons: 20, 60, 120, 160, 200 - Slider Removed) */}
              <div className="flex flex-col gap-2.5 bg-[#F7F5F2] p-3 border border-[#D9D4CF] rounded-xs">
                <div className="flex justify-between items-center font-bold text-[#2D2926]">
                  <span className="text-[11.5px]">تعداد جمعیت خانوار:</span>
                  <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-[#D9D4CF] rounded-xs">
                    <span className="font-mono text-sm font-black text-[#E65100]">{params.totalHouseholds}</span>
                    <span className="text-[#8B8378] text-[10.5px]">خانوار</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[9.5px] font-bold text-[#8B8378]">انتخاب دقیق تعداد خانوار:</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[20, 60, 120, 160, 200].map((num) => {
                      const isSelected = Number(params.totalHouseholds) === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleParamChange('totalHouseholds', num)}
                          className={`py-2 px-1 text-[11px] font-mono font-bold border transition-all duration-150 rounded-xs cursor-pointer text-center active:scale-95 ${
                            isSelected
                              ? 'bg-[#E65100] text-white border-[#E65100] shadow-sm font-black ring-2 ring-[#E65100]/30 z-10'
                              : 'bg-white hover:bg-[#F7F5F2] text-[#2D2926] border-[#D9D4CF]'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Ratios distribution panel */}
              <div className="border-t border-[#D9D4CF] pt-3.5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#2D2926] text-[11px]">ترکیب جمعیتی خانوار:</span>
                  <span className="text-[9.5px] font-bold text-[#8B8378] font-mono">(مجموع: {calcSingles + calcMediums + calcLarges} خانوار)</span>
                </div>
                
                {/* Presets for demographics distribution */}
                <div className="flex flex-col gap-1.5 bg-[#F7F5F2] p-2 border border-[#D9D4CF] rounded-xs mb-1">
                  <span className="text-[9.5px] font-bold text-gray-600">الگوهای پیش‌فرض ساختار خانوار:</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { name: '👨‍👩‍👧‍👦 خانواده‌محور (پیش‌فرض)', single: 20, medium: 50, large: 30 },
                      { name: '⚖️ بافت مساوی', single: 33, medium: 34, large: 33 },
                      { name: '👶 جوان و تک‌نفره', single: 50, medium: 35, large: 15 },
                      { name: '👵 پرجمعیت و سنتی', single: 15, medium: 35, large: 50 },
                    ].map((preset, pIdx) => {
                      const isActive = params.singleProp === preset.single && 
                                       params.mediumProp === preset.medium && 
                                       params.largeProp === preset.large;
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => onChangeParams({
                            ...params,
                            singleProp: preset.single,
                            mediumProp: preset.medium,
                            largeProp: preset.large
                          })}
                          className={`py-1 px-1.5 text-[9px] font-bold border transition rounded-xs cursor-pointer text-center whitespace-nowrap ${
                            isActive
                              ? 'bg-[#2D2926] text-white border-[#2D2926] shadow-xs'
                              : 'bg-white hover:bg-white/80 text-gray-700 border-[#D9D4CF]'
                          }`}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Single family slider */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-[11px]">
                    <span className="flex items-center gap-1 font-bold">
                      <span className="w-2.5 h-2.5 bg-[#3b82f6] inline-block rounded-xs"></span>
                      <span>تک یا دو نفره (۱ کاندید):</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={params.singleProp}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          handlePropChange('singleProp', val);
                        }}
                        className="w-12 bg-white border border-[#D9D4CF] px-1 py-0.5 text-center font-mono text-[10.5px] text-[#3b82f6] outline-none rounded-xs focus:border-[#3b82f6]"
                      />
                      <span className="text-[10px] text-gray-500">٪</span>
                      <span className="font-mono text-[#3b82f6] text-[10px] mr-1">({calcSingles} خانوار)</span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={params.singleProp} 
                    onChange={(e) => handlePropChange('singleProp', parseInt(e.target.value))}
                    className="w-full accent-[#3b82f6] cursor-pointer h-1"
                  />
                </div>

                {/* Medium family slider */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-[11px]">
                    <span className="flex items-center gap-1 font-bold">
                      <span className="w-2.5 h-2.5 bg-[#f97316] inline-block rounded-xs"></span>
                      <span>متوسط ۳ الی ۴ نفره (۲ کاندید):</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={params.mediumProp}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          handlePropChange('mediumProp', val);
                        }}
                        className="w-12 bg-white border border-[#D9D4CF] px-1 py-0.5 text-center font-mono text-[10.5px] text-[#f97316] outline-none rounded-xs focus:border-[#f97316]"
                      />
                      <span className="text-[10px] text-gray-500">٪</span>
                      <span className="font-mono text-[#f97316] text-[10px] mr-1">({calcMediums} خانوار)</span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={params.mediumProp} 
                    onChange={(e) => handlePropChange('mediumProp', parseInt(e.target.value))}
                    className="w-full accent-[#f97316] cursor-pointer h-1"
                  />
                </div>

                {/* Large family slider */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-[11px]">
                    <span className="flex items-center gap-1 font-bold">
                      <span className="w-2.5 h-2.5 bg-[#10b981] inline-block rounded-xs"></span>
                      <span>خانواده پرجمعیت ۵ نفره به بالا (۳ کاندید):</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={params.largeProp}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          handlePropChange('largeProp', val);
                        }}
                        className="w-12 bg-white border border-[#D9D4CF] px-1 py-0.5 text-center font-mono text-[10.5px] text-[#10b981] outline-none rounded-xs focus:border-[#10b981]"
                      />
                      <span className="text-[10px] text-gray-500">٪</span>
                      <span className="font-mono text-[#10b981] text-[10px] mr-1">({calcLarges} خانوار)</span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={params.largeProp} 
                    onChange={(e) => handlePropChange('largeProp', parseInt(e.target.value))}
                    className="w-full accent-[#10b981] cursor-pointer h-1"
                  />
                </div>
              </div>

              {/* Max Floors height group */}
              <div className="border-t border-[#D9D4CF] pt-3 flex flex-col gap-1.5">
                <label className="font-bold text-[#2D2926] text-[11px] block text-right">سقف ایمن تراکم در ارتفاع (طبقه):</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[2, 3, 4].map(fl => (
                    <button
                      key={fl}
                      onClick={() => handleParamChange('maxFloors', fl)}
                      className={`py-1.5 text-center font-mono font-bold transition text-[10.5px] border cursor-pointer ${
                        params.maxFloors === fl 
                          ? 'bg-[#2D2926] border-[#2D2926] text-white shadow-xs' 
                          : 'bg-white border-[#D9D4CF] text-[#8B8378] hover:bg-[#F7F5F2]'
                      }`}
                    >
                      {fl} طبقه
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Density selection preset */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#2D2926] text-[11px] block">حد نهایی تراکم سطح اشغال زمین:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as const).map(dense => (
                    <button
                      key={dense}
                      onClick={() => handleParamChange('targetDensity', dense)}
                      className={`py-1.5 text-[10.5px] text-center font-bold transition border cursor-pointer ${
                        params.targetDensity === dense 
                          ? 'bg-[#E65100] border-[#E65100] text-white shadow-xs' 
                          : 'bg-white border-[#D9D4CF] text-[#8B8378] hover:bg-[#F7F5F2]'
                      }`}
                    >
                      {dense === 'low' && 'کم (۲۵٪)'}
                      {dense === 'medium' && 'متوسط (۵۰٪)'}
                      {dense === 'high' && 'حداکثر (۱۰۰٪)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Courtyard size ratio proportion */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between mb-0.5 font-bold">
                  <span>سهم تخصیصی حیاط‌های میانسرا:</span>
                  <strong className="text-xs font-mono text-[#E65100]">{params.courtyardSizeRatio}٪</strong>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="40" 
                  value={params.courtyardSizeRatio} 
                  onChange={(e) => handleParamChange('courtyardSizeRatio', parseInt(e.target.value))}
                  className="w-full accent-[#E65100] cursor-pointer"
                />
              </div>

              {/* Actions split step back */}
              <div className="flex gap-2 border-t border-[#D9D4CF] pt-4 mt-2">
                <button
                  onClick={() => setActiveStep(1)}
                  className="px-3 border border-[#D9D4CF] hover:bg-[#F7F5F2] text-[#4A443F] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  title="بازگشت به گام قبلی اراضی"
                >
                  <ArrowRight size={13} />
                  <span>برگشت</span>
                </button>
                <button
                  onClick={onRegenerate}
                  className="flex-1 bg-[#2D2926] hover:bg-[#E65100] text-white font-bold py-2.5 transition text-xs flex items-center justify-center gap-1.5 rounded-xs cursor-pointer shadow-sm active:scale-95 duration-150"
                >
                  <Sliders size={13} />
                  <span>بهینه‌سازی و حل بافت</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
