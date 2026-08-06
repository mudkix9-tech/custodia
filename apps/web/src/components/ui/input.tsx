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
          "flex h-9 w-full rounded-[var(--ui-field-radius)] border border-[var(--ui-field-border)] bg-[var(--ui-field-bg)] px-3 py-1 text-sm text-[var(--ui-field-fg)] shadow-panel-elevated transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--ui-field-placeholder)] focus-visible:outline-none focus-visible:ring-1 focus-visible:border-[var(--ui-field-accent)] focus-visible:ring-[var(--ui-field-accent)] disabled:cursor-not-allowed disabled:opacity-50",
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
