"use client";

import Image from "next/image";

interface IllustrationProps {
  className?: string;
}

export function ExplorerIllustration({ className = "" }: IllustrationProps) {
  return (
    <Image
      src="/banners/explorer.png"
      alt="Explorer"
      width={400}
      height={400}
    />
  );
}

export function BuilderIllustration({ className = "" }: IllustrationProps) {
  return (
    <Image src="/banners/builder.png" alt="Explorer" width={400} height={400} />
  );
}

export function ProIllustration({ className = "" }: IllustrationProps) {
  return (
    <Image src="/banners/pro.png" alt="Explorer" width={400} height={400} />
  );
}

export function PartnerIllustration({ className = "" }: IllustrationProps) {
  return (
    <Image src="/banners/partner.png" alt="Explorer" width={400} height={400} />
  );
}
