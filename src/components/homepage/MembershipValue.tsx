const membershipBenefits = [
  "Guided expert growth framework",
  "Structured learning paths",
  "Tools to clarify your positioning",
  "Confidence-building exercises",
  "Expert profile & directory access",
  "A community of others doing the work",
];

export default function MembershipValue() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">What You Get as a Member</h2>
          <ul className="mb-8 space-y-4 text-lg text-muted-foreground">
            {membershipBenefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="mt-1.5 text-primary">•</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <p className="text-xl font-medium text-foreground">
            This is not a course you finish. It&apos;s a platform you grow inside of.
          </p>
        </div>
      </div>
    </section>
  );
}

