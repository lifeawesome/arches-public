import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
// Logo mark
function Logo() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-400 to-blue-600" />
      <span>Arches Network</span>
    </div>
  );
}

export function HomeNavbar() {
  const router = useRouter();

  function handleJoinNetwork(memberType: string): void {
    router.push(`/signup?type=${memberType}`);
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-6 text-sm">
          <a href="#how" className="hover:opacity-80">
            How it works
          </a>
          <a href="#why" className="hover:opacity-80">
            Why Arches
          </a>
          <a href="#learn" className="hover:opacity-80">
            Learn
          </a>
          <a href="#use-cases" className="hover:opacity-80">
            Use cases
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => handleJoinNetwork("expert")}
          >
            Apply as an Expert
          </Button>
          <Button
            className="rounded-2xl"
            onClick={() => handleJoinNetwork("member")}
          >
            Join the Network
          </Button>
        </div>
      </div>
    </div>
  );
}
