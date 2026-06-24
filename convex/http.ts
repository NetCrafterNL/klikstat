import { httpRouter } from "convex/server";
import {
  collectOptions,
  collectPost,
  publicGet,
  v1StatsOptions,
  v1StatsGet,
  aiInsightsOptions,
  aiInsightsPost,
  aiSetupOptions,
  aiSetupPost,
  alertsCheck,
  emailWeekly,
} from "./httpActions";

const http = httpRouter();

http.route({ path: "/collect", method: "OPTIONS", handler: collectOptions });
http.route({ path: "/collect", method: "POST", handler: collectPost });

http.route({ pathPrefix: "/public/", method: "GET", handler: publicGet });

http.route({ path: "/v1/stats", method: "OPTIONS", handler: v1StatsOptions });
http.route({ path: "/v1/stats", method: "GET", handler: v1StatsGet });

http.route({ path: "/ai/insights", method: "OPTIONS", handler: aiInsightsOptions });
http.route({ path: "/ai/insights", method: "POST", handler: aiInsightsPost });

http.route({ path: "/ai/setup", method: "OPTIONS", handler: aiSetupOptions });
http.route({ path: "/ai/setup", method: "POST", handler: aiSetupPost });

http.route({ path: "/alerts/check", method: "GET", handler: alertsCheck });

http.route({ path: "/email/weekly", method: "GET", handler: emailWeekly });

export default http;
