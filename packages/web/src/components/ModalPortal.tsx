import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: ReactNode;
  isOpen: boolean;
}

/**
 * Portal component that renders modals outside the main layout
 * to avoid z-index stacking context issues with the header.
 */
export default function ModalPortal({ children, isOpen }: ModalPortalProps) {
  if (!isOpen) return null;

  return createPortal(
    children,
    document.body
  );
}
