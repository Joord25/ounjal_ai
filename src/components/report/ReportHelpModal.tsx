"use client";

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { TIERS } from "@/utils/questSystem";

interface ReportHelpModalProps {
  helpCard: string;
  onClose: () => void;
  gender?: "male" | "female";
  loadRatio: number | null;
  levelLabel: string;
}

export const ReportHelpModal: React.FC<ReportHelpModalProps> = ({ helpCard, onClose, gender, loadRatio, levelLabel }) => {
  const { t, locale } = useTranslation();

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl z-50 max-h-[85vh] flex flex-col" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 shrink-0" />
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {helpCard === "topLift" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "예상 최고 중량(1RM)" : "Estimated 1-Rep Max (1RM)"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>오늘 운동 기록으로 <span className="font-bold text-[#1B4332]">내가 1회 최대로 들 수 있는 무게(1RM)</span>를 추정하고, 체중 대비 몇 배인지 보여줘요.</> : <>Based on today&apos;s workout, we estimate <span className="font-bold text-[#1B4332]">the maximum weight you can lift for 1 rep (1RM)</span> and show how it compares to your body weight.</>}</p>
                <p>{locale === "ko" ? <>예를 들어 <span className="font-bold">1.1배</span>면 체중의 1.1배를 들 수 있다는 뜻이에요.</> : <>For example, <span className="font-bold">1.1x</span> means you can lift 1.1 times your body weight.</>}</p>
                <p>{locale === "ko" ? <>▶ 버튼으로 <span className="font-bold">4대 운동</span>(스쿼트 · 데드리프트 · 벤치프레스 · 오버헤드프레스)의 기록을 넘겨볼 수 있어요.</> : <>Use the ▶ button to browse your <span className="font-bold">Big 4 lifts</span> (Squat, Deadlift, Bench Press, Overhead Press).</>}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? <>체중 대비 기준 ({gender === "female" ? "여성" : "남성"} · 벤치프레스 기준)</> : <>BW Ratio Standards ({gender === "female" ? "Female" : "Male"} · Bench Press)</>}</p>
                  {gender === "female" ? (
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">{locale === "ko" ? "~0.5배 초급" : "~0.5x Beginner"}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">{locale === "ko" ? "0.5~0.8배 중급" : "0.5–0.8x Intermediate"}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{locale === "ko" ? "0.8배+ 상급" : "0.8x+ Advanced"}</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">{locale === "ko" ? "~0.8배 초급" : "~0.8x Beginner"}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">{locale === "ko" ? "0.8~1.2배 중급" : "0.8–1.2x Intermediate"}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{locale === "ko" ? "1.2배+ 상급" : "1.2x+ Advanced"}</span>
                    </div>
                  )}
                </div>
                <p>{locale === "ko" ? <><span className="font-bold">1RM</span>은 오늘 세트 기록(무게 x 횟수)에서 Epley 공식으로 추정한 값이에요. 실제 1회 최대 시도 없이도 내 근력 수준을 알 수 있어요.</> : <><span className="font-bold">1RM</span> is estimated from today&apos;s sets (weight x reps) using the Epley formula. You can gauge your strength level without actually attempting a max lift.</>}</p>
                <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">{locale === "ko" ? "근거: NSCA Essentials of S&C (4th ed.), Epley (1985)" : "Source: NSCA Essentials of S&C (4th ed.), Epley (1985)"}</p>
              </div>
            </>
          )}
          {helpCard === "loadStatus" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "부하 상태" : "Load Status"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>오늘 운동량이 <span className="font-bold text-[#1B4332]">내 레벨에 맞는 적정 볼륨인지</span> 보여줘요.</> : <>Shows whether today&apos;s volume is <span className="font-bold text-[#1B4332]">appropriate for your level</span>.</>}</p>
                <p>{locale === "ko" ? <>오늘 부하는 최근 4주 평균 대비 <span className="font-bold text-[#1B4332]">{loadRatio !== null ? `${loadRatio >= 1 ? "+" : ""}${Math.round((loadRatio - 1) * 100)}%` : "-"}</span>예요. 0%면 평균과 같은 양이고, 현재 레벨(<span className="font-bold">{levelLabel}</span>)에 맞는 기준으로 판정해요.</> : <>Today&apos;s load is <span className="font-bold text-[#1B4332]">{loadRatio !== null ? `${loadRatio >= 1 ? "+" : ""}${Math.round((loadRatio - 1) * 100)}%` : "-"}</span> compared to your 4-week average. 0% means the same as average, judged against your current level (<span className="font-bold">{levelLabel}</span>).</>}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? `볼륨 구간 안내 (${levelLabel})` : `Volume Zones (${levelLabel})`}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded shrink-0">{locale === "ko" ? "볼륨 부족" : "Under"}</span>
                      <span className="text-[10px] text-gray-500">{locale === "ko" ? "성장에 필요한 최소 자극에 못 미쳐요" : "Below the minimum stimulus needed for growth"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded shrink-0">{locale === "ko" ? "성장 구간" : "Growth Zone"}</span>
                      <span className="text-[10px] text-gray-500">{locale === "ko" ? "근성장에 가장 좋은 볼륨이에요" : "Optimal volume for muscle growth"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">{locale === "ko" ? "고부하" : "High Load"}</span>
                      <span className="text-[10px] text-gray-500">{locale === "ko" ? "가끔은 괜찮지만 자주 넘으면 주의" : "Okay occasionally, but watch out if frequent"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded shrink-0">{locale === "ko" ? "과부하" : "Overload"}</span>
                      <span className="text-[10px] text-gray-500">{locale === "ko" ? "쉬어가는 게 좋아요" : "Time to take a rest"}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "레벨별 기준 (세션 볼륨 / 체중)" : "Standards by Level (Session Volume / BW)"}</p>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "초급" : "Beginner"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "최소 15 · 최적 55 · 상한 70" : "Min 15 · Optimal 55 · Max 70"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "중급" : "Intermediate"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "최소 40 · 최적 110 · 상한 140" : "Min 40 · Optimal 110 · Max 140"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "상급" : "Advanced"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "최소 70 · 최적 180 · 상한 220" : "Min 70 · Optimal 180 · Max 220"}</span></div>
                  </div>
                </div>
                <p>{locale === "ko" ? <><span className="font-bold text-[#2D6A4F]">성장 구간</span>을 꾸준히 유지하면 가장 효과적이에요. 기록이 쌓이면 내 데이터에 맞게 조정돼요.</> : <>Staying consistently in the <span className="font-bold text-[#2D6A4F]">Growth Zone</span> is most effective. As your history builds up, the targets adjust to your data.</>}</p>
                <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">{locale === "ko" ? "근거: ACSM (2009), Israetel RP Strength, NSCA Volume Load" : "Source: ACSM (2009), Israetel RP Strength, NSCA Volume Load"}</p>
              </div>
            </>
          )}
          {helpCard === "intensity" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "운동 강도" : "Workout Intensity"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>오늘 운동이 <span className="font-bold text-[#1B4332]">고강도·중강도·저강도</span> 중 어디에 해당하는지 보여줘요.</> : <>Shows whether today&apos;s workout falls under <span className="font-bold text-[#1B4332]">High, Moderate, or Low</span> intensity.</>}</p>
                <p>{locale === "ko" ? "세트별 사용 중량을 예상 1RM 대비 비율(%1RM)로 환산해서 판정해요. 중량 데이터가 없으면 세트당 평균 반복수로 판정해요." : "Each set's weight is compared to your estimated 1RM (%1RM). If no weight data is available, average reps per set are used instead."}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "강도 분류 기준 (ACSM + NSCA)" : "Intensity Classification (ACSM + NSCA)"}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded shrink-0">{locale === "ko" ? "고강도" : "High"}</span>
                      <span className="text-[10px] text-gray-500">{locale === "ko" ? "80%+ 1RM · 1-6회 · 최대근력" : "80%+ 1RM · 1-6 reps · Max Strength"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">{locale === "ko" ? "중강도" : "Moderate"}</span>
                      <span className="text-[10px] text-gray-500">{locale === "ko" ? "60-79% 1RM · 7-12회 · 근비대" : "60-79% 1RM · 7-12 reps · Hypertrophy"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded shrink-0">{locale === "ko" ? "저강도" : "Low"}</span>
                      <span className="text-[10px] text-gray-500">{locale === "ko" ? "60% 미만 1RM · 13회+ · 근지구력" : "<60% 1RM · 13+ reps · Endurance"}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? <>주간 권장 배분 ({gender === "female" ? "여성" : "남성"} · 연령별)</> : <>Weekly Distribution ({gender === "female" ? "Female" : "Male"} · By Age)</>}</p>
                  {gender === "female" ? (
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "20-39세" : "20-39"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 2회 · 중 2회 · 저 1회" : "High 2x · Mod 2x · Low 1x"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "40-59세" : "40-59"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 2회 · 중 2회 · 저 1회 (골밀도)" : "High 2x · Mod 2x · Low 1x (bone density)"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "60세+" : "60+"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 1회 · 중 2회 · 저 1회" : "High 1x · Mod 2x · Low 1x"}</span></div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "20-39세" : "20-39"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 2회 · 중 2회 · 저 1회" : "High 2x · Mod 2x · Low 1x"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "40-59세" : "40-59"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 1회 · 중 3회 · 저 1회" : "High 1x · Mod 3x · Low 1x"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "60세+" : "60+"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "고 1회 · 중 2회 · 저 1회" : "High 1x · Mod 2x · Low 1x"}</span></div>
                    </div>
                  )}
                </div>
                {gender === "female" && (
                  <p className="text-[11px] text-gray-500">{locale === "ko" ? <><span className="font-bold text-[#2D6A4F]">여성 참고</span>: 에스트로겐의 항염증 효과로 회복이 ~15% 빠르며, 40대 이후 골밀도 유지를 위해 고강도 비중을 유지하는 것이 권장돼요 (ACSM 폐경 후 가이드라인).</> : <><span className="font-bold text-[#2D6A4F]">Note for women</span>: Estrogen&apos;s anti-inflammatory effect speeds recovery by ~15%. After 40, maintaining high-intensity sessions is recommended to preserve bone density (ACSM postmenopausal guidelines).</>}</p>
                )}
                <p>{locale === "ko" ? <>고·중·저를 <span className="font-bold text-[#2D6A4F]">골고루 배분</span>하면 과훈련을 방지하고 성장 효율이 가장 높아요. 이번 주 배분을 확인하고 다음 세션 강도를 조절해보세요.</> : <><span className="font-bold text-[#2D6A4F]">Balancing</span> high, moderate, and low intensity prevents overtraining and maximizes growth. Check this week&apos;s distribution and adjust your next session accordingly.</>}</p>
                <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">{locale === "ko" ? "근거: ACSM Resistance Exercise Guidelines (2025), WHO Physical Activity Guidelines (2020, PMC 7719906), Schoenfeld et al. (2019, PMC 6303131)" : "Source: ACSM Resistance Exercise Guidelines (2025), WHO Physical Activity Guidelines (2020, PMC 7719906), Schoenfeld et al. (2019, PMC 6303131)"}</p>
              </div>
            </>
          )}
          {helpCard === "loadTimeline" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "4주 부하 타임라인" : "4-Week Load Timeline"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>최근 4주간의 <span className="font-bold text-[#1B4332]">운동 부하(볼륨)를 그래프로</span> 보여줘요. 점 하나가 운동 한 번이에요.</> : <>Shows your <span className="font-bold text-[#1B4332]">training load (volume) over the past 4 weeks</span> as a chart. Each dot is one session.</>}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded-sm inline-block shrink-0" />
                    <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">{locale === "ko" ? "초록색 영역 = 성장 구간" : "Green Zone = Growth Zone"}</span></p>
                  </div>
                  <p className="text-[11px] text-gray-500 ml-5">{locale === "ko" ? <>{levelLabel} 레벨과 연령에 맞춘 적정 볼륨 구간이에요. 이 안에 있으면 잘하고 있는 거예요.</> : <>The optimal volume range for your {levelLabel} level and age. Staying inside means you&apos;re on track.</>}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded-sm inline-block shrink-0" />
                    <p className="text-[11px]"><span className="font-bold text-amber-600">{locale === "ko" ? "노란색 영역 = 고부하 주의" : "Yellow Zone = High Load Warning"}</span></p>
                  </div>
                  <p className="text-[11px] text-gray-500 ml-5">{locale === "ko" ? "적정 범위를 넘은 구간이에요. 가끔은 괜찮지만 자주 넘으면 조절이 필요해요." : "Beyond the optimal range. Okay once in a while, but frequent visits mean you should dial back."}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 bg-[#2D6A4F] rounded-full inline-block shrink-0" />
                    <p className="text-[11px]"><span className="font-bold text-[#2D6A4F]">{locale === "ko" ? "점 = 세션별 부하" : "Dot = Session Load"}</span></p>
                  </div>
                  <p className="text-[11px] text-gray-500 ml-5">{locale === "ko" ? "총 볼륨(무게 x 횟수)을 체중으로 나눈 값이에요. 높을수록 강하게 운동한 거예요. 점을 터치하면 수치를 확인할 수 있어요." : "Total volume (weight x reps) divided by body weight. Higher means a harder session. Tap a dot to see the exact number."}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "레벨별 구간 수치 (볼륨 / 체중)" : "Zone Values by Level (Volume / BW)"}</p>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "초급" : "Beginner"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "적정 15~55 · 주의 55~70 · 상한 70+" : "Optimal 15–55 · Caution 55–70 · Max 70+"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "중급" : "Intermediate"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "적정 40~110 · 주의 110~140 · 상한 140+" : "Optimal 40–110 · Caution 110–140 · Max 140+"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{locale === "ko" ? "상급" : "Advanced"}</span><span className="font-bold text-gray-600">{locale === "ko" ? "적정 70~180 · 주의 180~220 · 상한 220+" : "Optimal 70–180 · Caution 180–220 · Max 220+"}</span></div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{locale === "ko" ? "예: 체중 70kg, 총 볼륨 4,200kg → Load Score = 60" : "e.g. BW 70kg, total volume 4,200kg → Load Score = 60"}</p>
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                    <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "계산 공식" : "Formula"}</p>
                    <p className="text-[10px] text-gray-500">{locale === "ko" ? "Load Score = 총 볼륨(kg) / 체중(kg)" : "Load Score = Total Volume(kg) / Body Weight(kg)"}</p>
                    <p className="text-[10px] text-gray-500">{locale === "ko" ? "총 볼륨 = 모든 세트의 (무게 x 횟수) 합계" : "Total Volume = Sum of (Weight x Reps) for all sets"}</p>
                    <p className="text-[10px] text-gray-500">{locale === "ko" ? "적정 범위는 운동 레벨(초급/중급/상급)과 나이에 따라 자동 조정돼요." : "Optimal range auto-adjusts based on your level (beginner/intermediate/advanced) and age."}</p>
                  </div>
                </div>
                <p>{locale === "ko" ? <>꾸준히 초록 영역 안에 점이 찍히면 <span className="font-bold text-[#2D6A4F]">잘 관리되고 있는 거예요</span>. 노란 영역 위로 자주 벗어나면 볼륨 조절이 필요해요.</> : <>If your dots consistently land in the green zone, <span className="font-bold text-[#2D6A4F]">you&apos;re managing well</span>. Frequently going above the yellow zone means it&apos;s time to adjust your volume.</>}</p>
                <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">{locale === "ko" ? "근거: ACSM 점진적 과부하 원칙, Schoenfeld et al. (2017), Israetel RP Strength, NSCA" : "Source: ACSM progressive overload principle, Schoenfeld et al. (2017), Israetel RP Strength, NSCA"}</p>
              </div>
            </>
          )}
          {helpCard === "fatigueDrop" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "피로 신호" : "Fatigue Signal"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>운동 <span className="font-bold text-[#1B4332]">전반부와 후반부의 반복 횟수 차이</span>를 비교한 거예요.</> : <>Compares <span className="font-bold text-[#1B4332]">rep counts between the first and second half</span> of your workout.</>}</p>
                <p>{locale === "ko" ? <>예를 들어 <span className="font-bold">-12%</span>이면, 후반에 반복 횟수가 12% 줄어든 거예요. 약간의 피로는 자연스러운 거예요.</> : <>For example, <span className="font-bold">-12%</span> means your reps dropped 12% in the second half. Some fatigue is completely normal.</>}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "피로 신호 기준" : "Fatigue Thresholds"}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-[#2D6A4F] rounded">{locale === "ko" ? "-15%까지 안정" : "Up to -15% Stable"}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">{locale === "ko" ? "-15~25% 주의" : "-15–25% Caution"}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded">{locale === "ko" ? "-25%+ 위험" : "-25%+ Warning"}</span>
                  </div>
                </div>
                <p>{locale === "ko" ? "피로가 크면 다음 세션에서 볼륨을 줄이거나 휴식을 더 가져야 해요. 꾸준히 안정 구간이면 잘 관리되고 있는 거예요." : "If fatigue is high, reduce volume or take more rest next session. Staying consistently in the stable zone means you're managing well."}</p>
                <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">{locale === "ko" ? "근거: Morán-Navarro et al. (2017), NSCA 세트간 피로 가이드라인, ACSM 회복 권장" : "Source: Morán-Navarro et al. (2017), NSCA inter-set fatigue guidelines, ACSM recovery recommendations"}</p>
              </div>
            </>
          )}
          {helpCard === "fitnessAge" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "피트니스 나이란?" : "What is Fitness Age?"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>당신의 근력 데이터를 같은 연령대/성별과 비교해서, <span className="font-bold text-[#1B4332]">신체 능력이 몇 살 수준인지</span> 역산한 값이에요.</> : <>We compare your strength data against your age/gender group and calculate <span className="font-bold text-[#1B4332]">what age your fitness level matches</span>.</>}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "계산 방법" : "How it's calculated"}</p>
                  <div className="space-y-1.5 text-[12px]">
                    <p>{locale === "ko" ? "1. 운동별 최고 기록(E1RM)을 체중 대비 비율로 변환" : "1. Convert your best lifts (E1RM) to body weight ratio"}</p>
                    <p>{locale === "ko" ? "2. 연령/성별별 퍼센타일표에서 당신의 위치 산출" : "2. Find your percentile in age/gender reference tables"}</p>
                    <p>{locale === "ko" ? "3. 5개 카테고리(가슴/등/어깨/하체/체력) 가중 평균" : "3. Weighted average of 5 categories (chest/back/shoulder/legs/cardio)"}</p>
                    <p>{locale === "ko" ? "4. 종합 퍼센타일을 전 연령대에 대입해 피트니스 나이 역산" : "4. Map overall percentile across all age groups to find fitness age"}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "카테고리별 가중치" : "Category Weights"}</p>
                  <div className="space-y-1 text-[12px]">
                    <div className="flex justify-between"><span>{locale === "ko" ? "하체" : "Legs"}</span><span className="font-bold">30%</span></div>
                    <div className="flex justify-between"><span>{locale === "ko" ? "가슴" : "Chest"}</span><span className="font-bold">20%</span></div>
                    <div className="flex justify-between"><span>{locale === "ko" ? "등" : "Back"}</span><span className="font-bold">20%</span></div>
                    <div className="flex justify-between"><span>{locale === "ko" ? "어깨" : "Shoulder"}</span><span className="font-bold">15%</span></div>
                    <div className="flex justify-between"><span>{locale === "ko" ? "체력" : "Cardio"}</span><span className="font-bold">15%</span></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "출처 및 근거" : "References"}</p>
                  <div className="space-y-1 text-[11px] text-gray-500">
                    <p>ACSM Guidelines for Exercise Testing and Prescription (11th ed.)</p>
                    <p>NSCA Essentials of Strength Training and Conditioning (4th ed.)</p>
                    <p>{locale === "ko" ? "E1RM 추정: Brzycki/Epley/Lombardi 공식 (렙수별 분기)" : "E1RM estimation: Brzycki/Epley/Lombardi formulas (rep-range based)"}</p>
                    <p>{locale === "ko" ? "머신 운동은 프리웨이트 대비 0.7~0.75 보정 적용" : "Machine exercises adjusted by 0.7-0.75 vs free weights"}</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">{locale === "ko" ? "운동 기록이 쌓일수록 정확도가 올라가요. 최소 3회 이상 기록하면 신뢰도가 높아집니다." : "Accuracy improves with more data. At least 3 sessions recommended for reliable results."}</p>
              </div>
            </>
          )}

          {helpCard === "fitnessRank" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "100명 중 등수란?" : "What does ranking mean?"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>같은 연령대/성별 <span className="font-bold text-[#1B4332]">100명이 모였을 때, 당신이 몇 번째로 힘이 센지</span>를 나타내요.</> : <>If 100 people of your age/gender gathered, this shows <span className="font-bold text-[#1B4332]">where you rank in strength</span>.</>}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "계산 방법" : "How it's calculated"}</p>
                  <div className="space-y-1.5 text-[12px]">
                    <p>{locale === "ko" ? "1. 각 부위의 최고 기록(E1RM)을 체중 대비 비율로 변환" : "1. Convert best lift (E1RM) per body part to BW ratio"}</p>
                    <p>{locale === "ko" ? "2. ACSM/NSCA 연령·성별별 기준표에서 퍼센타일 산출" : "2. Find percentile from ACSM/NSCA age/gender tables"}</p>
                    <p>{locale === "ko" ? "3. 퍼센타일을 100명 중 등수로 변환 (높을수록 강함)" : "3. Convert percentile to rank out of 100 (higher = stronger)"}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "예시" : "Example"}</p>
                  <div className="space-y-1.5 text-[12px]">
                    <p>{locale === "ko" ? "가슴 25등 = 같은 또래 남성 중 상위 25%" : "Chest 25th = Top 25% among peers"}</p>
                    <p>{locale === "ko" ? "등 88등 = 같은 또래 남성 중 하위 88% (아직 성장 중)" : "Back 88th = Bottom 88% (still growing)"}</p>
                    <p>{locale === "ko" ? "종합 = 5개 카테고리의 가중 평균 (하체30/가슴20/등20/어깨15/체력15)" : "Overall = weighted avg of 5 categories (legs30/chest20/back20/shoulder15/cardio15)"}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "운동별 카테고리" : "Exercise Categories"}</p>
                  <div className="space-y-1 text-[12px]">
                    <p>{locale === "ko" ? "가슴: 벤치프레스, 체스트프레스, 푸쉬업 등" : "Chest: Bench Press, Chest Press, Push-ups, etc."}</p>
                    <p>{locale === "ko" ? "등: 로우, 풀업, 랫풀다운 등" : "Back: Row, Pull-up, Lat Pulldown, etc."}</p>
                    <p>{locale === "ko" ? "어깨: 오버헤드프레스, 숄더프레스 등" : "Shoulder: Overhead Press, Shoulder Press, etc."}</p>
                    <p>{locale === "ko" ? "하체: 스쿼트, 데드리프트, 레그프레스 등" : "Legs: Squat, Deadlift, Leg Press, etc."}</p>
                    <p>{locale === "ko" ? "체력: 러닝 기록 기반 (데이터 있을 때)" : "Cardio: Based on running data (when available)"}</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">{locale === "ko" ? "머신 운동은 프리웨이트 대비 0.7~0.75 보정 적용. 운동 기록이 쌓일수록 정확해져요." : "Machine exercises adjusted 0.7-0.75 vs free weights. Accuracy improves with more data."}</p>
                <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">{locale === "ko" ? "근거: ACSM 11th ed, NSCA 4th ed, Brzycki/Epley/Lombardi E1RM 공식" : "Source: ACSM 11th ed, NSCA 4th ed, Brzycki/Epley/Lombardi E1RM formulas"}</p>
              </div>
            </>
          )}

          {helpCard === "levelSystem" && (
            <>
              <h3 className="text-lg font-black text-[#1B4332] mb-3">{locale === "ko" ? "시즌 티어 시스템" : "Season Tier System"}</h3>
              <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">
                <p>{locale === "ko" ? <>운동을 완료할 때마다 <span className="font-bold text-[#1B4332]">경험치(EXP)</span>가 쌓이고, 일정 횟수를 채우면 티어가 올라가요.</> : <>Every completed workout earns <span className="font-bold text-[#1B4332]">experience points (EXP)</span>, and you rank up once you hit the threshold.</>}</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{locale === "ko" ? "시즌 티어 구간" : "Season Tier Brackets"}</p>
                  <div className="space-y-1.5">
                    {TIERS.map((tier, i) => {
                      const next = TIERS[i + 1];
                      return (
                        <div key={tier.name} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 min-w-[72px] text-center" style={{ backgroundColor: `${tier.color}20`, color: tier.color }}>{tier.name}</span>
                          <span className="text-[10px] text-gray-500">{next ? `${tier.minExp}~${next.minExp - 1} EXP` : `${tier.minExp} EXP+`}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p>{locale === "ko" ? <>시즌은 <span className="font-bold text-[#1B4332]">4개월마다 리셋</span>돼요 (1~4월, 5~8월, 9~12월). 새 시즌이 시작되면 Iron부터 다시 도전!</> : <>Seasons <span className="font-bold text-[#1B4332]">reset every 4 months</span> (Jan-Apr, May-Aug, Sep-Dec). Each new season, you start fresh from Iron!</>}</p>
                <p>{locale === "ko" ? "주 3회 꾸준히 하면 시즌 내 Diamond까지 갈 수 있어요." : "Work out 3 times a week consistently and you can reach Diamond within a single season."}</p>
              </div>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 mt-5 rounded-2xl bg-[#1B4332] text-white font-bold text-sm active:scale-[0.98] transition-all shrink-0"
        >
          {t("report.help.confirm")}
        </button>
      </div>
    </div>
  );
};
