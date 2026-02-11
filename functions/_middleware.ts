/**
 * Pages Functions middleware: global error handling.
 * Catches unhandled errors from all route handlers and returns a safe JSON response
 * without leaking stack traces to clients (AGENTS.md).
 */
import type { PagesContext } from "./_types";

export async function onRequest(
  context: PagesContext<Record<string, unknown>>,
): Promise<Response> {
  try {
    return await context.next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    if (err instanceof Error && err.stack) {
      console.error("[middleware]", message, err.stack);
    } else {
      console.error("[middleware]", message);
    }
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
