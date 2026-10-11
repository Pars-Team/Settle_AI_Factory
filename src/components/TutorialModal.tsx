import React, { useState, useEffect } from 'react';
import { X, BookOpen, Sliders, Building2, Cpu, Check, Layers, Compass } from 'lucide-react';
import katex from 'katex';
import { DEFAULT_PARAMS } from '../generator';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'placement' | 'structural' | 'optimization'>('placement');

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // KaTeX formula renderers
  const renderMath = (tex: string, displayMode = true) => {
    try {
      const html = katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        trust: true,
      });
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
      return <code className="font-mono bg-amber-50 px-1 py-0.5 text-xs text-amber-800">{tex}</code>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#2D2926]/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        id="tutorial-modal"
        className="relative w-full max-w-4xl h-[85vh] bg-[#FDFCFB] border border-[#2D2926] shadow-xl flex flex-col overflow-hidden animate-fade-in text-[#2D2926]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9D4CF] bg-[#F7F5F2]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#E65100]/10 text-[#E65100] rounded-xs">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#2D2926] tracking-tight">مستندات و اصول فنی طراحی Settle</h2>
              <p className="text-[11px] text-[#8B8378] mt-0.5">راهنمای جامع قواعد مورفوژنتیک، پایداری سازه‌ای و موتور بهینه‌ساز</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 text-[#8B8378] hover:text-[#2D2926] rounded-full transition cursor-pointer"
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Tabs (in RTL, it is visually on the right or left, we keep a styled side panel) */}
          <div className="w-64 bg-[#F7F5F2] border-l border-[#D9D4CF] p-4 flex flex-col gap-1.5 overflow-y-auto">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8B8378] px-3.5 mb-2 block">بخش‌های آموزشی</span>
            
            <button
              onClick={() => setActiveTab('placement')}
              className={`flex items-center gap-2.5 px-3.5 py-3 text-xs font-bold transition rounded-xs text-right cursor-pointer border ${
                activeTab === 'placement'
                  ? 'bg-white border-[#2D2926] text-[#E65100] shadow-2xs'
                  : 'bg-transparent border-transparent text-[#4A443F] hover:bg-[#F1EDE8]'
              }`}
            >
              <Sliders size={15} className={activeTab === 'placement' ? 'text-[#E65100]' : 'text-[#8B8378]'} />
              <span>قوانین جایگذاری (Placement)</span>
            </button>

            <button
              onClick={() => setActiveTab('structural')}
              className={`flex items-center gap-2.5 px-3.5 py-3 text-xs font-bold transition rounded-xs text-right cursor-pointer border ${
                activeTab === 'structural'
                  ? 'bg-white border-[#2D2926] text-[#E65100] shadow-2xs'
                  : 'bg-transparent border-transparent text-[#4A443F] hover:bg-[#F1EDE8]'
              }`}
            >
              <Building2 size={15} className={activeTab === 'structural' ? 'text-[#E65100]' : 'text-[#8B8378]'} />
              <span>تحلیل سازه (Structural Logic)</span>
            </button>

            <button
              onClick={() => setActiveTab('optimization')}
              className={`flex items-center gap-2.5 px-3.5 py-3 text-xs font-bold transition rounded-xs text-right cursor-pointer border ${
                activeTab === 'optimization'
                  ? 'bg-white border-[#2D2926] text-[#E65100] shadow-2xs'
                  : 'bg-transparent border-transparent text-[#4A443F] hover:bg-[#F1EDE8]'
              }`}
            >
              <Cpu size={15} className={activeTab === 'optimization' ? 'text-[#E65100]' : 'text-[#8B8378]'} />
              <span>بهینه‌سازی الگوریتمی (Optimization)</span>
            </button>

            <div className="mt-auto pt-4 border-t border-[#D9D4CF] text-[10px] text-[#8B8378] px-3.5 space-y-1.5 leading-relaxed">
              <p>این ماژول راهنما تاثیری بر روی <strong className="text-[#4A443F]">وضعیت کنونی شبیه‌سازی یا تاریخچه تغییرات (Undo/Redo)</strong> نخواهد گذاشت.</p>
              <div className="flex items-center gap-1.5 mt-2 text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded-3xs border border-emerald-100">
                <Check size={10} />
                <span>یکپارچه‌سازی پایدار</span>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#FDFCFB] custom-scrollbar">
            {/* TAB 1: PLACEMENT RULES */}
            {activeTab === 'placement' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-sm font-extrabold text-[#2D2926] border-b border-[#D9D4CF] pb-2 mb-3">دستورالعمل‌ها و پارامترهای پیش‌فرض جایگذاری</h3>
                  <p className="text-xs text-[#4A443F] leading-relaxed mb-4">
                    سیستم Settle از قواعد مورفوژنتیک بومی کویر و معماری ایرانی الهام گرفته است. در طراحی واحدهای مسکونی، هر واحد باید به طور فیزیکی با یک <strong className="text-[#2D2926]">هسته سرویس‌دهنده (Core)</strong> در تماس باشد تا خدمات سرمایشی، گرمایشی، فاضلاب و انرژی را مستقیماً دریافت کند.
                  </p>
                </div>

                {/* Parameters Grid from DEFAULT_PARAMS */}
                <div>
                  <h4 className="text-xs font-bold text-[#E65100] mb-2.5 flex items-center gap-1.5">
                    <Sliders size={13} />
                    <span>پارامترهای پایه شبیه‌سازی (برگرفته از هسته محاسباتی)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-[#F7F5F2] border border-[#D9D4CF] p-3 rounded-xs">
                      <span className="text-[10px] text-[#8B8378] block">کل خانواده‌های هدف</span>
                      <strong className="text-sm text-[#2D2926] font-mono">{DEFAULT_PARAMS.totalHouseholds} خانوار</strong>
                    </div>
                    <div className="bg-[#F7F5F2] border border-[#D9D4CF] p-3 rounded-xs">
                      <span className="text-[10px] text-[#8B8378] block">حداکثر طبقات مجاز</span>
                      <strong className="text-sm text-[#2D2926] font-mono">{DEFAULT_PARAMS.maxFloors} طبقه ارتفاعی</strong>
                    </div>
                    <div className="bg-[#F7F5F2] border border-[#D9D4CF] p-3 rounded-xs">
                      <span className="text-[10px] text-[#8B8378] block">حداکثر فاصله تا هسته</span>
                      <strong className="text-sm text-[#2D2926] font-mono">{DEFAULT_PARAMS.maxWalkDistanceCore} سلول</strong>
                    </div>
                    <div className="bg-[#F7F5F2] border border-[#D9D4CF] p-3 rounded-xs">
                      <span className="text-[10px] text-[#8B8378] block">اندازه بهینه کلاسترها</span>
                      <strong className="text-sm text-[#2D2926] font-mono">{DEFAULT_PARAMS.preferredClusterSize} واحد</strong>
                    </div>
                    <div className="bg-[#F7F5F2] border border-[#D9D4CF] p-3 rounded-xs">
                      <span className="text-[10px] text-[#8B8378] block">نسبت حیاط‌های مرکزی</span>
                      <strong className="text-sm text-[#2D2926] font-mono">{DEFAULT_PARAMS.courtyardSizeRatio} درصد</strong>
                    </div>
                    <div className="bg-[#F7F5F2] border border-[#D9D4CF] p-3 rounded-xs">
                      <span className="text-[10px] text-[#8B8378] block">رزرو فضا برای توسعه</span>
                      <strong className="text-sm text-[#2D2926] font-mono">{DEFAULT_PARAMS.expansionReserve} درصد</strong>
                    </div>
                  </div>
                </div>

                {/* Layout and Connection constraint rules */}
                <div className="bg-[#F7F5F2] border border-[#2D2926] p-4 rounded-xs">
                  <h4 className="text-xs font-bold text-[#2D2926] mb-2">قانون تماس جزئی با هسته (Partial Touch Constraint)</h4>
                  <p className="text-xs text-[#4A443F] leading-relaxed mb-3">
                    هیچ واحد متوسط (۳×۲) یا بزرگ (۴×۲) مجاز نیست به گونه‌ای در مجاورت هسته قرار گیرد که تمام طول یکی از دیوارهای هسته را به طور ۱۰۰٪ مسدود کند. این قانون تضمین می‌کند که کریدورهای باد و فضاهای عبور عابر پیاده همواره آزاد بمانند.
                  </p>
                  <div className="border-t border-[#D9D4CF] pt-2 mt-2 flex items-center justify-between text-[11px] text-[#8B8378]">
                    <span>ابعاد واحد تک‌خانواده: ۲×۱ سلول (آبی)</span>
                    <span>ابعاد واحد متوسط: ۳×۲ سلول (نارنجی)</span>
                    <span>ابعاد واحد بزرگ: ۴×۲ سلول (سبز)</span>
                  </div>
                </div>

                <div className="border-l-2 border-slate-500 bg-slate-50/50 p-4 rounded-xs">
                  <h4 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span>ورودی محله (هاشور خاکستری)</span>
                  </h4>
                  <p className="text-xs text-slate-950/80 leading-relaxed">
                    با کلیک روی هر واحد مسکونی موجود در مدل شبیه‌سازی، می‌توانید آن را به <strong className="text-slate-900">«واحد ورودی محله»</strong> ارتقا دهید. این واحدها ابعاد بهینه کوچکی داشته و به عنوان ورودی‌های پیاده، فیلترهای ورودی و پله‌های ارتباط بیرونی تعریف می‌شوند و با هاشور خاکستری در تراز پایه مشخص می‌گردند.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: STRUCTURAL LOGIC */}
            {activeTab === 'structural' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-sm font-extrabold text-[#2D2926] border-b border-[#D9D4CF] pb-2 mb-3">منطق تحلیل سازه‌ای و تحلیل پایداری عمودی</h3>
                  <p className="text-xs text-[#4A443F] leading-relaxed">
                    توسعه طبقاتی کانتینرها در الگوریتم Settle، مبتنی بر محاسبات مرکز ثقل مشترک و پایداری لرزه‌ای بر اساس معماری بومی است. در کانتینرهای مدولار پیش‌ساخته، سازه بالا باید تکیه‌گاه کافی روی سازه پایین داشته باشد.
                  </p>
                </div>

                {/* KaTeX Math Equation Section */}
                <div className="bg-[#F7F5F2] border border-[#2D2926] p-6 text-center rounded-xs space-y-4">
                  <span className="text-[10px] text-[#8B8378] font-bold block uppercase tracking-wider">فرمول پایداری عمودی بارگذاری (Vertical Stability Formula)</span>
                  
                  <div className="py-4 px-6 bg-white border border-[#D9D4CF] inline-block rounded-md shadow-3xs font-serif text-lg">
                    {renderMath("S \\ge 0.5 \\cdot A", true)}
                  </div>

                  <div className="text-right max-w-md mx-auto space-y-2 text-xs text-[#4A443F] border-t border-[#D9D4CF] pt-4">
                    <p className="flex justify-between">
                      <strong>{renderMath("S")} (سطح تکیه‌گاه):</strong>
                      <span>تعداد کل سلول‌های زیرین واحد که دارای فونداسیون صلب یا کانتینر در تراز قبلی هستند.</span>
                    </p>
                    <p className="flex justify-between">
                      <strong>{renderMath("A")} (مساحت کل واحد):</strong>
                      <span>مساحت تصویر افقی کانتینر یا ماژول بر روی زمین بر حسب تعداد سلول.</span>
                    </p>
                  </div>
                </div>

                {/* Advanced Structural Constraints */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-[#D9D4CF] p-4 rounded-xs space-y-2">
                    <h4 className="text-xs font-bold text-[#E65100]">بارگذاری استاتیکی و طبقات مجاز</h4>
                    <p className="text-[11.5px] text-[#4A443F] leading-relaxed">
                      هر هسته بتنی یا اسکلت صلب محلی، حداکثر قادر به هدایت و توزیع بارهای جانبی تا سقف ارتفاعی ۲ الی ۳ طبقه است. بار استاتیکی اضافی در صورتی که پوشش پایینی کمتر از {renderMath("50\\%")} باشد، بلافاصله منجر به لغو جایگذاری مدول در الگوریتم تکاملی کاندیدها خواهد شد.
                    </p>
                  </div>

                  <div className="border border-[#D9D4CF] p-4 rounded-xs space-y-2">
                    <h4 className="text-xs font-bold text-[#E65100]">شیب توپوگرافی و تراز زمین</h4>
                    <p className="text-[11.5px] text-[#4A443F] leading-relaxed">
                      در زمین‌های شیب‌دار (Sloped)، پایداری برشی خاک زیر پی با فرمول {renderMath("\\Delta z \\le 1.4")} کنترل می‌شود. در صورتی که تفاوت ارتفاع فیزیکی دو گوشه یک ماژول از این مقدار فراتر رود، جایگذاری رد شده و سیستم پله‌های محوطه‌سازی را جهت پایداری فعال می‌کند.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: OPTIMIZATION LOGIC */}
            {activeTab === 'optimization' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-sm font-extrabold text-[#2D2926] border-b border-[#D9D4CF] pb-2 mb-3">موتور شبیه‌سازی و بهینه‌سازی چندهدفه</h3>
                  <p className="text-xs text-[#4A443F] leading-relaxed">
                    طراحی سکونتگاه در Settle صرفاً یک فرآیند دستی نیست. الگوریتم مولد به طور پیوسته چندین راهکار تولید کرده و بهترین موارد را بر اساس روش‌های اکتشافی ریاضی تفکیک می‌کند.
                  </p>
                </div>

                {/* A* Pathfinding Logic */}
                <div className="bg-[#F7F5F2] border border-[#D9D4CF] p-4 rounded-xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#2D2926]">
                    <Compass size={15} className="text-[#E65100]" />
                    <span>مسیریابی شبکه عابر پیاده با الگوریتم {renderMath("A^*")}</span>
                  </div>
                  <p className="text-xs text-[#4A443F] leading-relaxed">
                    برای اتصال واحدهای مسکونی به هسته‌ها و فضاهای اشتراکی، یک شبکه پیاده‌راه خودکار ایجاد می‌شود. سیستم از الگوریتم مسیر‌یابی بهینه {renderMath("A^*")} استفاده می‌کند تا کوتاه‌ترین راه غیرمسدود را بین درب ورودی واحد و نزدیک‌ترین هسته فیزیکی محاسبه کند:
                  </p>
                  <div className="bg-white p-3 border border-[#D9D4CF] rounded-sm text-center font-mono text-sm my-2">
                    {renderMath("f(n) = g(n) + h(n)", true)}
                  </div>
                  <p className="text-[11px] text-[#8B8378] leading-relaxed">
                    که در آن {renderMath("g(n)")} هزینه واقعی از مبدا به گره کنونی و {renderMath("h(n)")} تخمین فاصله مستقیم منهتن تا هسته مقصد است. این مسیریابی مانع تلاقی مسیرها با ساختمان‌های موجود می‌شود.
                  </p>
                </div>

                {/* Multi-objective Candidates */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-[#2D2926] flex items-center gap-1.5">
                    <Layers size={13} className="text-[#E65100]" />
                    <span>فرآیند تولید کاندیدا و رتبه‌بندی</span>
                  </h4>
                  <p className="text-xs text-[#4A443F] leading-relaxed">
                    الگوریتم مولد، تعداد <strong className="text-[#2D2926]">۵۰ الی ۲۰۰ کاندیدا</strong> را به صورت کاملاً تصادفی ایجاد کرده و بر اساس ۶ معیار همگرا رتبه‌بندی می‌کند. در نهایت ۳ راهکار برتر را ارائه می‌دهد:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 border border-blue-200 bg-blue-50/50 rounded-xs">
                      <strong className="text-xs text-blue-900 block mb-1">راهکار A (دسترسی حداکثری)</strong>
                      <span className="text-[11px] text-blue-800/80 leading-relaxed">
                        کاندیدایی که بالاترین بازدهی حرکت عابر پیاده و کمترین فواصل دسترسی تا هسته را دارد.
                      </span>
                    </div>
                    <div className="p-3 border border-orange-200 bg-orange-50/50 rounded-xs">
                      <strong className="text-xs text-orange-900 block mb-1">راهکار B (پتانسیل توسعه)</strong>
                      <span className="text-[11px] text-orange-800/80 leading-relaxed">
                        بیشترین فضاهای خالی بافر را در اطراف هسته‌ها برای اضافه کردن واحدهای مسکونی بعدی حفظ می‌کند.
                      </span>
                    </div>
                    <div className="p-3 border border-emerald-200 bg-emerald-50/50 rounded-xs">
                      <strong className="text-xs text-emerald-900 block mb-1">راهکار C (امتیاز ترکیبی بهینه)</strong>
                      <span className="text-[11px] text-emerald-800/80 leading-relaxed">
                        بالاترین تعادل ریاضی همگن را بین حیاط‌ها، پایداری، دسترسی و ظرفیت به دست آورده است.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#D9D4CF] bg-[#F7F5F2] flex items-center justify-between">
          <span className="text-[10.5px] text-[#8B8378]">دانش فنی و توسعه بومی - نسخه ۱.۴</span>
          <button 
            onClick={onClose}
            className="px-5 py-1.5 bg-[#2D2926] hover:bg-[#E65100] text-white text-xs font-bold transition shadow-3xs cursor-pointer rounded-xs"
          >
            فهمیدم، بازگشت به طراحی
          </button>
        </div>
      </div>
    </div>
  );
};
