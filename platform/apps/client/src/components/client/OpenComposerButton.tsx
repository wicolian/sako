import React from 'react';
import { Button } from '../ui/button';

interface OpenComposerButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  /** If true, opens in same tab instead of new tab */
  sameTab?: boolean;
}

/**
 * Button to open Composer - currently shows "Coming Soon" as Composer is not ready.
 * Previously opened Composer with SSO authentication.
 */
export const OpenComposerButton: React.FC<OpenComposerButtonProps> = ({
  variant = 'outline',
  size = 'default',
  className,
  sameTab = false,
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={true}
    >
      <SparklesIcon className="h-4 w-4" />
      Composer (coming soon)
    </Button>
  );
};

// Simple sparkles icon component
const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </svg>
);

export default OpenComposerButton;
