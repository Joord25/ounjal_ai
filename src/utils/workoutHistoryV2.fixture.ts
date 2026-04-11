/**
 * transformToNewSchema 단위 검증용 픽스처 (회의 52, 트랙 C Step 3).
 *
 * 출처: 대표님이 회의 52에서 보여주신 실제 Firestore 문서
 *   users/0cFhit3CMnSdb7E3rKCYLiIFZo63/workout_history/1775586415319
 *
 * 마스킹: uid는 "test_user_01"로 대체, 그 외 필드는 실제 값 보존.
 * 이 픽스처는 **의도적으로 오염 데이터**를 포함함:
 *   - totalDurationSec: 79초
 *   - totalReps: 303회
 *   - 물리적으로 불가능 (36세트 × 5초 = 180초 필요, 79초는 too_short)
 *   - exercises 0~3(warmup), 9~11(core/cardio)의 실측 duration이 1~2초
 *   - → dataQuality.isValid === false, reasons: ["duration_too_short"] 검증 대상
 */

import type { WorkoutHistory } from "@/constants/workout";

export const FIXTURE_HISTORY_01: WorkoutHistory = {
  id: "1775586415319",
  date: "2026-04-07T18:26:55.319Z",

  sessionData: {
    title: "가슴 집중 운동",
    description: "가슴 5종 · 5세트",
    intendedIntensity: "moderate",
    exercises: [
      // warmup 4종
      { type: "warmup", phase: "warmup", name: "월 슬라이드 (Wall Slides)", count: "1분", sets: 1, reps: 1 },
      { type: "warmup", phase: "warmup", name: "고양이-낙타 자세 (Cat-Cow Pose)", count: "1분", sets: 1, reps: 1 },
      { type: "warmup", phase: "warmup", name: "숄더 CARs (Shoulder CARs)", count: "1분", sets: 1, reps: 1 },
      { type: "warmup", phase: "warmup", name: "앞벅지 스트레치 (Hip Flexor Stretch)", count: "1분", sets: 1, reps: 1 },
      // main 5종
      {
        type: "strength", phase: "main",
        name: "디클라인 벤치 프레스 (Decline Bench Press)",
        count: "5세트 / 8회", sets: 5, reps: 8,
        weight: "10회가 힘든 무게",
        tempoGuide: "천천히 내리기 3초",
      },
      {
        type: "strength", phase: "main",
        name: "인클라인 덤벨 플라이 (Incline Dumbbell Fly)",
        count: "5세트 / 8회", sets: 5, reps: 8,
        weight: "12-15회 가능한 무게",
        tempoGuide: "천천히 내리기 3초",
      },
      {
        type: "strength", phase: "main",
        name: "케이블 크로스오버 (Cable Crossover)",
        count: "5세트 / 12회", sets: 5, reps: 12,
        weight: "12-15회 가능한 무게",
        tempoGuide: "천천히 내리기 3초",
      },
      {
        type: "strength", phase: "main",
        name: "바텀스업 케틀벨 프레스 (Bottoms-Up Kettlebell Press)",
        count: "5세트 / 8회", sets: 5, reps: 8,
        weight: "12-15회 가능한 무게",
        tempoGuide: "천천히 내리기 3초",
      },
      {
        type: "strength", phase: "main",
        name: "푸쉬업 (Push-ups)",
        count: "5세트 / 12회", sets: 5, reps: 12,
        weight: "가볍게 반복 가능한 무게",
        tempoGuide: "천천히 내리기 3초",
      },
      // core 2종
      { type: "core", phase: "core", name: "웨이티드 플랭크 (Weighted Plank)", count: "3세트 / 1회", sets: 3, reps: 1 },
      { type: "core", phase: "core", name: "싱글 레그 레이즈 (Single Leg Raise)", count: "3세트 / 20회", sets: 3, reps: 20 },
      // cardio 1종
      { type: "cardio", phase: "cardio", name: "추가 유산소: 조깅 (Jogging)", count: "15-20분", sets: 1, reps: 1 },
    ],
  },

  logs: {
    0: [{ feedback: "target", repsCompleted: 1, setNumber: 1 }],
    1: [{ feedback: "target", repsCompleted: 1, setNumber: 1 }],
    2: [{ feedback: "target", repsCompleted: 1, setNumber: 1 }],
    3: [{ feedback: "target", repsCompleted: 1, setNumber: 1 }],
    4: [
      { feedback: "target", repsCompleted: 8, setNumber: 1, weightUsed: "10" },
      { feedback: "target", repsCompleted: 8, setNumber: 2, weightUsed: "10" },
      { feedback: "target", repsCompleted: 8, setNumber: 3, weightUsed: "10" },
      { feedback: "target", repsCompleted: 8, setNumber: 4, weightUsed: "10" },
      { feedback: "target", repsCompleted: 8, setNumber: 5, weightUsed: "10" },
    ],
    5: [
      { feedback: "target", repsCompleted: 8, setNumber: 1, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 2, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 3, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 4, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 5, weightUsed: "12" },
    ],
    6: [
      { feedback: "target", repsCompleted: 12, setNumber: 1, weightUsed: "12" },
      { feedback: "target", repsCompleted: 12, setNumber: 2, weightUsed: "12" },
      { feedback: "target", repsCompleted: 12, setNumber: 3, weightUsed: "12" },
      { feedback: "target", repsCompleted: 12, setNumber: 4, weightUsed: "12" },
      { feedback: "target", repsCompleted: 12, setNumber: 5, weightUsed: "12" },
    ],
    7: [
      { feedback: "target", repsCompleted: 8, setNumber: 1, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 2, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 3, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 4, weightUsed: "12" },
      { feedback: "target", repsCompleted: 8, setNumber: 5, weightUsed: "12" },
    ],
    8: [
      { feedback: "target", repsCompleted: 12, setNumber: 1, weightUsed: "가볍게 반복 가능한 무게" },
      { feedback: "target", repsCompleted: 12, setNumber: 2, weightUsed: "가볍게 반복 가능한 무게" },
      { feedback: "target", repsCompleted: 12, setNumber: 3, weightUsed: "가볍게 반복 가능한 무게" },
      { feedback: "target", repsCompleted: 12, setNumber: 4, weightUsed: "가볍게 반복 가능한 무게" },
      { feedback: "target", repsCompleted: 12, setNumber: 5, weightUsed: "가볍게 반복 가능한 무게" },
    ],
    9: [
      { feedback: "target", repsCompleted: 1, setNumber: 1 },
      { feedback: "target", repsCompleted: 1, setNumber: 2 },
      { feedback: "target", repsCompleted: 1, setNumber: 3 },
    ],
    10: [
      { feedback: "target", repsCompleted: 20, setNumber: 1 },
      { feedback: "target", repsCompleted: 20, setNumber: 2 },
      { feedback: "target", repsCompleted: 20, setNumber: 3 },
    ],
    11: [{ feedback: "target", repsCompleted: 1, setNumber: 1 }],
  },

  stats: {
    totalVolume: 2080,
    totalSets: 36,
    totalReps: 303,
    totalDurationSec: 79,   // ⚠️ 오염: 36세트 × 5초 = 180초 필요
    bestE1RM: 12.666666666666666,
    loadScore: 2080,
    successRate: 100,
  },

  exerciseTimings: [
    { exerciseIndex: 0,  startedAt: 1775586336721, endedAt: 1775586349768, durationSec: 13 },
    { exerciseIndex: 1,  startedAt: 1775586349768, endedAt: 1775586352089, durationSec: 2 },
    { exerciseIndex: 2,  startedAt: 1775586352089, endedAt: 1775586353465, durationSec: 1 },
    { exerciseIndex: 3,  startedAt: 1775586353465, endedAt: 1775586354703, durationSec: 1 },
    { exerciseIndex: 4,  startedAt: 1775586354703, endedAt: 1775586373995, durationSec: 19 },
    { exerciseIndex: 5,  startedAt: 1775586373995, endedAt: 1775586379872, durationSec: 6 },
    { exerciseIndex: 6,  startedAt: 1775586379872, endedAt: 1775586385165, durationSec: 5 },
    { exerciseIndex: 7,  startedAt: 1775586385165, endedAt: 1775586408626, durationSec: 23 },
    { exerciseIndex: 8,  startedAt: 1775586408626, endedAt: 1775586409909, durationSec: 1 },
    { exerciseIndex: 9,  startedAt: 1775586409909, endedAt: 1775586410755, durationSec: 1 },
    { exerciseIndex: 10, startedAt: 1775586410755, endedAt: 1775586411742, durationSec: 1 },
    { exerciseIndex: 11, startedAt: 1775586411742, endedAt: 1775586413043, durationSec: 1 },
  ],

  reportTabs: {
    status: {
      percentiles: [],
      overallRank: 0,
      fitnessAge: 0,
      ageGroupLabel: "",
      genderLabel: "",
    },
    today: {
      volumeChangePercent: null,
      caloriesBurned: 7,
      foodAnalogy: "",
      recoveryHours: "12",
      stimulusMessage: "",
    },
    next: {
      message: "",
      recommendedPart: "",
      recommendedIntensity: "",
      questProgress: {
        high:     { done: 0, target: 2 },
        moderate: { done: 2, target: 2 },
        low:      { done: 0, target: 1 },
        total:    { done: 2, target: 5 },
      },
    },
    nutrition: {
      dailyCalorie: 2258,
      goalBasis: "건강 목표",
      macros: { protein: 112, carb: 311, fat: 63 },
      meals: [
        { time: "아침", menu: "오트밀 + 프로틴 1스쿱 + 저지방 우유 + 견과류 한 줌" },
        { time: "점심", menu: "현미밥 (1.5공기) + 닭가슴살 150g + 신선한 채소 샐러드 (올리브유 드레싱)" },
        { time: "간식", menu: "고구마 150g + 삶은 계란 2개" },
        { time: "저녁", menu: "잡곡밥 (1공기) + 소고기 150g (우둔살/홍두깨살) + 쌈채소" },
      ],
      keyTip: "단백질만 맞추면 나머지는 유동적으로 OK",
    },
  },
};
