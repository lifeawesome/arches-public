import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/homepage/Hero";
import SocialProof from "@/components/homepage/SocialProof";
import WhatIsArches from "@/components/homepage/WhatIsArches";
import ExpertGrowthPath from "@/components/homepage/ExpertGrowthPath";
import DirectoryReframe from "@/components/homepage/DirectoryReframe";
import WhoIsFor from "@/components/homepage/WhoIsFor";
import MembershipValue from "@/components/homepage/MembershipValue";
import FinalCTA from "@/components/homepage/FinalCTA";

export default async function Home() {
  // Check if user is authenticated and redirect to dashboard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col">
        <Hero />
        <SocialProof />
        <WhatIsArches />
        <ExpertGrowthPath />
        <DirectoryReframe />
        <WhoIsFor />
        <MembershipValue />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
