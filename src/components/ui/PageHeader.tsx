interface PageHeaderProps {
  title: string;
  subtitle?: string;
  particleCount?: number;
}

export function PageHeader({
  title,
  subtitle,
  particleCount = 20,
}: PageHeaderProps) {
  return (
    <div className="relative mb-8 py-12 bg-gradient-to-b from-black via-gray-900 to-orange-900 text-white overflow-hidden">
      {/* Particle effects */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: particleCount }, (_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-orange-400 rounded-full opacity-40 animate-pulse"
            style={{
              left: `${(i * 7.3) % 100}%`,
              top: `${(i * 11.7) % 100}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-montserratBold mb-2">
          {title}
        </h1>
        {subtitle && <p className="text-lg text-gray-200 mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}
