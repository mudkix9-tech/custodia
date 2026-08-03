import * as React from "react"
import { cn } from "@/utils/cn"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-white/12 bg-[#0A0B0D] px-3 py-1 text-sm text-[#F4F5F6] shadow-panel-elevated transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#6E747A] focus-visible:outline-none focus-visible:ring-1 focus-visible:border-[#C9A227] focus-visible:ring-[#C9A227] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
