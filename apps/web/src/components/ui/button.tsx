import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#C9A227] text-[#08090A] shadow hover:bg-[#E5C463]",
        destructive:
          "bg-red-500/10 text-red-500 border border-red-500/20 shadow-panel-elevated hover:bg-red-500/20",
        outline:
          "border border-white/10 bg-transparent text-[#9BA1A6] shadow-panel-elevated hover:bg-white/5 hover:text-[#F4F5F6]",
        secondary:
          "bg-[#1A1D21] text-[#E6E8EA] border border-white/10 shadow-panel-elevated hover:bg-[#252A30]",
        ghost: "text-[#9BA1A6] hover:bg-white/5 hover:text-[#F4F5F6]",
        link: "text-[#C9A227] underline-offset-4 hover:underline",
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
