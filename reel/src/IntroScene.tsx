import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, sans, serif } from "./theme";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const arabic = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const line = interpolate(frame, [15, 40], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.cream,
        justifyContent: "center",
        alignItems: "center",
        color: colors.ink,
      }}
    >
      <div
        style={{
          fontFamily: serif,
          fontSize: 132,
          lineHeight: 1.05,
          textAlign: "center",
          opacity: rise,
          transform: `translateY(${(1 - rise) * 60}px)`,
        }}
      >
        New
        <br />
        Collection
      </div>
      <div style={{ width: line, height: 4, backgroundColor: colors.caramel, margin: "48px 0" }} />
      <div
        dir="rtl"
        style={{
          fontFamily: sans,
          fontWeight: 700,
          fontSize: 96,
          opacity: arabic,
          transform: `translateY(${(1 - arabic) * 60}px)`,
        }}
      >
        وصل جديد
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 160,
          fontFamily: sans,
          fontWeight: 500,
          fontSize: 44,
          letterSpacing: 8,
          textTransform: "uppercase",
          opacity: arabic,
        }}
      >
        Shop With Sask
      </div>
    </AbsoluteFill>
  );
};
