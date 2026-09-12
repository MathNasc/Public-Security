import { useEffect, useRef } from 'react';

export function useAndroidBack(isOpen: boolean, onClose: () => void) {
  const isPushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (isPushedRef.current) {
        isPushedRef.current = false;
      }
      return;
    }

    // Push dummy history entry so Android back button triggers popstate instead of leaving page
    window.history.pushState({ modalOpen: true }, '');
    isPushedRef.current = true;

    const handlePopState = (event: PopStateEvent) => {
      if (isPushedRef.current) {
        isPushedRef.current = false;
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (isPushedRef.current) {
        isPushedRef.current = false;
        // Clean up history entry if closed programmatically without back button
        if (window.history.state?.modalOpen) {
          window.history.back();
        }
      }
    };
  }, [isOpen, onClose]);
}
