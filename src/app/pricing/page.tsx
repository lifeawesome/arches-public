import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Pricing from "@/components/pricing/Pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose the perfect growth path for your expert journey",
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col">
        <Pricing />
      </main>
      <Footer />
    </>
  );
}

