import { useCallback } from "react";
import { ExerciseStep } from "@/constants/workout";

type SetterFn = React.Dispatch<React.SetStateAction<ExerciseStep[]>>;
type RebuildCount = (ex: ExerciseStep) => string;

/**
 * 마스터 플랜 세트 편집 상태 리듀서.
 * adjustSets / updateSetDetail / addSet / removeSet 네 가지를 제공.
 * rebuildCount 주입으로 locale/t 의존성을 호출측에 위임 (순수 함수 유지).
 */
export function useSetEditor(setLocalExercises: SetterFn, rebuildCount: RebuildCount) {
  const adjustSets = useCallback((exerciseIdx: number, delta: number) => {
    setLocalExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIdx) return ex;
      const newSets = Math.max(1, Math.min(10, ex.sets + delta));
      if (newSets === ex.sets) return ex;
      const updated = { ...ex, sets: newSets };
      updated.count = rebuildCount(updated);
      return updated;
    }));
  }, [setLocalExercises, rebuildCount]);

  const updateSetDetail = useCallback((exerciseIdx: number, setIdx: number, patch: { reps?: number; weight?: string }) => {
    setLocalExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIdx) return ex;
      const current = ex.setDetails && ex.setDetails.length > 0
        ? [...ex.setDetails]
        : Array.from({ length: Math.max(1, ex.sets) }, () => ({ reps: ex.reps, weight: ex.weight }));
      while (current.length < ex.sets) current.push({ reps: ex.reps, weight: ex.weight });
      if (setIdx < 0 || setIdx >= current.length) return ex;
      current[setIdx] = { ...current[setIdx], ...patch };
      return { ...ex, setDetails: current };
    }));
  }, [setLocalExercises]);

  const addSet = useCallback((exerciseIdx: number) => {
    setLocalExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIdx) return ex;
      const newSets = Math.min(10, ex.sets + 1);
      if (newSets === ex.sets) return ex;
      const current = ex.setDetails && ex.setDetails.length > 0
        ? [...ex.setDetails]
        : Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weight: ex.weight }));
      const last = current[current.length - 1] || { reps: ex.reps, weight: ex.weight };
      current.push({ ...last });
      const updated = { ...ex, sets: newSets, setDetails: current };
      updated.count = rebuildCount(updated);
      return updated;
    }));
  }, [setLocalExercises, rebuildCount]);

  const removeSet = useCallback((exerciseIdx: number, setIdx: number) => {
    setLocalExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIdx) return ex;
      if (ex.sets <= 1) return ex;
      const current = ex.setDetails && ex.setDetails.length > 0
        ? [...ex.setDetails]
        : Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weight: ex.weight }));
      if (setIdx < 0 || setIdx >= current.length) return ex;
      current.splice(setIdx, 1);
      const updated = { ...ex, sets: current.length, setDetails: current };
      updated.count = rebuildCount(updated);
      return updated;
    }));
  }, [setLocalExercises, rebuildCount]);

  return { adjustSets, updateSetDetail, addSet, removeSet };
}
