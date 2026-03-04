import DustbowlDevClient from "@/app/dev/dustbowl/DustbowlDevClient";

export const metadata = {
  title: "Dustbowl Dash Dev Playground",
  description: "Temporary development playground for Phase 7 Dustbowl Dash implementation.",
};

export default function DustbowlDevPage() {
  return <DustbowlDevClient />;
}
