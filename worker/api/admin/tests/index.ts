import type { MbtiEnv, PagesContext } from "../../../_types.ts";

import { listTests } from "../../tests/index.ts";

export async function onRequestGet(
  context: PagesContext<MbtiEnv>,
): Promise<Response> {
  return listTests(context, { publishedOnly: false, useCache: false });
}
