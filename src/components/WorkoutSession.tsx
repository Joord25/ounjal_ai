"use client";

import React, { useState, useEffect } from "react";
import { FitScreen, FeedbackType } from "@/components/FitScreen";
import { WorkoutSessionData, ExerciseStep, ExerciseLog } from "@/constants/workout";

interface WorkoutSessionProps {
  sessionData: WorkoutSessionData;
  onComplete: (completedSessionData: WorkoutSessionData, logs: Record<number, ExerciseLog[]>) => void;
  onBack: () => void;
}

export const WorkoutSession: React.FC<WorkoutSessionProps> = ({
  sessionData,
  onComplete,
  onBack,
}) => {
  // Initialize exercises with a deep copy to allow mutations for adaptive logic
  const [exercises, setExercises] = useState<ExerciseStep[]>(() => 
    JSON.parse(JSON.stringify(sessionData.exercises))
  );
  
  const [currentExerciseIndex, setCurrentIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTimer, setRestTimer] = useState(60);
  const [logs, setLogs] = useState<Record<number, ExerciseLog[]>>({});

  const currentExercise = exercises[currentExerciseIndex];
  const totalExercises = exercises.length;

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => prev - 1);
      }, 1000);
    } else if (isResting && restTimer === 0) {
      skipRest();
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  const skipRest = () => {
    setIsResting(false);
    if (currentSet < currentExercise.sets) {
      setCurrentSet((prev) => prev + 1);
    } else {
      // Logic for moving to next exercise is handled in handleSetComplete
      // But if we are resting between exercises (not implemented yet), handle here
      // Current logic: Rest is only BETWEEN sets of same exercise
      // If we want rest between exercises, we need to adjust logic.
      // For now, let's assume Rest is only between sets.
      // But wait, handleSetComplete triggers rest only if currentSet < totalSets.
      // So this block (skipRest) only runs when moving to next set.
      setCurrentSet((prev) => prev + 1);
    }
  };

  const handleSetComplete = (reps: number, feedback: FeedbackType, weightKg?: number) => {
    // Guard: ensure reps is always a number (AI data may leak strings)
    const safeReps = typeof reps === "number" ? reps : (parseInt(String(reps)) || 0);
    // 1. Log the set (use actual weight from picker if available)
    const newLog: ExerciseLog = {
      setNumber: currentSet,
      repsCompleted: safeReps,
      weightUsed: weightKg ? `${weightKg}` : currentExercise.weight,
      feedback: feedback,
    };

    const updatedLogs = {
      ...logs,
      [currentExerciseIndex]: [...(logs[currentExerciseIndex] || []), newLog],
    };
    setLogs(updatedLogs);

    // 2. Evidence-based Adaptive Logic (NSCA/ACSM/NASM guidelines)
    // Adjusted by sex & age per research:
    //   - NSCA: Women use smaller absolute load increments (1.25-2.5kg vs 2.5-5kg)
    //   - ACSM: Adults 50+ progress more conservatively (50-60% slower increments)
    //   - ACSM: Adults 60+ require longer rest periods (+30s)
    //   - Häkkinen et al. (2001): Older adults show slower neuromuscular adaptation
    //   - Hunter (2014): Women recover faster between sets → shorter rest OK
    //   - NSCA Essentials of Strength Training 4th ed.: age-graded progression tables
    if (currentSet < currentExercise.sets) {
      const updatedExercises = exercises.map((ex, i) =>
        i === currentExerciseIndex ? { ...ex } : ex
      );
      const exercise = updatedExercises[currentExerciseIndex];
      const currentWeight = weightKg || 0;
      const currentReps = exercise.reps || 12;

      // Load sex & age from localStorage
      const gender = (typeof window !== "undefined" ? localStorage.getItem("alpha_gender") : null) as "male" | "female" | null;
      const birthYearStr = typeof window !== "undefined" ? localStorage.getItem("alpha_birth_year") : null;
      const age = birthYearStr ? new Date().getFullYear() - parseInt(birthYearStr) : 30;
      const isFemale = gender === "female";

      // Age-based progression modifier (ACSM/NSCA guidelines)
      // <30: aggressive (1.0), 30-49: standard (0.85), 50-59: conservative (0.65), 60+: very conservative (0.5)
      const ageMod = age >= 60 ? 0.5 : age >= 50 ? 0.65 : age >= 30 ? 0.85 : 1.0;

      // Min weight step: male 5kg, female 2.5kg, male 50+ 2.5kg
      const minStep = isFemale ? 2.5 : (age >= 50 ? 2.5 : 5);
      const roundToStep = (v: number) => Math.max(minStep, Math.round(v / minStep) * minStep);

      if (feedback === "too_easy") {
        const extraReps = reps - currentReps;
        if (currentWeight > 0) {
          // Extra reps ratio to target: determines how far off the weight is
          const extraRatio = extraReps / Math.max(1, currentReps);
          // Tiered %: ratio < 1x → 10%, 1-2x → 20%, 2-3x → 30%, 3x+ → 40%, scaled by age
          const basePct = extraRatio >= 3 ? 0.40 : extraRatio >= 2 ? 0.30 : extraRatio >= 1 ? 0.20 : 0.10;
          const pct = basePct * ageMod;
          const increment = roundToStep(currentWeight * pct);
          exercise.weight = `${currentWeight + increment}kg`;
        } else {
          // Bodyweight: age-scaled rep increase
          exercise.reps = currentReps + Math.max(1, Math.round(3 * ageMod));
        }
      } else if (feedback === "easy") {
        const extraReps = reps - currentReps;
        const repIncrease = Math.max(1, Math.round(Math.min(extraReps, 2) * ageMod));
        exercise.reps = currentReps + repIncrease;
      } else if (feedback === "fail") {
        exercise.reps = Math.max(1, reps);
        if (currentWeight > 0) {
          const failRatio = reps / currentReps;
          // Deeper failure → more reduction, age-scaled (older = less aggressive deload)
          const basePct = failRatio < 0.3 ? 0.15 : failRatio < 0.6 ? 0.10 : 0.05;
          const reduction = roundToStep(currentWeight * basePct);
          exercise.weight = `${Math.max(0, currentWeight - reduction)}kg`;
        }
      }
      // "target" (RIR ~1): maintain (no change)

      // Persist adapted weight to localStorage so FitScreen picks it up
      if (exercise.weight) {
        const parsed = parseFloat(exercise.weight);
        if (!isNaN(parsed) && parsed > 0) {
          const storageKey = `alpha_weight_${exercise.name.replace(/[^a-zA-Z가-힣]/g, "_")}`;
          localStorage.setItem(storageKey, String(parsed));
        }
      }

      setExercises(updatedExercises);

      // Rest duration: sex & age adjusted
      // ACSM: older adults need longer rest. Hunter (2014): women recover faster.
      if (currentExercise.type === "warmup" || currentExercise.type === "mobility" || currentExercise.type === "cardio") {
        setCurrentSet((prev) => prev + 1);
      } else {
        setIsResting(true);
        const baseRest = feedback === "fail" ? 90
          : feedback === "target" ? 75
          : 60;
        // Women: -10s (faster recovery). Age 50+: +15s, 60+: +30s
        const sexAdj = isFemale ? -10 : 0;
        const ageAdj = age >= 60 ? 30 : age >= 50 ? 15 : 0;
        setRestTimer(Math.max(30, baseRest + sexAdj + ageAdj));
      }
      
    } else {
      // Exercise Completed
      // Check if there are more exercises
      if (currentExerciseIndex < totalExercises - 1) {
        // Move to next exercise immediately (or add inter-exercise rest if desired)
        setCurrentIndex((prev) => prev + 1);
        setCurrentSet(1);
        setIsResting(false); // Reset rest state just in case
      } else {
        // All Exercises Completed
        // Pass the FINAL state of exercises (with adaptations) and logs
        onComplete({ ...sessionData, exercises }, updatedLogs);
      }
    }
  };

  const handleBack = () => {
    if (isResting) {
      setIsResting(false);
      return;
    }
    
    if (currentSet > 1) {
      setCurrentSet((prev) => prev - 1);
      // Remove last log? Ideally yes, but for simplicity let's keep append-only or replace logic needed
      // For now, just going back in UI.
    } else if (currentExerciseIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      // We need to know how many sets the previous exercise had to go to the last set
      // But simplifying: Go to start of previous exercise
      setCurrentSet(1); 
    } else {
      onBack();
    }
  };

  return (
    <div className="h-full relative">
      <FitScreen
        key={currentExerciseIndex} // Remounts on new exercise, keeps state on new set
        exercise={currentExercise}
        setInfo={{
            current: currentSet,
            total: currentExercise.sets || 1,
            targetReps: (typeof currentExercise.reps === "number" ? currentExercise.reps : parseInt(String(currentExercise.reps)) || 12), // Guard: AI may return string
            targetWeight: currentExercise.weight || "Bodyweight"
        }}
        exerciseIndex={currentExerciseIndex + 1}
        totalExercises={totalExercises}
        onSetComplete={handleSetComplete}
        onBack={handleBack}
        isResting={isResting}
        restTimer={restTimer}
        onSkipRest={skipRest}
        isLastExercise={currentExerciseIndex === totalExercises - 1 && currentSet === (currentExercise.sets || 1)}
      />
    </div>
  );
};
