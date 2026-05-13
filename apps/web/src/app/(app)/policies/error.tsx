"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Module Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 min-h-[400px]">
      <div className="bg-red-50 text-red-800 p-6 rounded-2xl max-w-md w-full border border-red-100 flex flex-col items-center text-center">
        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
        <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-red-600 mb-6">
          We encountered an error loading the Policy Manager section.
        </p>
        <button
          onClick={() => reset()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
