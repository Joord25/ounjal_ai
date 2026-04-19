import { setGlobalOptions } from "firebase-functions/v2/options";
import "./helpers"; // ensure app is initialized

setGlobalOptions({ region: "us-central1" });

export { getCoachMessage } from "./ai/coach";
export { getNutritionGuide, nutritionChat } from "./ai/nutrition";
export { parseIntent } from "./ai/parseIntent";
export { planSession, getGuestTrialStatus, generateProgramSessions } from "./plan/session";
export { savePlan, listSavedPlans, deleteSavedPlan, markSavedPlanUsed, saveProgram, deleteProgram } from "./plan/savedPlans";
export { generateRunningProgramFn, checkFullSub3GateFn } from "./plan/runningProgramApi";
export { subscribe, getSubscription, cancelSubscription, submitRefundRequest } from "./billing/subscription";
export { selfDeleteAccount } from "./billing/selfDelete";
export { adminActivate, adminCheckUser, adminCheckSelf, adminDeactivate, adminDashboard, adminListUsers, adminListPayments, adminLogs, adminCancelFeedbacks, adminRefundRequests, adminProcessRefund } from "./admin/admin";
export { adminAnalyticsFunnel } from "./admin/analyticsFunnel";
