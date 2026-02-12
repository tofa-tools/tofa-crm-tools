declare module 'react-hot-toast' {
  import { ReactNode } from 'react';
  interface ToastOptions {
    duration?: number;
    position?: string;
  }
  const toast: {
    (message: string | ReactNode, options?: ToastOptions): string;
    success: (message: string | ReactNode, options?: ToastOptions) => string;
    error: (message: string | ReactNode, options?: ToastOptions) => string;
    loading: (message: string | ReactNode, options?: ToastOptions) => string;
    dismiss: (id?: string) => void;
  };
  export default toast;
  export function Toaster(props?: object): ReactNode;
}
