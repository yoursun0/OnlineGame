import { createFileRoute } from "@tanstack/react-router";
import { ShaftGame } from "@/components/ShaftGame";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ShaftGame />;
}
