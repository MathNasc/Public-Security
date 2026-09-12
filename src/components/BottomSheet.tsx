import React, { useState } from 'react';
import { motion, PanInfo } from 'motion/react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useAndroidBack } from '../hooks/useAndroidBack.js';

interface BottomSheetProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  initialSnap?: 'collapsed' | 'half' | 'full';
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  initialSnap = 'half'
}) => {
  const [snap, setSnap] = useState<'collapsed' | 'half' | 'full'>(initialSnap);

  useAndroidBack(isOpen && snap === 'full', () => {
    setSnap('half');
  });

  useAndroidBack(isOpen && snap === 'half', () => {
    if (onClose) onClose();
    else setSnap('collapsed');
  });

  if (!isOpen) return null;

  const heightClasses = {
    collapsed: 'h-[28vh]',
    half: 'h-[55vh]',
    full: 'h-[88vh]'
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y < -50) {
      // Drag up
      if (snap === 'collapsed') setSnap('half');
      else if (snap === 'half') setSnap('full');
    } else if (info.offset.y > 50) {
      // Drag down
      if (snap === 'full') setSnap('half');
      else if (snap === 'half') setSnap('collapsed');
      else if (snap === 'collapsed' && onClose) onClose();
    }
  };

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col pointer-events-none">
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className={`pointer-events-auto bg-slate-900/98 border-t border-slate-800 rounded-t-3xl shadow-2xl flex flex-col transition-all duration-300 ease-out pb-[max(3.5rem,env(safe-area-inset-bottom))] ${heightClasses[snap]}`}
      >
        {/* Drag Handle Header */}
        <div className="flex flex-col items-center justify-center pt-3 pb-2 px-4 cursor-grab active:cursor-grabbing border-b border-slate-800/60 touch-none">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full mb-2" />
          <div className="w-full flex items-center justify-between text-slate-200">
            <div className="text-sm font-semibold truncate flex items-center gap-2">
              {title}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSnap(snap === 'full' ? 'half' : 'full')}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                aria-label={snap === 'full' ? "Recolher painel" : "Expandir painel"}
              >
                {snap === 'full' ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  aria-label="Fechar painel"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 touch-pan-y">
          {children}
        </div>
      </motion.div>
    </div>
  );
};
