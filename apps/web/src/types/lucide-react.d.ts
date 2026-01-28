// Type declaration to fix React 18 compatibility issues with lucide-react
// This resolves TS2786 errors for lucide-react components in strict builds
// The issue is that lucide-react uses ForwardRefExoticComponent which has type
// incompatibilities with React 18's stricter ReactNode types in strict mode.

import type { ComponentType, RefAttributes, ReactElement } from 'react';
import type { LucideProps } from 'lucide-react';

// Define a compatible icon type that works with React 18 JSX
// This type signature matches what React 18 expects for JSX components
// Extend LucideProps to explicitly include className and other HTML attributes
type ExtendedLucideProps = LucideProps & {
  className?: string;
  size?: number | string;
};

type LucideIcon = ComponentType<ExtendedLucideProps & RefAttributes<SVGSVGElement>> & {
  (props: ExtendedLucideProps & RefAttributes<SVGSVGElement>): ReactElement | null;
};

declare module 'lucide-react' {
  // Override icon exports to use the compatible type
  // This makes named exports from lucide-react compatible with React 18
  // TypeScript will use these declarations instead of the original ForwardRefExoticComponent types
  
  // Icons used throughout the codebase
  export const AlertTriangle: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowUpCircle: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Calendar: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const CheckSquare: LucideIcon;
  export const Clock: LucideIcon;
  export const Edit: LucideIcon;
  export const Edit2: LucideIcon;
  export const FileText: LucideIcon;
  export const Ghost: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Loader2: LucideIcon;
  export const LogOut: LucideIcon;
  export const MapPin: LucideIcon;
  export const MessageCircle: LucideIcon;
  export const Minus: LucideIcon;
  export const PauseCircle: LucideIcon;
  export const Phone: LucideIcon;
  export const PhoneCall: LucideIcon;
  export const Plus: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Search: LucideIcon;
  export const Star: LucideIcon;
  export const Trophy: LucideIcon;
  export const Trash2: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Upload: LucideIcon;
  export const User: LucideIcon;
  export const UserCheck: LucideIcon;
  export const UserX: LucideIcon;
  export const Users: LucideIcon;
  export const X: LucideIcon;
  
  // Re-export LucideProps for convenience
  export type { LucideProps };
}
