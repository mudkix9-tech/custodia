import * as React from "react"
import { cn } from "@/utils/cn"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-[var(--ui-field-radius)] border border-[var(--ui-field-border)] bg-[var(--ui-field-bg)] px-3 py-2 text-sm text-[var(--ui-field-fg)] shadow-panel-elevated transition-colors placeholder:text-[var(--ui-field-placeholder)] focus-visible:outline-none focus-visible:ring-1 focus-visible:border-[var(--ui-field-accent)] focus-visible:ring-[var(--ui-field-accent)] disabled:cursor-not-allowed disabled:opacity-50",
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
