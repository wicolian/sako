"use client";

import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Brand colors instead of rainbow - uses lime shades
// Define CSS variables for brand gradient colors in globals.css or use inline
const brandGradientButtonVariants = cva(
  cn(
    "relative cursor-pointer group transition-all animate-rainbow",
    "inline-flex items-center justify-center gap-2 shrink-0",
    "rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-[#9AE83E]/50",
    "text-sm font-semibold whitespace-nowrap",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0"
  ),
  {
    variants: {
      variant: {
        default:
          cn(
            "border-0 text-white",
            // Dark inner bg with lime gradient border
            "bg-[linear-gradient(#1a1a1a,#1a1a1a),linear-gradient(#1a1a1a_50%,rgba(26,26,26,0.6)_80%,rgba(26,26,26,0)),linear-gradient(90deg,#9AE83E,#7BC62D,#6DB827,#5BA820,#9AE83E)]",
            "bg-[length:200%]",
            "[background-clip:padding-box,border-box,border-box]",
            "[background-origin:border-box]",
            "[border:calc(0.125rem)_solid_transparent]",
            // Glow effect
            "before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2",
            "before:animate-rainbow before:bg-[linear-gradient(90deg,#9AE83E,#7BC62D,#6DB827,#5BA820,#9AE83E)]",
            "before:[filter:blur(0.75rem)]"
          ),
        outline:
          cn(
            "text-[#1a1a1a]",
            // White inner bg with lime gradient border
            "bg-[linear-gradient(#ffffff,#ffffff),linear-gradient(#ffffff_50%,rgba(255,255,255,0.6)_80%,rgba(255,255,255,0)),linear-gradient(90deg,#9AE83E,#7BC62D,#6DB827,#5BA820,#9AE83E)]",
            "bg-[length:200%]",
            "[background-clip:padding-box,border-box,border-box]",
            "[background-origin:border-box]",
            "[border:calc(0.125rem)_solid_transparent]",
            // Glow effect
            "before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2",
            "before:animate-rainbow before:bg-[linear-gradient(90deg,#9AE83E,#7BC62D,#6DB827,#5BA820,#9AE83E)]",
            "before:[filter:blur(0.75rem)]"
          ),
      },
      size: {
        default: "h-11 px-8 py-3",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-10 py-4",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface BrandGradientButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof brandGradientButtonVariants> {
  asChild?: boolean;
}

const BrandGradientButton = React.forwardRef<HTMLButtonElement, BrandGradientButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-slot="button"
        className={cn(brandGradientButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

BrandGradientButton.displayName = "BrandGradientButton";

export { BrandGradientButton, brandGradientButtonVariants, type BrandGradientButtonProps };
