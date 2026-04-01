import { DEFAULT_TIERS } from "@/lib/consts";

export default function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex gap-2">
        {DEFAULT_TIERS.map(({ color }, i) => (
          <div
            key={color}
            className="h-4 w-4 rounded-sm animate-pulse"
            style={{
              backgroundColor: color,
              animationDelay: `${i * 150}ms`,
              animationDuration: "900ms",
            }}
          />
        ))}
      </div>
    </div>
  );
}
