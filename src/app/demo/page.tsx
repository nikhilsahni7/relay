import { redirect } from "next/navigation";

// The seeded demo team is created in Session 5. Until then this redirects to
// its track (which shows the empty state if not yet seeded).
export default function DemoPage() {
  redirect("/t/relay-demo");
}
