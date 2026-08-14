import React from 'react';
import { Check } from 'lucide-react';

/**
 * First branded moment of the product. It was Tailwind's default `blue-600` on
 * `gray-200` — a colour that appears nowhere else in Custodia — and said only
 * "Step 3 of 6", so a customer part-way through could not tell what was left or
 * how long it would take.
 */
const STEP_NAMES = [
  'Organisation',
  'Tools',
  'Activities',
  'Policy',
  'Team',
  'Done',
];

export function OnboardingProgress({
  currentStep,
  totalSteps = 6,
}: {
  currentStep: number;
  totalSteps?: number;
}) {
  const names = STEP_NAMES.slice(0, totalSteps);
  const pct = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));
  const remaining = Math.max(0, totalSteps - currentStep);

  return (
    <div className="mx-auto mb-2 w-full max-w-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[#E6E8EA]">
          Step {currentStep} of {totalSteps}
          <span className="text-[#6E747A]"> · {names[currentStep - 1] ?? ''}</span>
        </span>
        {remaining > 0 && (
          <span className="text-xs text-[#6E747A]">About {remaining * 2} min left</span>
        )}
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Onboarding step ${currentStep} of ${totalSteps}`}
      >
        <div
          className="h-2 rounded-full bg-[#C9A227] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step names, so the remaining work is visible rather than a bare fraction. */}
      <ol className="mt-2.5 hidden justify-between sm:flex">
        {names.map((name, i) => {
          const step = i + 1;
          const done = step < currentStep;
          const current = step === currentStep;
          return (
            <li
              key={name}
              aria-current={current ? 'step' : undefined}
              className={`flex items-center gap-1 text-[11px] ${
                current ? 'font-medium text-[#C9A227]' : done ? 'text-[#9BA1A6]' : 'text-[#6E747A]'
              }`}
            >
              {done && <Check className="h-3 w-3" />}
              {name}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
