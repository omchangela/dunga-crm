"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // Track whether an async onClick is still running so we can disable the
    // button and ignore extra clicks (prevents double-submit / duplicate actions).
    const [pending, setPending] = React.useState(false);
    const pendingRef = React.useRef(false);

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (pendingRef.current) {
          // An async action from a previous click is still in flight — ignore.
          e.preventDefault();
          return;
        }
        const result = onClick?.(e) as unknown;
        if (result && typeof (result as Promise<unknown>).then === "function") {
          pendingRef.current = true;
          setPending(true);
          Promise.resolve(result).finally(() => {
            pendingRef.current = false;
            setPending(false);
          });
        }
      },
      [onClick]
    );

    // asChild renders a non-button child (e.g. a Link) — don't add click guards there.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={onClick}
          disabled={disabled}
          {...props}
        />
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
