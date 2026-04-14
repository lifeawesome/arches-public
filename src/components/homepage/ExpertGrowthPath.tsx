const growthStages = [
  {
    number: "1",
    title: "Confidence & Identity",
    description: "You clarify who you are, what you know, and why it matters.",
    items: [
      "Overcome imposter syndrome",
      "Own your experience",
      "Develop your expert voice",
    ],
  },
  {
    number: "2",
    title: "Positioning & Niche",
    description: "You stop sounding generic and start sounding specific.",
    items: [
      "Define who you help",
      "Identify your core problem",
      "Shape your expert POV",
    ],
  },
  {
    number: "3",
    title: "Authority & Trust",
    description: "You learn how to show up with clarity and credibility.",
    items: [
      "Share insights",
      "Teach with confidence",
      "Build trust before selling",
    ],
  },
  {
    number: "4",
    title: "Visibility & Discovery",
    description: "Only once you're grounded do we amplify you.",
    items: [
      "Expert profile",
      "Directory listing",
      "Credibility signals",
      "Organic discovery",
    ],
  },
  {
    number: "5",
    title: "Monetization Readiness",
    description: "You move from 'helpful' to 'valuable.'",
    items: [
      "Offers",
      "Pricing",
      "Boundaries",
      "Sustainable income paths",
    ],
  },
];

export default function ExpertGrowthPath() {
  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              How It Works — The Expert Growth Path
            </h2>
            <p className="text-lg text-muted-foreground">
              Arches gives you a structured path to grow as an expert — no guesswork, no pretending, no hype.
            </p>
          </div>
          <div className="space-y-8">
            {growthStages.map((stage, index) => (
              <div
                key={stage.number}
                className="flex flex-col gap-6 rounded-lg border border-border bg-background p-6 md:flex-row md:p-8"
              >
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    {stage.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-2xl font-semibold">{stage.title}</h3>
                  <p className="mb-4 text-lg text-muted-foreground">{stage.description}</p>
                  <ul className="space-y-2">
                    {stage.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-muted-foreground">
                        <span className="mt-1.5 text-primary">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

