import handler from 'vinext/server/fetch-handler';
import { processAllDueOutbox } from './app/email-service';
import { processComplianceChecks } from './app/compliance-checks';

const worker = {
  fetch(request: Request, workerEnv: Cloudflare.Env, context: ExecutionContext) {
    return handler.fetch(request, workerEnv, context);
  },
  async scheduled(controller: ScheduledController, _workerEnv: Cloudflare.Env, context: ExecutionContext) {
    context.waitUntil(controller.cron === '15 7 * * *' ? processComplianceChecks() : processAllDueOutbox());
  },
};

export default worker;
