export default function SocialProof() {
  return (
    <section className="border-y border-border bg-muted/30 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            You&apos;re not starting from zero. You&apos;re just not fully owning it yet.
          </h2>
          <ul className="mx-auto flex max-w-xl flex-col gap-3 text-left text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>You know your craft</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>Others ask you for help</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>You&apos;ve got experience — but not confidence</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>You struggle to explain what makes you different</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>You feel &quot;almost ready,&quot; but not quite</span>
            </li>
          </ul>
          <p className="mt-6 text-base font-medium text-foreground">
            Arches exists for this exact moment.
          </p>
        </div>
      </div>
    </section>
  );
}

