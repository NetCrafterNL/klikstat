import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(  "daily emails",   { hourUTC: 8, minuteUTC: 0 },            internal.jobs.sendEmails, { frequency: "daily" });
crons.weekly( "weekly emails",  { dayOfWeek: "monday", hourUTC: 8, minuteUTC: 0 }, internal.jobs.sendEmails, { frequency: "weekly" });
crons.monthly("monthly emails", { day: 1, hourUTC: 8, minuteUTC: 0 },    internal.jobs.sendEmails, { frequency: "monthly" });
crons.daily(  "alert check",    { hourUTC: 9, minuteUTC: 0 },            internal.jobs.checkAlerts);

export default crons;
