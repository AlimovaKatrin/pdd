import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = '',
  initialFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    const elements = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length > 0);
    (initialFocus?.current ?? elements()[0])?.focus({ preventScroll: true });
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === 'Tab') {
        const items = elements(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener('keydown', keydown);
    return () => {
      dialog.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [initialFocus]);
  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button className="icon-button close-modal" onClick={onClose} aria-label="Закрыть">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
