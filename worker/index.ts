import type { ExecutionContext, MbtiEnv, PagesContext } from "./_types.ts";

import { dispatchWorkerRequest } from "./http/dispatch.ts";

export default {
  async fetch(
    request: Request,
    env: MbtiEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return dispatchWorkerRequest(request, env, ctx);
  },
};
