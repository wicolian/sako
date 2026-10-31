'use client';

import { Icon } from '@iconify/react';

interface IconProps {
  className?: string;
}

export const Icons = {
  Refresh: ({ className }: IconProps) => <Icon icon="solar:refresh-circle-linear" className={className} />,
  Settings: ({ className }: IconProps) => <Icon icon="solar:settings-linear" className={className} />,
  Logout: ({ className }: IconProps) => <Icon icon="solar:logout-2-linear" className={className} />,
  Sun: ({ className }: IconProps) => <Icon icon="solar:sun-2-linear" className={className} />,
  Moon: ({ className }: IconProps) => <Icon icon="solar:moon-linear" className={className} />,
  ArrowUp: ({ className }: IconProps) => <Icon icon="solar:arrow-right-up-linear" className={className} />,
  ArrowDown: ({ className }: IconProps) => <Icon icon="solar:arrow-right-down-linear" className={className} />,
  Check: ({ className }: IconProps) => <Icon icon="solar:check-circle-linear" className={className} />,
  Clock: ({ className }: IconProps) => <Icon icon="solar:clock-circle-linear" className={className} />,
  Shield: ({ className }: IconProps) => <Icon icon="solar:shield-check-linear" className={className} />,
  Zap: ({ className }: IconProps) => <Icon icon="solar:bolt-linear" className={className} />,
  Menu: ({ className }: IconProps) => <Icon icon="solar:hamburger-menu-linear" className={className} />,
  Eye: ({ className }: IconProps) => <Icon icon="solar:eye-linear" className={className} />,
  EyeClosed: ({ className }: IconProps) => <Icon icon="solar:eye-closed-linear" className={className} />,
  ArrowLeft: ({ className }: IconProps) => <Icon icon="solar:arrow-left-linear" className={className} />,
  Lock: ({ className }: IconProps) => <Icon icon="solar:lock-password-linear" className={className} />,

  // Ops Room Icons
  Alert: ({ className }: IconProps) => <Icon icon="solar:danger-triangle-linear" className={className} />,
  Info: ({ className }: IconProps) => <Icon icon="solar:info-circle-linear" className={className} />,
  Server: ({ className }: IconProps) => <Icon icon="solar:server-square-linear" className={className} />,
  Globe: ({ className }: IconProps) => <Icon icon="solar:globe-linear" className={className} />,
  Linkedin: ({ className }: IconProps) => <Icon icon="bxl:linkedin" className={className} />,
  Users: ({ className }: IconProps) => <Icon icon="solar:users-group-rounded-linear" className={className} />,
  Rocket: ({ className }: IconProps) => <Icon icon="solar:rocket-2-linear" className={className} />,
  Megaphone: ({ className }: IconProps) => <Icon icon="solar:megaphone-linear" className={className} />,
  CreditCard: ({ className }: IconProps) => <Icon icon="solar:card-linear" className={className} />,
  Search: ({ className }: IconProps) => <Icon icon="solar:magnifer-linear" className={className} />,
  Terminal: ({ className }: IconProps) => <Icon icon="solar:terminal-linear" className={className} />,
  Maximize: ({ className }: IconProps) => <Icon icon="solar:maximize-square-linear" className={className} />,
  Minimize: ({ className }: IconProps) => <Icon icon="solar:minimize-square-linear" className={className} />,

  // Delivery/Infra Icons
  Box: ({ className }: IconProps) => <Icon icon="solar:box-linear" className={className} />,
  Cpu: ({ className }: IconProps) => <Icon icon="solar:cpu-bolt-linear" className={className} />,
  Wallet: ({ className }: IconProps) => <Icon icon="solar:wallet-linear" className={className} />,
  Flame: ({ className }: IconProps) => <Icon icon="solar:flame-linear" className={className} />,
  Trending: ({ className }: IconProps) => <Icon icon="solar:graph-up-linear" className={className} />,
  Layers: ({ className }: IconProps) => <Icon icon="solar:layers-linear" className={className} />,
  
  // UI Actions
  X: ({ className }: IconProps) => <Icon icon="solar:close-circle-linear" className={className} />,
  Chart: ({ className }: IconProps) => <Icon icon="solar:chart-2-linear" className={className} />,
};
