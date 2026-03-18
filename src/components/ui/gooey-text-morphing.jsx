import React, { useRef, useEffect } from "react";

export function GooeyText({
  texts,
  morphTime = 1,
  cooldownTime = 2,
}) {
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);

  useEffect(() => {
    let textIndex = texts.length - 1;
    let time = new Date();
    let morph = 0;
    let cooldown = cooldownTime;

    const setMorph = (fraction) => {
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

        fraction = 1 - fraction;
        text1Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        text1Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => {
      morph = 0;
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = "";
        text2Ref.current.style.opacity = "100%";
        text1Ref.current.style.filter = "";
        text1Ref.current.style.opacity = "0%";
      }
    };

    const doMorph = () => {
      morph -= cooldown;
      cooldown = 0;
      let fraction = morph / morphTime;

      if (fraction > 1) {
        cooldown = cooldownTime;
        fraction = 1;
      }

      setMorph(fraction);
    };

    let animationFrameId;
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      const newTime = new Date();
      const shouldIncrementIndex = cooldown > 0;
      const dt = (newTime.getTime() - time.getTime()) / 1000;
      time = newTime;

      cooldown -= dt;

      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          textIndex = (textIndex + 1) % texts.length;
          if (text1Ref.current && text2Ref.current) {
            text1Ref.current.textContent = texts[textIndex % texts.length];
            text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
          }
        }
        doMorph();
      } else {
        doCooldown();
      }
    }

    animate();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [texts, morphTime, cooldownTime]);

  // Find the longest text so the placeholder can enforce the correct container width.
  const longestText = texts.reduce((a, b) => (a.length > b.length ? a : b), "");

  // Modern, clean solid color. Gradients and drop-shadows look jagged and artifact-heavy 
  // when passed through the SVG alpha-threshold feColorMatrix filter.
  const textStyle = {
    color: '#818cf8', // Modern electric indigo
    fontWeight: 900 // perfectly match hero text font weight
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg style={{ position: "absolute", height: 0, width: 0 }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="threshold">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: "url(#threshold)",
          position: "relative",
          paddingBottom: "8px", // Gives the morph drop shadow some breathing room
        }}
      >
        {/* Invisible structural placeholder to prevent container size collapse */}
        <span style={{ visibility: "hidden", pointerEvents: "none", userSelect: "none", ...textStyle }}>
          {longestText}
        </span>
        
        {/* Morphed Absolute Spans */}
        <span
          ref={text1Ref}
          style={{
            position: "absolute",
            display: "inline-block",
            whiteSpace: "nowrap",
            userSelect: "none",
            textAlign: "center",
            ...textStyle
          }}
        />
        <span
          ref={text2Ref}
          style={{
            position: "absolute",
            display: "inline-block",
            whiteSpace: "nowrap",
            userSelect: "none",
            textAlign: "center",
            ...textStyle
          }}
        />
      </div>
    </div>
  );
}
