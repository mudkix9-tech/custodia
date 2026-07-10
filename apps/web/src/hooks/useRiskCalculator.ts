import { useState, useEffect } from 'react';
import { CalculatorQuestion } from '@/types/marketing';

export function useRiskCalculator(questions: CalculatorQuestion[]) {
  const [calcStep, setCalcStep] = useState(0);
  const [calcAnswers, setCalcAnswers] = useState<Record<string, string>>({});
  const [calcScores, setCalcScores] = useState<Record<string, number>>({});
  const [copiedCalculatorLink, setCopiedCalculatorLink] = useState(false);

  // Load from URL/localStorage
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlJurisdiction = params.get('jurisdiction');
      const urlRopa = params.get('ropa');
      const urlCookies = params.get('cookies');
      const urlSpecial = params.get('special');
      const urlResults = params.get('results') === 'true';

      if (urlJurisdiction || urlRopa || urlCookies || urlSpecial) {
        const answers: Record<string, string> = {};
        const scores: Record<string, number> = {};
        
        if (urlJurisdiction) {
          answers.jurisdiction = urlJurisdiction;
          scores.jurisdiction = questions[0].options.find(o => o.value === urlJurisdiction)?.score ?? 0;
        }
        if (urlRopa) {
          answers.ropa = urlRopa;
          scores.ropa = questions[1].options.find(o => o.value === urlRopa)?.score ?? 0;
        }
        if (urlCookies) {
          answers.cookies = urlCookies;
          scores.cookies = questions[2].options.find(o => o.value === urlCookies)?.score ?? 0;
        }
        if (urlSpecial) {
          answers.special = urlSpecial;
          scores.special = questions[3].options.find(o => o.value === urlSpecial)?.score ?? 0;
        }

        setTimeout(() => {
          setCalcAnswers(answers);
          setCalcScores(scores);
          if (urlResults) {
            setCalcStep(questions.length);
          } else {
            setCalcStep(0);
          }
        }, 0);
        return;
      }

      const savedAnswers = localStorage.getItem('pvr_calc_answers');
      const savedScores = localStorage.getItem('pvr_calc_scores');
      const savedStep = localStorage.getItem('pvr_calc_step');
      setTimeout(() => {
        if (savedAnswers) setCalcAnswers(JSON.parse(savedAnswers));
        if (savedScores) setCalcScores(JSON.parse(savedScores));
        if (savedStep) setCalcStep(Number(savedStep));
      }, 0);
    } catch (e) {
      console.error("Failed to load calculator state:", e);
    }
  }, [questions]);

  // Sync to localStorage
  useEffect(() => {
    if (Object.keys(calcAnswers).length > 0) {
      try {
        localStorage.setItem('pvr_calc_answers', JSON.stringify(calcAnswers));
        localStorage.setItem('pvr_calc_scores', JSON.stringify(calcScores));
        localStorage.setItem('pvr_calc_step', String(calcStep));
      } catch (e) {
        console.error("Failed to save calculator state:", e);
      }
    }
  }, [calcAnswers, calcScores, calcStep]);

  const handleCalculatorSelect = (questionId: string, value: string, score: number) => {
    setCalcAnswers(prev => ({ ...prev, [questionId]: value }));
    setCalcScores(prev => ({ ...prev, [questionId]: score }));
    
    if (calcStep < questions.length - 1) {
      setCalcStep(prev => prev + 1);
    } else {
      setCalcStep(questions.length);
    }
  };

  const resetCalculator = () => {
    setCalcAnswers({});
    setCalcScores({});
    setCalcStep(0);
    try {
      localStorage.removeItem('pvr_calc_answers');
      localStorage.removeItem('pvr_calc_scores');
      localStorage.removeItem('pvr_calc_step');
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }
  };

  const handleCopyCalculatorLink = () => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?jurisdiction=${calcAnswers.jurisdiction || ''}&ropa=${calcAnswers.ropa || ''}&cookies=${calcAnswers.cookies || ''}&special=${calcAnswers.special || ''}&results=true`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedCalculatorLink(true);
      setTimeout(() => setCopiedCalculatorLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const totalRiskScore = Object.values(calcScores).reduce((a, b) => a + b, 0);
  let riskLevel = 'LOW';
  let riskColor = 'text-[#8BA381] border-[#384332] bg-[#242A20]/80';
  let riskText = 'Your operations indicate low regulatory exposure. Maintain compliance audits regularly to avoid gap drifts.';

  if (totalRiskScore >= 75) {
    riskLevel = 'CRITICAL';
    riskColor = 'text-red-400 border-red-950 bg-red-950/20';
    riskText = 'Extreme regulatory liability detected. Missing processing activity records combined with unconsented tracking poses direct exposure to severe administrative fines.';
  } else if (totalRiskScore >= 45) {
    riskLevel = 'HIGH';
    riskColor = 'text-amber-500 border-amber-950 bg-amber-950/20';
    riskText = 'Significant compliance gaps detected. Lack of active consent logging or outdated static documentation exposes your agency and clients to audit failures.';
  } else if (totalRiskScore >= 20) {
    riskLevel = 'MEDIUM';
    riskColor = 'text-[#C9C3AC] border-[#444034] bg-[#2A2920]/80';
    riskText = 'Moderate exposure. Some compliance elements exist, but lack of continuous validation indicates potential compliance degradation.';
  }

  const prefillUrl = `/assessment?jurisdiction=${calcAnswers.jurisdiction || ''}&ropa=${calcAnswers.ropa || ''}&cookies=${calcAnswers.cookies || ''}&special=${calcAnswers.special || ''}&risk=${riskLevel.toLowerCase()}`;

  return {
    calcStep,
    setCalcStep,
    calcAnswers,
    calcScores,
    copiedCalculatorLink,
    handleCalculatorSelect,
    resetCalculator,
    handleCopyCalculatorLink,
    totalRiskScore,
    riskLevel,
    riskColor,
    riskText,
    prefillUrl,
  };
}
