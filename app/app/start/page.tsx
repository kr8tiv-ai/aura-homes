import ProjectIntake from "@/components/project/ProjectIntake";

export default function StartPage() {
  return (
    <div className="project-start-page py-10 sm:py-14">
      <header className="project-start-hero">
        <p className="aura-label">The all-in-one unique-stay platform</p>
        <h1>Start with the life you want to live.</h1>
        <p>
          Design or choose a small eco home, match the land, assemble the team, compare quotes,
          and prepare the same private project for professional review and handoff. Cash works;
          crypto stays optional.
        </p>
      </header>
      <ProjectIntake />
    </div>
  );
}
