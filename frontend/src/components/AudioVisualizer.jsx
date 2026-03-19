export default function AudioVisualizer({ isActive }) {
  const bars = 20;

  return (
    <div className="flex items-center justify-center gap-[2px] h-12">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-white transition-all duration-150"
          style={{
            height: isActive ? `${Math.random() * 36 + 6}px` : "4px",
            opacity: isActive ? 0.4 + Math.random() * 0.6 : 0.15,
            animation: isActive
              ? `soundWave ${0.8 + Math.random() * 0.8}s ease-in-out ${Math.random() * 0.5}s infinite`
              : "none",
          }}
        />
      ))}
    </div>
  );
}
