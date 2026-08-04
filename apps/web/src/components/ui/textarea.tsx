import * as React from "react"
import { cn } from "@/utils/cn"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-white/12 bg-[#0A0B0D] px-3 py-2 text-sm text-[#F4F5F6] shadow-panel-elevated transition-colors placeholder:text-[#6E747A] focus-visible:outline-none focus-visible:ring-1 focus-visible:border-[#C9A227] focus-visible:ring-[#C9A227] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
