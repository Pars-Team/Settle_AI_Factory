/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettlementState } from '../types';
import { validateCourtyards, SettlementCourtyardValidationReport } from '../utils/courtyardValidator';
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Trash2, X, Compass, Info } from 'lucide-react';

interface CourtyardValidatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SettlementState;
  onCleanInvalidCourtyards?: () => void;
}

export default function CourtyardValidatorModal({
  isOpen,
  onClose,
  state,
  onCleanInvalidCourtyards
}: CourtyardValidatorModalProps) {
  if (!isOpen) return null;

  const report: SettlementCourtyardValidationReport = validateCourtyards(state);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="bg-[#FDFCFB] border border-[#D9D4CF] shadow-2xl rounded-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#2D2926] text-white p-4 flex items-center justify-between border-b border-[#2D2926]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className={report.allValid ? 'text-emerald-400' : 'text-amber-400'} />
            <div>
              <h3 className="font-serif font-bold text-sm tracking-wide">
                ابزار اعتبارسنجی حیاط‌ها و میانسراها (Courtyard Validator)
              </h3>
              <p className="text-[10.5px] text-gray-300 font-sans mt-0.5">
                بررسی لحظه‌ای قانون مجاورت حیاط‌ها با یونیت‌های مسکونی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 transition rounded-sm hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Rule Banner */}
        <div className="bg-[#F7F5F2] border-b border-[#D9D4CF] p-3 px-4 flex items-start gap-2.5 text-xs text-[#2D2926]">
          <Info size={16} className="text-[#E65100] shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">
            <strong>قانون فنی استقرار حیاط:</strong> هر حیاط یا میانسرا باید <strong>حداقل از ۲ جهت (شمال، جنوب، شرق، غرب)</strong> به یونیت‌های مسکونی مجاور باشد تا محصوریت محیطی و سایه‌اندازی مناسب فراهم گردد.
          </div>
        </div>

        {/* Summary Stats Bar */}
        <div className="p-4 grid grid-cols-3 gap-3 border-b border-[#D9D4CF] bg-white">
          <div className="p-2.5 border border-[#D9D4CF] bg-[#F7F5F2] text-center rounded-xs">
            <span className="text-[10px] font-bold text-[#8B8378] block">کل حیاط‌های موجود</span>
            <strong className="text-base font-bold text-[#2D2926] font-mono block mt-0.5">
              {report.totalCourtyards} محوطه
            </strong>
          </div>

          <div className="p-2.5 border border-emerald-200 bg-emerald-50/50 text-center rounded-xs">
            <span className="text-[10px] font-bold text-emerald-800 block flex items-center justify-center gap-1">
              <CheckCircle2 size={11} className="text-emerald-600" />
              <span>تایید شده (مجاز)</span>
            </span>
            <strong className="text-base font-bold text-emerald-700 font-mono block mt-0.5">
              {report.validCourtyardsCount}
            </strong>
          </div>

          <div className={`p-2.5 border text-center rounded-xs ${
            report.invalidCourtyardsCount > 0
              ? 'border-rose-300 bg-rose-50/70 text-rose-800'
              : 'border-[#D9D4CF] bg-[#F7F5F2] text-gray-500'
          }`}>
            <span className="text-[10px] font-bold block flex items-center justify-center gap-1">
              <AlertTriangle size={11} className={report.invalidCourtyardsCount > 0 ? 'text-rose-600' : 'text-gray-400'} />
              <span>غیرمجاز (نقض قانون)</span>
            </span>
            <strong className={`text-base font-bold font-mono block mt-0.5 ${
              report.invalidCourtyardsCount > 0 ? 'text-rose-700' : 'text-gray-600'
            }`}>
              {report.invalidCourtyardsCount}
            </strong>
          </div>
        </div>

        {/* Detailed List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
          {report.statuses.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              هیچ حیاطی در این ویرایش از طرح تعریف نشده است.
            </div>
          ) : (
            report.statuses.map((status, idx) => (
              <div
                key={status.courtyardId}
                className={`p-3.5 border rounded transition-all ${
                  status.isValid
                    ? 'bg-white border-[#D9D4CF]'
                    : 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#2D2926] font-serif">
                      حیاط شماره {idx + 1} (موقعیت: X:{status.x}, Y:{status.y})
                    </span>
                    <span className="text-[9.5px] bg-[#EEEBE6] text-[#8B8378] px-1.5 py-0.5 rounded font-mono">
                      {status.size} سلول
                    </span>
                  </div>

                  {status.isValid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                      <CheckCircle2 size={11} />
                      <span>تایید شده ({status.directionCount} جهت)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                      <XCircle size={11} />
                      <span>غیرمجاز ({status.directionCount} جهت)</span>
                    </span>
                  )}
                </div>

                <p className="text-[10.5px] text-[#4A443F] mb-2.5 leading-relaxed">
                  {status.messageFa}
                </p>

                {/* 4 Directions Matrix */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[#EEEBE6] text-[10px]">
                  <div className={`p-1.5 border text-center rounded-xs ${
                    status.adjacentDirections.north ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}>
                    <span className="block font-bold">شمال (North)</span>
                    <span className="font-mono mt-0.5 block">{status.adjacentDirections.north ? '✅ مجاور' : '❌ بدون مجاورت'}</span>
                  </div>

                  <div className={`p-1.5 border text-center rounded-xs ${
                    status.adjacentDirections.south ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}>
                    <span className="block font-bold">جنوب (South)</span>
                    <span className="font-mono mt-0.5 block">{status.adjacentDirections.south ? '✅ مجاور' : '❌ بدون مجاورت'}</span>
                  </div>

                  <div className={`p-1.5 border text-center rounded-xs ${
                    status.adjacentDirections.east ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}>
                    <span className="block font-bold">شرق (East)</span>
                    <span className="font-mono mt-0.5 block">{status.adjacentDirections.east ? '✅ مجاور' : '❌ بدون مجاورت'}</span>
                  </div>

                  <div className={`p-1.5 border text-center rounded-xs ${
                    status.adjacentDirections.west ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}>
                    <span className="block font-bold">غرب (West)</span>
                    <span className="font-mono mt-0.5 block">{status.adjacentDirections.west ? '✅ مجاور' : '❌ بدون مجاورت'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 px-4 border-t border-[#D9D4CF] bg-[#F7F5F2] flex items-center justify-between">
          {report.invalidCourtyardsCount > 0 && onCleanInvalidCourtyards ? (
            <button
              onClick={() => {
                onCleanInvalidCourtyards();
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Trash2 size={13} />
              <span>حذف / اصلاح خودکار {report.invalidCourtyardsCount} حیاط غیرمجاز</span>
            </button>
          ) : (
            <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>تمام حیاط‌ها مطابق استاندارد ۲ جهت مجاورت قرار دارند.</span>
            </span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2D2926] hover:bg-[#E65100] text-white font-bold text-xs rounded transition cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
}
