import React from 'react';

interface ComplianceScoreDialProps {
  score: number;
}

export function ComplianceScoreDial({ score }: ComplianceScoreDialProps) {
  // SVG Gauge calculations
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  let colorClass = 'text-red-500';
  if (score >= 50) colorClass = 'text-amber-500';
  if (score >= 80) colorClass = 'text-sage-500';

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            className="text-bone-200 stroke-current"
            strokeWidth="12"
            fill="transparent"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            className={`${colorClass} stroke-current transition-all duration-1000 ease-out`}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-serif text-ink-900">{score}</span>
          <span className="text-xs font-medium text-ink-500 uppercase tracking-widest mt-1">Score</span>
        </div>
      </div>
      <div className="mt-4 text-sm text-ink-600 text-center max-w-[200px]">
        {score >= 80 ? 'Excellent posture. Audit ready.' : score >= 50 ? 'Fair posture. Action required.' : 'Poor posture. High risk.'}
      </div>
    </div>
  );
}
