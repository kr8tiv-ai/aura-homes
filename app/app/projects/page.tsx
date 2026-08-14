import ProjectLibrary from "@/components/project/ProjectLibrary";

/* /projects is the dashboard AND the place storage tells the truth about
   itself. `ProjectCentre` — the earlier list of cards with a backup bar — is
   superseded by it: everything that page did (list, download, encrypted
   download, duplicate, archive, import) is carried over, and the stage,
   blocker count, restore confirmation and named storage failures are new. */
export default function ProjectsPage() {
  return <ProjectLibrary />;
}
