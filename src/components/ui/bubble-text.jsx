import React, { useState } from "react";

export const BubbleText = ({ text = "Bubbbbbbbble text", className = "", style = {} }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <h2
      onMouseLeave={() => setHoveredIndex(null)}
      className={className}
      style={style}
    >
      {text.split("").map((char, idx) => {
        const distance = hoveredIndex !== null ? Math.abs(hoveredIndex - idx) : null;
        
        let classes = "transition-all duration-300 ease-in-out cursor-default inline-block";
        let inlineStyles = { display: "inline-block" };
        
        switch (distance) {
          case 0:
            inlineStyles.fontWeight = 900;
            inlineStyles.color = "white";
            inlineStyles.transform = "scale(1.15)";
            inlineStyles.textShadow = "0 0 20px rgba(129,140,248,0.7)";
            break;
          case 1:
            inlineStyles.fontWeight = 900;
            inlineStyles.color = "#818cf8";
            inlineStyles.transform = "scale(1.08)";
            inlineStyles.textShadow = "0 0 10px rgba(129,140,248,0.3)";
            break;
          case 2:
            inlineStyles.fontWeight = 800;
            inlineStyles.color = "#818cf8";
            inlineStyles.opacity = 0.9;
            inlineStyles.transform = "scale(1.03)";
            break;
          default:
            inlineStyles.fontWeight = 700;
            inlineStyles.color = "#818cf8";
            inlineStyles.opacity = 0.8;
            inlineStyles.transform = "scale(1)";
            break;
        }

        return (
          <span
            key={idx}
            onMouseEnter={() => setHoveredIndex(idx)}
            className={classes}
            style={inlineStyles}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </h2>
  );
};
