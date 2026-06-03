import { useState, useEffect, useCallback } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

export interface LayoutInfo {
  width: number;
  height: number;
  isLandscape: boolean;
  isTablet: boolean;
  columns: 1 | 2 | 3;
  contentMaxWidth: number;
  mapHeight: number;
  headerCompact: boolean;
}

function compute(w: number, h: number): LayoutInfo {
  const isLandscape = w > h;
  const isTablet    = Math.min(w, h) >= 600;
  const columns: 1 | 2 | 3 = isTablet ? 3 : isLandscape ? 2 : 1;
  const contentMaxWidth = isTablet ? Math.min(w, 800) : w;
  const mapHeight = isLandscape ? h * 0.5 : isTablet ? 350 : 280;
  const headerCompact = isLandscape && !isTablet;

  return { width: w, height: h, isLandscape, isTablet, columns, contentMaxWidth, mapHeight, headerCompact };
}

export function useLayout(): LayoutInfo {
  const { width, height } = Dimensions.get('window');
  const [layout, setLayout] = useState<LayoutInfo>(() => compute(width, height));

  const onChange = useCallback(({ window }: { window: ScaledSize }) => {
    setLayout(compute(window.width, window.height));
  }, []);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', onChange);
    return () => sub.remove();
  }, [onChange]);

  return layout;
}
