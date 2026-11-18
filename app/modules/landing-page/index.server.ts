import { db } from "~/db";
import type { Db } from "./lib/database";
import { loadLandingPage } from "./lib/load.server";

/** What the landing page at `/` shows about the catalogue. */
export type LandingPageData = ReturnType<typeof loadLandingPage>;

/**
 * The landing page bound to a database. The app uses `landingPage`; tests
 * build their own against a test database.
 */
export function createLandingPage(database: Db) {
  return {
    /**
     * The newest published courses, each with its lesson count, and totals
     * for the published catalogue: courses, the categories and instructors
     * they span, and their lessons. Drafts and archived courses count for
     * nothing.
     */
    load() {
      return loadLandingPage(database);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const landingPage = /* @__PURE__ */ createLandingPage(db);
