import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm
   font-medium transition-colors focus-visible:outline-none focus-visible:ring-2
   focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none
   disabled:opacity-50 select-none`,
  {
    variants: {
      variant: {
        primary:   "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700",
        secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-900 border border-zinc-700",
        danger:    "bg-red-600 text-white hover:bg-red-500 active:bg-red-700",
        ghost:     "hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100",
        outline:   "border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
        success:   "bg-green-600 text-white hover:bg-green-500 active:bg-green-700",
        link:      "text-blue-400 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm:   "h-8  px-3 text-xs",
        md:   "h-10 px-4 text-sm",
        lg:   "h-12 px-6 text-base",
        icon: "h-9  w-9  p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size:    "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** When true, renders the button's children as the root element (useful for links) */
  asChild?:  boolean;
  /** Show a spinner and disable the button */
  loading?:  boolean;
  /** Icon to show before the label */
  leftIcon?:  React.ReactNode;
  /** Icon to show after the label */
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild  = false,
      loading  = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    // When asChild=true, Radix Slot merges props into the single child element.
    // Slot uses React.Children.only internally, so we must not wrap children
    // with leftIcon/rightIcon/loading nodes — pass children through as-is.
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
