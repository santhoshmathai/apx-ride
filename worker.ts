import handler from 'vinext/server/fetch-handler';
import { processAllDueOutbox } from './app/email-service';

const worker = {
  fetch(request: Request, workerEnv: Cloudflare.Env, context: ExecutionContext) {
    return handler.fetch(request, workerEnv, context);
  },
  async scheduled(_controller: ScheduledController, _workerEnv: Cloudflare.Env, context: ExecutionContext) {
    context.waitUntil(processAllDueOutbox());
  },
};

export default worker;
