import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  requireTyping?: string;
}

interface DialogState extends ConfirmOptions {
  open: boolean;
  onResolve: (value: boolean) => void;
}

export function ConfirmDialogModal({ state, setState }: { state: DialogState, setState: (state: DialogState) => void }) {
  const [typedValue, setTypedValue] = useState('');

  if (!state.open) return null;

  const handleClose = (confirmed: boolean) => {
    setState({ ...state, open: false });
    state.onResolve(confirmed);
  };

  const isConfirmDisabled = !!(state.requireTyping && typedValue !== state.requireTyping);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-ink-900/10">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn(
              "p-2.5 rounded-full shrink-0",
              state.variant === 'destructive' ? "bg-red-50 text-red-600" : "bg-sage-50 text-sage-600"
            )}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-semibold text-ink-900 leading-none mb-2">{state.title}</h3>
              <p className="text-sm text-ink-600 leading-snug">{state.description}</p>

              {state.requireTyping && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-ink-900 mb-1">
                    Type <span className="font-bold select-all bg-bone-100 px-1 py-0.5 rounded">{state.requireTyping}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={typedValue}
                    onChange={(e) => setTypedValue(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    placeholder={state.requireTyping}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-bone-50 border-t border-ink-900/10 flex items-center justify-end gap-3">
          <button
            onClick={() => handleClose(false)}
            className="px-4 py-2 text-sm font-medium text-ink-700 hover:bg-bone-100 rounded-lg transition-colors"
          >
            {state.cancelText || 'Cancel'}
          </button>
          <button
            onClick={() => handleClose(true)}
            disabled={isConfirmDisabled}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              state.variant === 'destructive'
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-sage-600 text-white hover:bg-sage-700"
            )}
          >
            {state.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<DialogState>({
    open: false,
    title: '',
    description: '',
    onResolve: () => {},
  });

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        open: true,
        onResolve: resolve,
      });
    });
  };

  return {
    confirm,
    dialog: <ConfirmDialogModal state={state} setState={setState} />
  };
}
