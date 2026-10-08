import { publicProcedure, createTRPCRouter } from "../init";
import { analyticsRouter } from "./analytics";
import { anonymizedReportRouter } from "./anonymized-report";
import { answerRouter } from "./answer";
import { areaRouter } from "./area";
import { bannerRouter } from "./banner";
import { contactRouter } from "./contact";
import { crmRouter } from "./crm";
import { cronRouter } from "./cron";
import { debugRouter } from "./debug";
import { goldenDatasetRouter } from "./golden-dataset";
import { reportRouter } from "./report";
import { organizationRouter } from "./organization";
import { statsRouter } from "./stats";
import { taggingFeedbackRouter } from "./tagging-feedback";
import { userRouter } from "./user";
import { teamRouter } from "./team";
import { supervisorRouter } from "./supervisor";

export const appRouter = createTRPCRouter({
  healthcheck: publicProcedure.query(() => {
    return "OK";
  }),
  report: reportRouter,
  user: userRouter,
  organization: organizationRouter,
  stats: statsRouter,
  area: areaRouter,
  team: teamRouter,
  answer: answerRouter,
  banner: bannerRouter,
  contact: contactRouter,
  crm: crmRouter,
  cron: cronRouter,
  debug: debugRouter,
  goldenDataset: goldenDatasetRouter,
  supervisor: supervisorRouter,
  analytics: analyticsRouter,
  anonymizedReport: anonymizedReportRouter,
  taggingFeedback: taggingFeedbackRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
