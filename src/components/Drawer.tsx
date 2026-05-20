import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Drawer({
  open,
  title,
  onClose,
  children,
  widthClassName = 'w-full sm:w-[520px]',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (!open) return;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/60"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div
        className={`absolute right-0 top-0 h-full ${widthClassName} overflow-auto border-l border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-lg font-extrabold">{title}</div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 p-0 hover:border-white/25"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
