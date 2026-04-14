import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="bg-primary py-20 text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">
            You Don&apos;t Need to Become Someone New
          </h2>
          <p className="mb-4 text-2xl font-semibold">
            You Need to Become More You
          </p>
          <p className="mb-8 text-lg opacity-90">
            Arches Network helps you do exactly that.
          </p>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary-foreground px-8 text-base font-semibold text-primary transition-colors hover:bg-primary-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary-foreground focus:ring-offset-2 focus:ring-offset-primary"
          >
            Start Growing as an Expert
          </Link>
        </div>
      </div>
    </section>
  );
}

