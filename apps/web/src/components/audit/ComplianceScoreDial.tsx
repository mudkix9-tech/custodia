import React from 'react';
import { formatScore, scoreBand, scoreStrokeClasses } from '@/utils/score';

interface ComplianceScoreDialProps {
  /** null when the organisation has never had a compliance report generated. */
  score: number | null;
}

const VERDICT: Record<ReturnType<typeof scoreBand>, string> = {
  strong:     'Excellent posture. Audit ready.',
  fair:       'Fair posture. Action required.',
  weak:       'Poor posture. High risk.',
  unassessed: 'Not yet assessed. Run an assessment to get your score.',
};

export function ComplianceScoreDial({ score }: ComplianceScoreDialProps) {
  const band = scoreBand(score);

  // SVG Gauge calculations
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // An unassessed account draws no arc at all. Drawing one at 0 would read as a
  // score of zero, which is a different claim from "we have not measured yet".
  const filled = band === 'unassessed' ? 0 : (score as number) / 100;
  const strokeDashoffset = circumference - filled * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            className="text-white/[0.07] stroke-current"
            strokeWidth="12"
            fill="transparent"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            className={`${scoreStrokeClasses(score)} stroke-current transition-all duration-1000 ease-out`}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-serif ${band === 'unassessed' ? 'text-[#6E747A]' : 'text-[#F4F5F6]'}`}>
            {formatScore(score)}
          </span>
          <span className="text-xs font-medium text-[#6E747A] uppercase tracking-widest mt-1">Score</span>
        </div>
      </div>
      <div className="mt-4 text-sm text-[#9BA1A6] text-center max-w-[200px]">
        {VERDICT[band]}
      </div>
    </div>
  );
}
