import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        pending: "border-transparent bg-yellow-100 text-yellow-800",
        review: "border-transparent bg-blue-100 text-blue-800",
        approved: "border-transparent bg-green-100 text-green-800",
        rejected: "border-transparent bg-red-100 text-red-800",
        active: "border-transparent bg-green-100 text-green-800",
        closed: "border-transparent bg-gray-100 text-gray-700",
        defaulted: "border-transparent bg-red-100 text-red-800",
        processing: "border-transparent bg-blue-100 text-blue-800",
        completed: "border-transparent bg-green-100 text-green-800",
        failed: "border-transparent bg-red-100 text-red-800",
        high: "border-transparent bg-red-100 text-red-800",
        medium: "border-transparent bg-yellow-100 text-yellow-800",
        low: "border-transparent bg-gray-100 text-gray-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
