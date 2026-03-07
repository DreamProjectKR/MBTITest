import type { MbtiEnv, PagesContext } from "../../../_types";

import { listTests } from "../../tests/index";

export async function onRequestGet(
  context: PagesContext<MbtiEnv>,
): Promise<Response> {
  return listTests(context, { publishedOnly: false, useCache: false });
}
