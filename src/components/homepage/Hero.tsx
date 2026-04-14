"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Hero() {
  const [archemetesError, setArchemetesError] = useState(false);

  return (
    <section
      className="relative py-20 md:py-32 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #faf8f6 100%)",
      }}
    >
      {/* Animated morphing blobs background - Stripe-style */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none z-0"
        aria-hidden="true"
      >
        <svg
          className="absolute w-full h-full"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="blob-gradient-1"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor="rgb(156, 163, 175)"
                stopOpacity="0.25"
              />
              <stop
                offset="100%"
                stopColor="rgb(107, 114, 128)"
                stopOpacity="0.19"
              />
            </linearGradient>
            <linearGradient
              id="blob-gradient-2"
              x1="100%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor="rgb(156, 163, 175)"
                stopOpacity="0.14"
              />
              <stop
                offset="100%"
                stopColor="rgb(107, 114, 128)"
                stopOpacity="0.10"
              />
            </linearGradient>
            <linearGradient
              id="blob-gradient-3"
              x1="50%"
              y1="0%"
              x2="50%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor="rgb(156, 163, 175)"
                stopOpacity="0.13"
              />
              <stop
                offset="100%"
                stopColor="rgb(107, 114, 128)"
                stopOpacity="0.09"
              />
            </linearGradient>
          </defs>

          {/* Blob 1 - Top center, morphing */}
          <path
            fill="url(#blob-gradient-1)"
            className="blob-animate-1"
            d="M 300 100 Q 400 50, 500 100 T 700 100 T 900 100 T 1100 100 Q 1000 150, 900 150 T 700 150 T 500 150 T 300 100 Z"
          >
            <animate
              attributeName="d"
              dur="10s"
              repeatCount="indefinite"
              values="M 300 100 Q 400 50, 500 100 T 700 100 T 900 100 T 1100 100 Q 1000 150, 900 150 T 700 150 T 500 150 T 300 100 Z; M 350 70 Q 450 20, 550 80 T 750 130 T 950 60 T 1150 120 Q 1050 180, 950 170 T 750 180 T 550 160 T 350 70 Z; M 250 130 Q 350 80, 450 140 T 650 70 T 850 140 T 1050 80 Q 950 120, 850 130 T 650 120 T 450 140 T 250 130 Z; M 320 90 Q 420 30, 520 110 T 720 90 T 920 110 T 1080 110 Q 980 160, 880 140 T 680 160 T 480 130 T 320 90 Z; M 300 100 Q 400 50, 500 100 T 700 100 T 900 100 T 1100 100 Q 1000 150, 900 150 T 700 150 T 500 150 T 300 100 Z"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="12s"
              repeatCount="indefinite"
              values="0,0; 30,-20; -20,25; 15,10; 0,0"
            />
          </path>

          {/* Blob 2 - Right side, slower morph */}
          <path
            fill="url(#blob-gradient-2)"
            className="blob-animate-2"
            d="M 800 200 Q 900 150, 1000 200 T 1100 250 Q 1000 300, 900 300 T 800 200 Z"
          >
            <animate
              attributeName="d"
              dur="12s"
              repeatCount="indefinite"
              values="M 800 200 Q 900 150, 1000 200 T 1100 250 Q 1000 300, 900 300 T 800 200 Z; M 850 170 Q 950 110, 1050 220 T 1120 280 Q 1020 320, 920 330 T 850 170 Z; M 750 230 Q 850 190, 950 180 T 1080 220 Q 980 280, 880 270 T 750 230 Z; M 820 210 Q 920 130, 1020 210 T 1080 270 Q 980 310, 880 290 T 820 210 Z; M 800 200 Q 900 150, 1000 200 T 1100 250 Q 1000 300, 900 300 T 800 200 Z"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="14s"
              repeatCount="indefinite"
              values="0,0; 35,-25; -25,30; 20,15; 0,0"
            />
          </path>

          {/* Blob 3 - Left side, subtle movement */}
          <path
            fill="url(#blob-gradient-3)"
            className="blob-animate-3"
            d="M 100 300 Q 200 250, 300 300 T 400 350 Q 300 400, 200 400 T 100 300 Z"
          >
            <animate
              attributeName="d"
              dur="11s"
              repeatCount="indefinite"
              values="M 100 300 Q 200 250, 300 300 T 400 350 Q 300 400, 200 400 T 100 300 Z; M 130 270 Q 230 210, 330 320 T 420 380 Q 320 430, 220 420 T 130 270 Z; M 70 330 Q 170 290, 270 280 T 380 320 Q 280 370, 180 380 T 70 330 Z; M 120 310 Q 220 230, 320 310 T 380 370 Q 280 410, 180 390 T 120 310 Z; M 100 300 Q 200 250, 300 300 T 400 350 Q 300 400, 200 400 T 100 300 Z"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              dur="13s"
              repeatCount="indefinite"
              values="0,0; -30,25; 25,-20; -15,15; 0,0"
            />
          </path>
        </svg>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-4xl text-center">
          {/* Main content */}
          <div className="relative z-10">
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Become the expert you know you are.
            </h1>
            <p className="mb-4 text-xl leading-relaxed text-muted-foreground md:text-2xl">
              Arches Network helps developing experts build confidence, clarity,
              and credibility — so when the world finds you, you&apos;re ready.
            </p>
            <p className="mb-8 text-sm text-muted-foreground/70 md:text-base">
              Clear paths. Daily actions. Real progress.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-gray-900 px-8 text-base font-semibold text-white transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                style={{
                  background: "linear-gradient(135deg, #111111, #1a1a1a)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, #111111, #2a2a2a)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, #111111, #1a1a1a)";
                }}
              >
                Start Growing as an Expert
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background px-8 text-base font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Explore the Expert Path →
              </Link>
            </div>
          </div>

          {/* Archemetes - bottom-right, subtle presence */}
          {!archemetesError && (
            <div className="absolute bottom-[-50px] right-[-80px] hidden md:block pointer-events-none z-10">
              <div className="relative w-32 h-40 md:w-40 md:h-48 lg:w-48 lg:h-56">
                <Image
                  src="/archy/hero.png"
                  alt=""
                  fill
                  className="object-contain object-bottom-right"
                  style={{ opacity: 0.85 }}
                  onError={() => {
                    setArchemetesError(true);
                  }}
                  priority={false}
                />
                {/* Optional: "Let's take the first step." text near Archemetes */}
                <div
                  className="absolute -bottom-6 right-5 text-xs italic text-muted-foreground/50 whitespace-nowrap"
                  style={{ opacity: 0.5 }}
                >
                  Let&apos;s take the first step.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
