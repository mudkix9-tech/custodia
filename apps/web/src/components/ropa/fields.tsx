import React from 'react';

/**
 * The three form controls the Sprint 3 assessment panels are built from.
 *
 * They live here rather than inside each panel because of a React rule that is
 * easy to break and impossible to see in a type check: **a component declared
 * inside a render is a new component type on every render.** React compares
 * types to decide between updating and remounting, so a `const Text = (...) =>`
 * written inside `LiaPanel` is torn down and rebuilt on each pass — and a
 * controlled textarea that remounts loses focus. The form then accepts exactly
 * one character per click, which is the kind of defect that reads as "the app is
 * broken" and does not appear in any test that does not type twice.
 *
 * Each panel still needs its own `form` and `set`, so it wraps these in a thin
 * local function and **calls** it (`{Text({ field, label })}`) rather than
 * rendering it as `<Text/>`. Calling inlines the element into the parent's tree
 * with no new component type, which is the point.
 *
 * Styling is the register's: `#0D0F11` panel, `border-white/10`, `rounded-lg`,
 * matching the neighbouring tabs rather than introducing tokens.
 */

export function TextField({
  idPrefix,
  field,
  label,
  hint,
  rows = 3,
  value,
  onChange,
}: {
  idPrefix: string;
  field: string;
  label: string;
  hint?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `${idPrefix}-${field}`;
  return (
    <div>
      <label htmlFor={id} className="text-[12.5px] font-medium text-[#E6E8EA]">{label}</label>
      {hint ? <p className="mt-0.5 mb-1 text-[11.5px] text-[#6E747A]">{hint}</p> : null}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
      />
    </div>
  );
}

export function CheckField({
  field,
  label,
  checked,
  onChange,
}: {
  field: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-[12.5px] text-[#E6E8EA]">
      <input
        type="checkbox"
        name={field}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#C9A227]"
      />
      <span>{label}</span>
    </label>
  );
}

export function ChoiceField({
  idPrefix,
  field,
  label,
  options,
  value,
  onChange,
}: {
  idPrefix: string;
  field: string;
  label: string;
  /** `[value, label]`, already translated by the caller. */
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string | null) => void;
}) {
  const id = `${idPrefix}-${field}`;
  return (
    <div>
      <label htmlFor={id} className="text-[12.5px] font-medium text-[#E6E8EA]">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
      >
        <option value="">—</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
}
