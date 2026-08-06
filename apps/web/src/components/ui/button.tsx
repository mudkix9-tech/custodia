import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--ui-control-radius)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ui-accent)] text-[var(--ui-accent-fg)] font-semibold shadow hover:bg-[var(--ui-accent-hover)]",
        destructive:
          "bg-[color-mix(in_srgb,var(--ui-danger)_10%,transparent)] text-[var(--ui-danger)] border border-[color-mix(in_srgb,var(--ui-danger)_25%,transparent)] shadow-panel-elevated hover:bg-[color-mix(in_srgb,var(--ui-danger)_18%,transparent)]",
        outline:
          "border border-[var(--ui-field-border)] bg-transparent text-[var(--ui-fg-muted)] shadow-panel-elevated hover:bg-[var(--ui-hover-bg)] hover:text-[var(--ui-fg)]",
        secondary:
          "bg-[var(--ui-panel-bg)] text-[var(--ui-panel-fg)] border border-[var(--ui-field-border)] shadow-panel-elevated hover:bg-[var(--ui-hover-bg)]",
        ghost: "text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-bg)] hover:text-[var(--ui-fg)]",
        link: "text-[var(--ui-accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
