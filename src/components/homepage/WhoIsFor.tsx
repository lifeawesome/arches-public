export default function WhoIsFor() {
  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            Who Arches Is For / Not For
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-8">
              <h3 className="mb-4 text-xl font-semibold text-primary">
                Arches Is For You If…
              </h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">•</span>
                  <span>You&apos;re good at what you do but don&apos;t fully own it yet</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">•</span>
                  <span>You want clarity, not hype</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">•</span>
                  <span>You value growth over shortcuts</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">•</span>
                  <span>You&apos;re building something real</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">•</span>
                  <span>You want to feel confident calling yourself an expert</span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-background p-8">
              <h3 className="mb-4 text-xl font-semibold text-muted-foreground">
                Arches Is Not For You If…
              </h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-muted-foreground">•</span>
                  <span>You want instant fame</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-muted-foreground">•</span>
                  <span>You&apos;re looking for passive exposure without effort</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-muted-foreground">•</span>
                  <span>You don&apos;t want to reflect or grow</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-muted-foreground">•</span>
                  <span>You&apos;re not willing to define your niche</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

