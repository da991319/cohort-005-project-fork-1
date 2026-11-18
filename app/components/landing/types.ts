import type { LandingPageData } from "~/modules/landing-page/index.server";

export type FeaturedCourse = LandingPageData["featuredCourses"][number];
export type CatalogueStats = LandingPageData["stats"];
