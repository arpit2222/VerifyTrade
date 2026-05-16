import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Error message — renders the input with a red border and shows text below */
  error?:   string;
  /** Label displayed above the input */
  label?:   string;
  /** Helper text displayed below the input (hidden when error is present) */
  hint?:    string;
  /** Icon displayed inside the left edge */
  leftAddon?:  React.ReactNode;
  /** Icon or text displayed inside the right edge */
  rightAddon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, hint, leftAddon, rightAddon, id, ...props }, ref) => {
    const inputId = id ?? React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftAddon && (
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              `flex h-10 w-full rounded-lg border bg-zinc-800/60 px-3 py-2 text-sm
               text-zinc-100 placeholder:text-zinc-500 transition-colors
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
               disabled:cursor-not-allowed disabled:opacity-50`,
              error
                ? "border-red-600 focus-visible:ring-red-500"
                : "border-zinc-700 hover:border-zinc-600",
              leftAddon  && "pl-9",
              rightAddon && "pr-9",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />

          {rightAddon && (
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500">
              {rightAddon}
            </div>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-zinc-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
