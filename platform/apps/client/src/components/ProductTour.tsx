import React from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { useProductTour } from '../contexts/ProductTourContext';

// Tour step definitions
const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="nav-brands"]',
    content: (
      <div className="text-left">
        <h3 className="text-[15px] font-semibold mb-2">1. Create your brand</h3>
        <p className="text-[13px] text-[color:var(--muted-foreground)]">
          Start by setting up your brand. Add your colors, fonts, and tone of voice so every design matches your identity.
        </p>
      </div>
    ),
    disableBeacon: true,
    placement: 'right' as const,
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="new-task-btn"]',
    content: (
      <div className="text-left">
        <h3 className="text-[15px] font-semibold mb-2">2. Submit your first request</h3>
        <p className="text-[13px] text-[color:var(--muted-foreground)]">
          Create a design or motion request here. Our team delivers within 48 hours with unlimited revisions.
        </p>
      </div>
    ),
    placement: 'right' as const,
    spotlightPadding: 8,
  },
];

// Custom styles for Joyride to match the app's design system
const joyrideStyles = {
  options: {
    arrowColor: 'var(--card)',
    backgroundColor: 'var(--card)',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    primaryColor: 'var(--primary)',
    textColor: 'var(--foreground)',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipContent: {
    padding: 0,
  },
  buttonNext: {
    backgroundColor: 'var(--primary)',
    borderRadius: '9999px',
    color: 'var(--primary-foreground)',
    fontSize: '13px',
    fontWeight: 500,
    padding: '8px 16px',
  },
  buttonBack: {
    color: 'var(--muted-foreground)',
    fontSize: '13px',
    marginRight: '8px',
  },
  buttonSkip: {
    color: 'var(--muted-foreground)',
    fontSize: '13px',
  },
  buttonClose: {
    display: 'none',
  },
  spotlight: {
    borderRadius: '12px',
  },
};

/**
 * Product tour component using React Joyride
 * 
 * Triggered manually via the help icon in the header.
 * Guides users: Create brand → Create task
 */
export const ProductTour: React.FC = () => {
  const {
    isRunning,
    completeTour,
    stepIndex,
    setStepIndex,
  } = useProductTour();

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;

    // Handle step navigation
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1);
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1);
      }
    }

    // Handle tour completion
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      completeTour();
    }

    // Handle close button click
    if (action === ACTIONS.CLOSE) {
      completeTour();
    }
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={isRunning}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      disableScrolling
      hideCloseButton
      styles={joyrideStyles}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Got it!',
        next: 'Next',
        skip: 'Skip tour',
      }}
      floaterProps={{
        disableAnimation: true,
      }}
    />
  );
};

export default ProductTour;
