import React from 'react';

export function OnboardingProgress({ currentStep, totalSteps = 6 }: { currentStep: number; totalSteps?: number }) {
  return (
    <div className="mb-8 w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-500">Step {currentStep} of {totalSteps}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
}
