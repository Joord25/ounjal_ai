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

  const handleSetComplete = (reps: number, feedback: FeedbackType) => {
    // 1. Log the set
    const newLog: ExerciseLog = {
      setNumber: currentSet,
      repsCompleted: reps,
      weightUsed: currentExercise.weight,
      feedback: feedback,
    };

    const updatedLogs = {
      ...logs,
      [currentExerciseIndex]: [...(logs[currentExerciseIndex] || []), newLog],
    };
    setLogs(updatedLogs);

    // 2. Adaptive Logic: Adjust FUTURE sets for THIS exercise
    // We only adjust if there are remaining sets
    if (currentSet < currentExercise.sets) {
      const updatedExercises = [...exercises];
      const exercise = updatedExercises[currentExerciseIndex];

      if (feedback === "easy") {
        // Increase reps by 2
        exercise.reps = (exercise.reps || reps) + 2;
      } else if (feedback === "too_easy") {
        // Increase reps by 5 (or significantly)
        exercise.reps = (exercise.reps || reps) + 5;
      } else if (feedback === "fail") {
        // Decrease reps to what was actually achieved
        exercise.reps = Math.max(1, reps);
      }
      
      setExercises(updatedExercises);
      
      // Trigger Rest
      // Check if it's a warmup exercise - if so, skip rest
      if (currentExercise.type === "warmup") {
        setCurrentSet((prev) => prev + 1);
      } else {
        setIsResting(true);
        setRestTimer(60); // Standard 60s rest
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
            targetReps: currentExercise.reps || 12, // Fallback
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
