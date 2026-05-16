"use client";

/**
 * Toast notification system built on Radix UI Toast.
 *
 * Usage — wrap your app with <ToastProvider>, then call:
 *   const { toast } = useToast();
 *   toast.success("Trade submitted!");
 *   toast.error("Something went wrong");
 *   toast.info("Processing...");
 */

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id:       string;
  variant:  ToastVariant;
  title:    string;
  message?: string;
}

interface ToastContextValue {
  toast: {
    success: (title: string, message?: string) => void;
    error:   (title: string, message?: string) => void;
    info:    (title: string, message?: string) => void;
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((variant: ToastVariant, title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { id, variant, title, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (title: string, message?: string) => addToast("success", title, message),
    error:   (title: string, message?: string) => addToast("error",   title, message),
    info:    (title: string, message?: string) => addToast("info",    title, message),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}

        {toasts.map(t => (
          <ToastPrimitive.Root
            key={t.id}
            open={true}
            onOpenChange={(open) => { if (!open) removeToast(t.id); }}
            className={`
              group pointer-events-auto relative flex w-full items-center justify-between
              space-x-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg
              transition-all data-[swipe=cancel]:translate-x-0
              data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
              data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
              data-[swipe=move]:transition-none data-[state=open]:animate-in
              data-[state=closed]:animate-out data-[swipe=end]:animate-out
              data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full
              data-[state=open]:slide-in-from-top-full
              ${t.variant === "success" ? "border-green-800 bg-green-950 text-green-100" : ""}
              ${t.variant === "error"   ? "border-red-800 bg-red-950 text-red-100"       : ""}
              ${t.variant === "info"    ? "border-blue-800 bg-blue-950 text-blue-100"    : ""}
            `}
          >
            <div className="flex items-start gap-3">
              <ToastIcon variant={t.variant} />
              <div className="grid gap-1">
                <ToastPrimitive.Title className="text-sm font-semibold">
                  {t.title}
                </ToastPrimitive.Title>
                {t.message && (
                  <ToastPrimitive.Description className="text-xs opacity-80">
                    {t.message}
                  </ToastPrimitive.Description>
                )}
              </div>
            </div>
            <ToastPrimitive.Close
              className="absolute right-2 top-2 rounded-md opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}

        <ToastPrimitive.Viewport
          className="
            fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col-reverse gap-2
            p-4 sm:max-w-[420px]
          "
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Icon helper
// ---------------------------------------------------------------------------

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") return <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />;
  if (variant === "error")   return <XCircle     className="h-5 w-5 text-red-400   shrink-0 mt-0.5" />;
  return                            <Info        className="h-5 w-5 text-blue-400  shrink-0 mt-0.5" />;
}
