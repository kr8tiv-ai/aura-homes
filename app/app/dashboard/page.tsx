import ProjectOverview from "@/components/project/ProjectOverview";

// /dashboard is the real project overview: it renders the ACTIVE AuraProject
// v2 document (stepStates, budget basis, quotes, typed blockers, and the one
// recommended next action) from local storage — no fixtures, no preview data.
// The page itself stays a server component so metadata exports; every read of
// project state happens client-side inside ProjectOverview.

export const metadata = {
  title: "Project record — Aura Homes",
  description:
    "Your active project's real state: design, land, team, cost basis, quotes, blockers, and the one recommended next step.",
};

export default function DashboardPage() {
  return <ProjectOverview />;
}
