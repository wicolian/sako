import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TOUR_STORAGE_KEY = 'sako_tour_completed';

interface ProductTourContextValue {
  isRunning: boolean;
  hasSeenTour: boolean;
  startTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
  stepIndex: number;
  setStepIndex: (index: number) => void;
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

export const ProductTourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    setHasSeenTour(seen);
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setIsRunning(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsRunning(false);
    setHasSeenTour(true);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setHasSeenTour(false);
    setStepIndex(0);
  }, []);

  return (
    <ProductTourContext.Provider
      value={{
        isRunning,
        hasSeenTour,
        startTour,
        completeTour,
        resetTour,
        stepIndex,
        setStepIndex,
      }}
    >
      {children}
    </ProductTourContext.Provider>
  );
};

export function useProductTour(): ProductTourContextValue {
  const context = useContext(ProductTourContext);
  if (!context) {
    throw new Error('useProductTour must be used within a ProductTourProvider');
  }
  return context;
}
