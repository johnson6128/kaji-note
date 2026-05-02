import { create } from 'zustand';

interface ExecutionState {
  activeNoteId: string | null;
  currentStepIndex: number;
  completedStepIds: string[];
  startExecution: (noteId: string) => void;
  markStepComplete: (stepId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitExecution: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  activeNoteId: null,
  currentStepIndex: 0,
  completedStepIds: [],

  startExecution: (noteId) =>
    set({ activeNoteId: noteId, currentStepIndex: 0, completedStepIds: [] }),

  markStepComplete: (stepId) =>
    set((state) => ({
      completedStepIds: state.completedStepIds.includes(stepId)
        ? state.completedStepIds
        : [...state.completedStepIds, stepId],
    })),

  nextStep: () =>
    set((state) => ({ currentStepIndex: state.currentStepIndex + 1 })),

  prevStep: () =>
    set((state) => ({
      currentStepIndex: Math.max(0, state.currentStepIndex - 1),
    })),

  exitExecution: () =>
    set({ activeNoteId: null, currentStepIndex: 0, completedStepIds: [] }),
}));
