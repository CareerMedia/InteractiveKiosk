import { useEffect, useState } from 'react';

interface ViewportLayoutState {
  width: number;
  height: number;
  isLandscape: boolean;
}

function getViewportState(): ViewportLayoutState {
  if (typeof window === 'undefined') {
    return { width: 1080, height: 1920, isLandscape: false };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    isLandscape: window.innerWidth > window.innerHeight,
  };
}

export function useViewportLayout(): ViewportLayoutState {
  const [layout, setLayout] = useState<ViewportLayoutState>(getViewportState);

  useEffect(() => {
    const onResize = () => setLayout(getViewportState());
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return layout;
}
