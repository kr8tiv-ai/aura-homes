import { redirect } from "next/navigation";

export const metadata = {
  title: "Project guidance | Aura Homes",
  description: "Compatibility route to Aura's local project overview.",
  robots: { index: false },
};

export default function ConciergePage() {
  redirect("/dashboard");
}
