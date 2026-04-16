import { setGlobalOptions } from "firebase-functions/v2/options";
import "./helpers"; // ensure app is initialized

setGlobalOptions({ region: "us-central1" });

export { generateWorkout, analyzeWorkout } from "./ai/workout";
export { getCoachMessage } from "./ai/coach";
export { getNutritionGuide, nutritionChat } from "./ai/nutrition";
export { parseIntent } from "./ai/parseIntent";
export { planSession, getGuestTrialStatus } from "./plan/session";
export { savePlan, listSavedPlans, deleteSavedPlan, markSavedPlanUsed, saveProgram, deleteProgram } from "./plan/savedPlans";
export { subscribe, getSubscription, cancelSubscription, submitRefundRequest } from "./billing/subscription";
export { selfDeleteAccount } from "./billing/selfDelete";
export { adminActivate, adminCheckUser, adminCheckSelf, adminDeactivate, adminDashboard, adminListUsers, adminListPayments, adminLogs, adminCancelFeedbacks, adminRefundRequests, adminProcessRefund } from "./admin/admin";
