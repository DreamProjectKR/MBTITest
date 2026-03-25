import assert from "node:assert/strict";
import test from "node:test";

import {
  getRouteDescriptor,
  matchRoute,
  routeDescriptors,
} from "../../worker/http/routes.ts";

test("route matchers return null for non-matching segment shapes", () => {
  const byRoute = Object.fromEntries(routeDescriptors.map((d) => [d.route, d]));

  assert.deepEqual(byRoute["api/tests/:id"].match(["api", "tests", "tid"]), {
    id: "tid",
  });
  assert.deepEqual(
    byRoute["api/admin/tests/:id"].match(["api", "admin", "tests", "aid"]),
    { id: "aid" },
  );
  assert.deepEqual(
    byRoute["api/admin/tests/:id/images"].match([
      "api",
      "admin",
      "tests",
      "iid",
      "images",
    ]),
    { id: "iid" },
  );

  assert.equal(byRoute["api/tests/:id"].match(["api", "tests", ""]), null);
  assert.equal(byRoute["api/tests/:id"].match(["api", "tests"]), null);
  assert.equal(
    byRoute["api/tests/:id/compute"].match(["api", "tests", "x", "x"]),
    null,
  );

  assert.equal(
    byRoute["api/admin/tests/:id"].match(["api", "admin", "tests", ""]),
    null,
  );
  assert.equal(
    byRoute["api/admin/tests/:id/images"].match([
      "api",
      "admin",
      "tests",
      "",
      "images",
    ]),
    null,
  );

  assert.equal(byRoute["assets"].match(["not-assets"]), null);
});

test("tieredCache for api/tests/:id returns null when id is empty", () => {
  const d = routeDescriptors.find((x) => x.route === "api/tests/:id");
  assert.ok(d);
  assert.equal(d.tieredCache({ id: "" }), null);
});

test("getRouteDescriptor returns null for unknown route", () => {
  assert.equal(getRouteDescriptor("no/such"), null);
});

test("matchRoute falls through to unknown", () => {
  assert.equal(matchRoute("/nope/here").route, "unknown");
});

test("assets route tieredCache tags with and without first path segment", () => {
  const assets = routeDescriptors.find((d) => d.route === "assets");
  assert.ok(assets);
  assert.deepEqual(assets.tieredCache({ path: "" }).cacheTags, ["assets"]);
  const withSeg = assets.tieredCache({ path: "test-z/foo.png" });
  assert.ok(withSeg.cacheTags.includes("test-test-z"));
});
