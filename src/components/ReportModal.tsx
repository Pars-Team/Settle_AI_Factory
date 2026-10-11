/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileText, X, Award, CheckCircle2, TrendingUp, AlertTriangle, Cpu, Compass, Activity, Server } from 'lucide-react';
import { SettlementState, GenerationParams, Unit } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SettlementState;
  params: GenerationParams;
}

export default function ReportModal({ isOpen, onClose, state, params }: ReportModalProps) {
  if (!isOpen) return null;

  const { cores, units, courtyards, paths, metrics, siteShape, terrainType } = state;

  // 1. Calculate precise core statistics
  const totalContainers = units.length;
  const totalPopulation = units.reduce((acc, u) => acc + u.capacity, 0);
  const totalFamilyArea = units.reduce((acc, u) => acc + u.area, 0);

  const singlesCount = units.filter(u => u.type === 'single').length;
  const mediumsCount = units.filter(u => u.type === 'medium').length;
  const largesCount = units.filter(u => u.type === 'large').length;

  // Average containers per core
  const avgUnitsPerCore = cores.length > 0 ? (totalContainers / cores.length).toFixed(1) : '0';

  // 2. Cores Distance & Cluster Compactness Analysis
  let minCoreDist = Infinity;
  let maxCoreDist = -Infinity;
  let sumCoreDist = 0;
  let distPairsCount = 0;

  for (let i = 0; i < cores.length; i++) {
    for (let j = i + 1; j < cores.length; j++) {
      const cA = cores[i];
      const cB = cores[j];
      const dist = Math.sqrt(Math.pow(cA.x - cB.x, 2) + Math.pow(cA.y - cB.y, 2));
      if (dist < minCoreDist) minCoreDist = dist;
      if (dist > maxCoreDist) maxCoreDist = dist;
      sumCoreDist += dist;
      distPairsCount++;
    }
  }

  const avgCoreDist = distPairsCount > 0 ? (sumCoreDist / distPairsCount).toFixed(1) : '0';
  const minCoreDistVal = minCoreDist !== Infinity ? minCoreDist.toFixed(1) : '0';
  const maxCoreDistVal = maxCoreDist !== -Infinity ? maxCoreDist.toFixed(1) : '0';

  // Core compactness feedback
  const getCoreCompactnessStatus = () => {
    if (cores.length <= 1) return { text: 'عدم نیاز به ارزیابی همبستگی (تک هسته)', color: 'text-[#8B8378]', bg: 'bg-[#F7F5F2]' };
    const avg = parseFloat(avgCoreDist);
    if (avg <= 14) return { 
      text: 'بسیار متراکم و ادغام شده (عالی - صرفه‌جویی شدید در معابر و انشعابات تاسیسات)', 
      color: 'text-[#2e7d32]', 
      bg: 'bg-[#e8f5e9]',
      desc: 'هسته‌ها نزدیک به هم چیده شده‌اند که این امر همبستگی اجتماعی بالا و کارایی فوق‌العاده شبکه‌های توزیع کابل و لوله‌کشی را تضمین می‌کند.'
    };
    if (avg <= 20) return { 
      text: 'توازن بهینه و پیکربندی پیوندیافته (مناسب - بافت همبند ارگانیک)', 
      color: 'text-[#E65100]', 
      bg: 'bg-[#fff3e0]',
      desc: 'فاصله‌گذاری هسته‌ها در وضعیت متعادل است؛ فضای کافی برای باغچه‌ها وجود دارد و در عین حال معابر پیاده طولانی و خسته‌کننده نیستند.'
    };
    return { 
      text: 'پراکندگی حاشیه با حساسیت بالا (هشداری - نیاز به کاهش گستره سایت)', 
      color: 'text-[#c62828]', 
      bg: 'bg-[#ffebee]',
      desc: 'به دلیل وسعت زمین یا موانع طبیعی، هسته‌ها در فاصله دورتری قرار گرفته‌اند که ممکن است هزینه‌های کابل‌کشی ثانویه را افزایش دهد.'
    };
  };

  const compactness = getCoreCompactnessStatus();

  // 3. Dynamic architectural descriptions based on metrics
  const getMetricQualitative = (score: number, type: string) => {
    if (score >= 82) {
      switch (type) {
        case 'walkability': return 'بهینه؛ تمام بلوک‌های مسکونی با حداکثر ۳ دقیقه پیاده‌روی به پله‌های فرار و سرویس‌های مرکزی متصلند.';
        case 'infrastructure': return 'عالی؛ شاه‌راه‌ها و زون‌های MEP بهینه‌ترین انشعابات الکتریکی و لوله‌کشی‌های دوجداره را دارند.';
        case 'courtyard': return 'رویایی؛ تناسب ابعاد میانسراها با ظرفیت فیزیکی کلاسترها حداکثر نورگیری و حریم خصوصی را تداعی می‌کند.';
        case 'expansion': return 'فوق‌العاده؛ زون‌های توسعه ارگانیک پیرامونی به درستی برای بارهای جمعیتی پیش‌بینی نشده رزرو شده‌اند.';
        default: return 'انطباق ۱۰۰٪ با متغیرهای طراحی پایداری.';
      }
    } else if (score >= 60) {
      switch (type) {
        case 'walkability': return 'متوسط؛ دسترسی‌های پیاده فاقد گلوگاه بوده ولی برخی ماژول در لبه‌های بیرونی قرار دارند.';
        case 'infrastructure': return 'متوسط؛ نوسان اندک در افت فشار خطوط به علت انشعاب از کانون‌های فرعی دوردست.';
        case 'courtyard': return 'کافی؛ محصوریت حیاط‌ها خوب است ولی به فضاهای سبز یا باغچه‌های تکمیلی بیشتری نیاز است.';
        case 'expansion': return 'محدود؛ امکان توسعه بلوک با افزودن حداکثر ۵ کانتینر جدید در زون همکف.';
        default: return 'قابلیت همگام‌سازی مطلوب با بافت کلاستر.';
      }
    } else {
      switch (type) {
        case 'walkability': return 'نیازمند بازنگری؛ فاصله پیاده برخی واحدها به لایه‌های پله عمودی بیش از اندازه است.';
        case 'infrastructure': return 'بحرانی؛ خستگی یا اتلاف پتانسیل در شبکه‌های تاسیساتیِ طولانی شریانی.';
        case 'courtyard': return 'تراکم بیش از حد؛ محوطه‌های باز تحت فشار سایه سنگین کانتینرهای طبقات بالا قرار گرفته‌اند.';
        case 'expansion': return 'بن‌بست فیزیکی؛ نبود ذخیره‌گاه‌های مرزی آزاد برای توسعه سکونتگاه.';
        default: return 'توسعه غیرقابل توجیه و نیازمند کالیبره‌سازی مجدد.';
      }
    }
  };

  // 4. Site and Terrain context
  const getTerrainFa = (t: typeof terrainType) => {
    const map: Record<string, string> = {
      flat: 'دشت صاف و هموار با خاک پایدار',
      sloped: 'زمین شیب‌دار یکنواخت',
      sloped_n: 'شیب به سمت شمال',
      sloped_s: 'شیب به سمت جنوب (آفتاب‌گیر عالی)',
      sloped_e: 'شیب به سمت شرق',
      sloped_w: 'شیب به سمت غرب',
      terraced: 'کوهپایه پله‌کانی‌شده مهندسی برای ترازهای ارتفاعی',
      valley: 'دره طبیعی همگرا با تهدید تجمع آبهای روان',
      coastal: 'ساحلی نیمه‌کوهستانی با خط بستر رودخانه‌ای'
    };
    return map[t] || t;
  };

  const getShapeFa = (s: typeof siteShape) => {
    switch (s) {
      case 'rectangular': return 'محدوده مستطیل ساختاریافته';
      case 'irregular': return 'سایت غیرمنتظم ناشی از عوارض زمین';
      case 'skewed': return 'زمین قناس و مورب (ذوزنقه‌ای شهری)';
      case 'custom_boundary': return 'نیم‌رخ ترسیم‌شده اختصاصی CAD';
      default: return s;
    }
  };

  // 5. Engineering Prescriptions
  const generatePrescriptions = (): string[] => {
    const list: string[] = [];
    if (metrics.walkability < 70) {
      list.push('فاصله دسترسی پیاده بالاست. پیشنهاد می‌شود وزن شاخص دسترسی (Weights) در داشبورد را به بالای ۸۰ افزایش دهید تا الگوریتم هسته‌ها را به ماژول‌ها نزدیک‌تر کند.');
    }
    if (metrics.infrastructureEfficiency < 70) {
      list.push('راندمان اتصالات برق و آب پایین است. توزیع خطوط را با چیدن دستی موانع در لبه یا محدود کردن گستره سایت متمرکز کنید.');
    }
    if (metrics.courtyardQuality < 70) {
      list.push('ابعاد حیاط‌ها متناسب نیست. پارامتر "نسبت مساحت حیاط مرکزی (Courtyard Size)" را افزایش دهید تا فضای باز کلاسترها گشادگی بهتری یابد.');
    }
    if (totalContainers / (cores.length || 1) > 12) {
      list.push('تعداد کانتینرها به ازای هر پله بسیار متراکم است. پیشنهاد می‌شود برای حفظ ایمنی حریق و تسریع خروج اضطراری، تراکم بهینه را بهبود داده یا تعداد کانتینرهای طبقه اول و دوم را محدودتر کنید.');
    }
    if (list.length === 0) {
      list.push('پیکربندی کلی به صورت ایده‌آل توزیع شده است. توازن بین فضاهای باز درون‌گرا (میانسرا) و چگالی پر و خالی ماژول‌ها نمایانگر الگوی اصیل معماری پایداری بومی است.');
    }
    return list;
  };

  const prescriptions = generatePrescriptions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity duration-300" dir="rtl">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-[#FDFCFB]/98 border border-[#D9D4CF] shadow-2xl flex flex-col max-h-[90vh] text-[#2D2926]" id="report-modal">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#D9D4CF] bg-[#F7F5F2]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#E65100]/10 text-[#E65100]">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-serif font-bold tracking-tight text-[#2D2926]">گزارش تخصصی عملکرد سکونتگاه و کلاسترها</h2>
              <p className="text-[10px] text-[#8B8378] font-sans">تحلیل مورفولوژیک شبیه‌سازی و پایش توازن فضایی</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 px-2.5 border border-[#D9D4CF] hover:bg-red-50 hover:text-red-600 transition text-[#8B8378] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <X size={12} />
            <span>بستن گزارش</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin">
          
          {/* Section 1: Top Indicators / Key Metrics */}
          <div className="bg-[#2D2926] text-white p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border-r border-white/10 pr-3">
              <span className="text-[9px] text-white/60 font-bold block">انطباق کلی سکونتگاه</span>
              <strong className="text-xl font-serif font-bold mt-1 block">{metrics.overall}٪</strong>
              <div className="w-full h-1 bg-white/15 mt-1.5 overflow-hidden rounded-full">
                <div className="h-full bg-[#E65100]" style={{ width: `${metrics.overall}%` }} />
              </div>
            </div>
            <div className="border-r border-white/10 pr-3">
              <span className="text-[9px] text-white/60 font-bold block">متراژ ناخالص مسکونی</span>
              <strong className="text-xl font-mono mt-1 block">{totalFamilyArea} مـتر</strong>
              <span className="text-[8px] text-white/40 block mt-1">برآورد کل زیربنای کانتینرها</span>
            </div>
            <div className="border-r border-white/10 pr-3">
              <span className="text-[9px] text-white/60 font-bold block">شاخص چگالی اجتماعی</span>
              <strong className="text-xl font-mono mt-1 block">{(totalPopulation / (cores.length || 1)).toFixed(0)} نفر</strong>
              <span className="text-[8px] text-white/50 block mt-1">تراکم جمعیتی سرانه پله‌ها</span>
            </div>
            <div className="pr-3">
              <span className="text-[9px] text-white/60 font-bold block">کیفیت باغچه‌های میانسرا</span>
              <strong className="text-xl font-bold text-[#FF9E00] mt-1 block">{metrics.courtyardQuality}٪</strong>
              <span className="text-[8px] text-white/40 block mt-1">تکرار الگوی حیاط درون‌گرا</span>
            </div>
          </div>

          {/* Section 2: General Identity Census */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 border border-[#D9D4CF] space-y-3 bg-white">
              <h3 className="text-[11px] font-bold text-[#8B8378] pb-1.5 border-b border-[#D9D4CF] flex items-center gap-1.5 font-serif uppercase tracking-wider">
                <Server size={12} className="text-[#E65100]" />
                شناسنامه توزیع جمعیت و ماژول‌ها
              </h3>
              <div className="grid grid-cols-2 gap-3.5 text-xs font-mono">
                <div className="p-2 bg-[#F7F5F2] border border-[#EEEEEE]">
                  <span className="text-[9px] text-[#8B8378] block">کل خانواده‌ها:</span>
                  <strong className="text-sm font-bold text-[#2D2926] mt-0.5 block">{totalContainers} خانوار</strong>
                </div>
                <div className="p-2 bg-[#F7F5F2] border border-[#EEEEEE]">
                  <span className="text-[9px] text-[#8B8378] block">کل معبر مواصلاتی:</span>
                  <strong className="text-sm font-bold text-[#E65100] mt-0.5 block">{~~(paths.reduce((s, p) => s + p.coords.length, 0) * 3)} متر</strong>
                </div>
                <div className="p-2 bg-[#F7F5F2] border border-[#EEEEEE]">
                  <span className="text-[9px] text-[#8B8378] block">تنوع ۱ نفره (Single):</span>
                  <strong className="text-xs font-bold text-[#2D2926] mt-0.5 block">{singlesCount} واحد</strong>
                </div>
                <div className="p-2 bg-[#F7F5F2] border border-[#EEEEEE]">
                  <span className="text-[9px] text-[#8B8378] block">تنوع متوسط و بزرگ:</span>
                  <strong className="text-xs font-bold text-[#2D2926] mt-0.5 block">{mediumsCount + largesCount} واحد</strong>
                </div>
              </div>
              <div className="text-[10px] text-[#8B8378] leading-relaxed pt-1 flex items-center gap-1">
                <Compass size={11} />
                <span>بستر زمین: <strong>{getTerrainFa(terrainType)}</strong> با ساختار <strong>{getShapeFa(siteShape)}</strong>.</span>
              </div>
            </div>

            {/* Core Distance Analysis */}
            <div className="p-4 border border-[#D9D4CF] space-y-3 bg-white flex flex-col justify-between">
              <div>
                <h3 className="text-[11px] font-bold text-[#8B8378] pb-1.5 border-b border-[#D9D4CF] flex items-center gap-1.5 font-serif uppercase tracking-wider">
                  <Activity size={12} className="text-[#E65100]" />
                  پایش فاصله و پراکندگی هسته‌ها (Cohesion)
                </h3>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-2">
                  <div className="text-center p-1 border border-dotted border-[#D9D4CF]">
                    <span className="text-[8px] text-[#8B8378] block">حداقل فاصله:</span>
                    <strong className="font-bold text-[#2D2926]">{minCoreDistVal}m</strong>
                  </div>
                  <div className="text-center p-1 border border-dotted border-[#D9D4CF]">
                    <span className="text-[8px] text-[#8B8378] block">میانگین فاصله:</span>
                    <strong className="font-bold text-[#E65100]">{avgCoreDist}m</strong>
                  </div>
                  <div className="text-center p-1 border border-dotted border-[#D9D4CF]">
                    <span className="text-[8px] text-[#8B8378] block">حداکثر فاصله:</span>
                    <strong className="font-bold text-[#2D2926]">{maxCoreDistVal}m</strong>
                  </div>
                </div>
              </div>

              <div className={`p-3 text-[10px] ${compactness.bg} border-l-2 border-[#E65100] mt-2`}>
                <strong className={`font-bold block mb-1 ${compactness.color}`}>{compactness.text}</strong>
                <p className="text-[#4A443F] leading-relaxed font-sans">{compactness.desc}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Performance Breakdown */}
          <div className="p-4 border border-[#D9D4CF] bg-white space-y-4">
            <h3 className="text-[11px] font-bold text-[#2D2926] pb-2 border-b border-[#D9D4CF] flex items-center gap-1.5 font-serif uppercase tracking-wider">
              <Award size={13} className="text-[#E65100]" />
              تحلیل کیفی ترازهای ارزیابی و کارایی بافت
            </h3>

            <div className="space-y-3">
              {[
                { label: 'سهولت دسترسی پیاده به پله‌ها (Walkability)', score: metrics.walkability, type: 'walkability' },
                { label: 'بهینه‌گی طول مسیرهای مهندسی (Mep Pipelines)', score: metrics.infrastructureEfficiency, type: 'infrastructure' },
                { label: 'خوانایی حیاط باغچه‌ها فلات ایران (Courtyards)', score: metrics.courtyardQuality, type: 'courtyard' },
                { label: 'آمادگی توسعه پذیری ارگانیک (Expansion Buffer)', score: metrics.expansionPotential, type: 'expansion' }
              ].map((it, idx) => (
                <div key={idx} className="flex gap-4 items-start pb-3 border-b border-[#EEEEEE] last:border-b-0 last:pb-0">
                  <div className="w-[45px] font-mono text-center shrink-0">
                    <span className="text-[10px] font-bold text-[#E65100] block">{it.score}٪</span>
                    <span className="text-[8px] text-[#8B8378] block uppercase">تراز {idx + 1}</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-xs font-bold text-[#2D2926]">{it.label}</h4>
                    <p className="text-[9.5px] text-[#555] leading-relaxed font-sans">{getMetricQualitative(it.score, it.type)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Prescriptions & Optimization Tips */}
          <div className="p-4 border border-[#DC2626]/20 bg-amber-50/20 space-y-3">
            <h3 className="text-[11px] font-bold text-[#DC2626] pb-1.5 border-b border-dashed border-[#DC2626]/20 flex items-center gap-1.5 font-serif uppercase tracking-wider">
              <AlertTriangle size={13} />
              پیشنهادات و نسخه‌های اصلاحی مهندسی معماری
            </h3>
            <ul className="list-disc pr-4 space-y-2 text-[10px] text-[#4A443F] leading-relaxed font-sans">
              {prescriptions.map((item, idx) => (
                <li key={idx}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D9D4CF] bg-[#F7F5F2] flex items-center justify-between text-[10px] text-[#8B8378]">
          <div className="flex items-center gap-1.5 font-mono">
            <Cpu size={11} className="text-[#8B8378]" />
            <span>GEN_VERSION: v4.2.0 • ALGORITHM: HEURISTIC MULTI-CRITERIA</span>
          </div>
          <span>تولید شده توسط تراز بهینه‌ساز سکونتگاه کانتینری هوشمند با لبه همبند</span>
        </div>

      </div>
    </div>
  );
}
