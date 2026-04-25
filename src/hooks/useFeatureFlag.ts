import { useState, useEffect } from 'react';

const FEATURE_FLAG_KEY = 'b2b_use_redesign_v2';

interface FeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

export function useFeatureFlag(key: string = FEATURE_FLAG_KEY): FeatureFlagResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored === 'true') {
      setIsEnabled(true);
    } else if (stored === 'false') {
      setIsEnabled(false);
    } else {
      setIsEnabled(true);
    }
    setIsLoading(false);
  }, [key]);

  const toggle = () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
    localStorage.setItem(key, newValue.toString());
  };

  const enable = () => {
    setIsEnabled(true); 
    localStorage.setItem(key, 'true');
  };

  const disable = () => {
    setIsEnabled(false);
    localStorage.setItem(key, 'false');
  };

  return { isEnabled, isLoading, toggle, enable, disable };
}

export function isRedesignV2Enabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(FEATURE_FLAG_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

export function setRedesignV2(enabled: boolean): void {
  localStorage.setItem(FEATURE_FLAG_KEY, enabled.toString());
}

export default useFeatureFlag;