import { create } from 'zustand';
import { GuidanceContext } from '@/types/aiGuidance';

interface AiGuidanceState {
  isOpen: boolean;
  context: GuidanceContext;
  chatHistory: { role: 'user' | 'assistant'; content: string; sources?: any[] }[];
  onApplyField: ((field: string, value: any) => void) | null;
  
  setContext: (context: GuidanceContext) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  resetChat: () => void;
  addChatMessage: (msg: { role: 'user' | 'assistant'; content: string; sources?: any[] }) => void;
  
  registerApplyCallback: (cb: (field: string, value: any) => void) => void;
  unregisterApplyCallback: () => void;
  applyField: (field: string, value: any) => void;
}

export const useAiGuidanceStore = create<AiGuidanceState>((set, get) => ({
  isOpen: false,
  context: null,
  chatHistory: [],
  onApplyField: null,
  
  setContext: (newContext) => {
    const currentContext = get().context;
    
    // Only reset chat history if the module or entityId actually changed.
    const isSameModule = currentContext?.module === newContext?.module;
    const isSameEntity = currentContext?.entityId === newContext?.entityId;
    
    if (isSameModule && isSameEntity) {
      set({ context: newContext });
    } else {
      set({ context: newContext, chatHistory: [] });
    }
  },
  
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  resetChat: () => set({ chatHistory: [] }),
  addChatMessage: (msg) => set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
  
  registerApplyCallback: (cb) => set({ onApplyField: cb }),
  unregisterApplyCallback: () => set({ onApplyField: null }),
  applyField: (field, value) => {
    const cb = get().onApplyField;
    if (cb) cb(field, value);
  },
}));
