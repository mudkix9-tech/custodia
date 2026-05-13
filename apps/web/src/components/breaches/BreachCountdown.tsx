import React, { useEffect, useState } from 'react';

export default function BreachCountdown({ deadline, status, notifiedAt }: { deadline: string | Date, status: string, notifiedAt?: string | Date | null }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    // If closed or already notified, we stop counting down towards failure
    if (status === 'closed' || status === 'notified') {
      return;
    }

    const calculateTimeLeft = () => {
      const difference = new Date(deadline).getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          hours: Math.floor((difference / (1000 * 60 * 60))),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          expired: false
        });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [deadline, status]);

  if (status === 'notified') {
    return (
      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Notified Authority</p>
        <p className="text-sm font-medium text-green-900 dark:text-green-100">{new Date(notifiedAt!).toLocaleString()}</p>
      </div>
    );
  }

  if (status === 'closed') {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Case Closed</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 text-center border ${timeLeft.expired ? 'bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-800' : 'bg-red-600 border-red-700 text-white shadow-inner'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${timeLeft.expired ? 'text-red-700 dark:text-red-400' : 'text-red-100'}`}>
        {timeLeft.expired ? '⚠️ Deadline Passed' : 'Notification Deadline'}
      </p>
      <div className={`font-mono text-xl font-bold flex gap-1 justify-center ${timeLeft.expired ? 'text-red-800 dark:text-red-300' : 'text-white'}`}>
        <div className="flex flex-col">
          <span>{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="text-[10px] font-sans opacity-70 leading-none">HRS</span>
        </div>
        <span>:</span>
        <div className="flex flex-col">
          <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="text-[10px] font-sans opacity-70 leading-none">MIN</span>
        </div>
        <span>:</span>
        <div className="flex flex-col">
          <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="text-[10px] font-sans opacity-70 leading-none">SEC</span>
        </div>
      </div>
    </div>
  );
}
