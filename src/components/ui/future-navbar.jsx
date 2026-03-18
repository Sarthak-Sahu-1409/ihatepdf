import React, { useRef, useEffect, useState, createContext } from "react";
import { setupSvgRenderer } from "@left4code/svg-renderer";
import { Link } from "react-router-dom";
import { Github, Zap } from "lucide-react";

// ----------------------------------------------------------------------------
// FRAME COMPONENT
// ----------------------------------------------------------------------------
function Frame({
  className,
  paths,
  enableBackdropBlur,
  enableViewBox,
  style,
  ...props
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && svgRef.current.parentElement) {
      const instance = setupSvgRenderer({
        el: svgRef.current,
        paths,
        enableBackdropBlur,
        enableViewBox,
      });

      return () => instance.destroy();
    }
  }, [paths, enableViewBox, enableBackdropBlur]);

  return (
    <svg
      {...props}
      style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', ...style }}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      ref={svgRef}
    />
  );
}

// ----------------------------------------------------------------------------
// BUTTON COMPONENT
// ----------------------------------------------------------------------------
const COLORS = {
  default: {
    stroke1: "#4f46e5",
    fill1: "rgba(79,70,229,0.22)",
    stroke2: "#4f46e5",
    fill2: "rgba(79,70,229,0.1)",
    text: "#ffffff",
  },
};

function FutureButton({
  className,
  children,
  shape = "default",
  enableBackdropBlur = false,
  enableViewBox = false,
  customPaths,
  textColor,
  style,
  ...props
}) {
  const colors = COLORS.default;

  return (
    <button
      {...props}
      style={{
        color: textColor || colors.text,
        border: 'none',
        background: 'transparent',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
        position: 'relative',
        padding: shape === "simple" ? "0.5rem 1.5rem 0.5rem 2rem" : "0.5rem 2rem",
        cursor: 'pointer',
        transition: 'all 0.2s',
        outline: 'none',
        ...style
      }}
      className={`group ${className || ""}`}
    >
      <div style={{ position: 'absolute', inset: 0, marginBottom: '-0.5rem' }}>
        {!customPaths && (shape === "default" || shape === "flat") && (
          <Frame
            enableBackdropBlur={enableBackdropBlur}
            enableViewBox={enableViewBox}
            paths={[
              {
                show: true,
                style: { strokeWidth: "1", stroke: colors.stroke1, fill: colors.fill1 },
                path: [
                  ["M", "17", "0"],
                  ["L", "100% - 7", "0"],
                  ["L", "100% + 0", "0% + 9.5"],
                  ["L", "100% - 18", "100% - 6"],
                  ["L", "4", "100% - 6"],
                  ["L", "0", "100% - 15"],
                  ["L", "17", "0"],
                ],
              },
              {
                show: true,
                style: { strokeWidth: "1", stroke: colors.stroke2, fill: colors.fill2 },
                path: [
                  ["M", "9", "100% - 6"],
                  ["L", "100% - 22", "100% - 6"],
                  ["L", "100% - 25", "100% + 0"],
                  ["L", "12", "100% + 0"],
                  ["L", "9", "100% - 6"],
                ],
              },
            ]}
          />
        )}

        {!customPaths && shape === "simple" && (
          <Frame
            enableBackdropBlur={enableBackdropBlur}
            enableViewBox={enableViewBox}
            paths={[
              {
                show: true,
                style: { strokeWidth: "1", stroke: colors.stroke1, fill: colors.fill1 },
                path: [
                  ["M", "17", "0"],
                  ["L", "100% - 0", "0"],
                  ["L", "100% - 0", "100% - 6"],
                  ["L", "0% + 3", "100% - 6"],
                  ["L", "0% - 0", "100% - 16"],
                  ["L", "17", "0"],
                ],
              },
              {
                show: true,
                style: { strokeWidth: "1", stroke: colors.stroke2, fill: colors.fill2 },
                path: [
                  ["M", "8", "100% - 6"],
                  ["L", "100% - 5", "100% - 6"],
                  ["L", "100% - 7", "100% - 0"],
                  ["L", "10", "100% - 0"],
                  ["L", "8", "100% - 6"],
                ],
              },
            ]}
          />
        )}

        {customPaths?.map((customPath, i) => (
          <Frame key={i} paths={JSON.parse(customPath)} />
        ))}
      </div>
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
        {children}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// NAVBAR COMPONENT
// ----------------------------------------------------------------------------
export const MobileMenuContext = createContext({
  showMenu: true,
  setShowMenu: () => {},
});

export default function FutureNavbar() {
  const [showMenu, setShowMenu] = useState(false);

  // 🎨 Direct color constants
  const primaryStroke = "#4f46e5"; // Indigo
  const primaryFill = "rgba(79, 70, 229, 0.2)";

  return (
    <MobileMenuContext.Provider value={{ showMenu, setShowMenu }}>
      {/* Mini-stylesheet to substitute Tailwind classes safely */}
      <style>{`
        .fn-container {
          height: 4rem; margin-top: 0.5rem; margin-left: 0.5rem; margin-right: 0.5rem;
          display: flex; width: calc(100% - 1rem); position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
        }
        .fn-shadow { filter: drop-shadow(0 25px 25px rgba(0,0,0,0.5)); }
        .fn-hidden { display: none !important; }
        
        @media (min-width: 1024px) {
          .fn-container {
            margin-top: -1px; margin-left: -1px; margin-right: -1px; width: calc(100% + 2px);
          }
          .lg-block { display: block !important; }
          .lg-flex { display: flex !important; }
          .lg-w-auto { width: auto !important; }
        }
      `}</style>
      
      <div className="fn-container">
        
        {/* Left Edge Graphic (Hidden on mobile) */}
        <div className="fn-hidden lg-block" style={{ width: '100%', height: '100%', position: 'relative', marginRight: '-11px' }}>
          <Frame
            className="fn-shadow"
            paths={[
              {
                show: true,
                style: { strokeWidth: "1", stroke: primaryStroke, fill: "rgba(79,70,229,0.08)" },
                path: [["M", "0", "0"], ["L", "100% - 6", "0"], ["L", "100% - 11", "100% - 64"], ["L", "100% + 0", "0% + 29"], ["L", "0", "11"], ["L", "0", "0"]]
              },
              {
                show: true,
                style: { strokeWidth: "1", stroke: `${primaryStroke}38`, fill: "transparent" },
                path: [["M", "0", "14"], ["L", "100% - 7", "33"]]
              }
            ]}
          />
        </div>

        {/* Center Main Nav Body */}
        <div style={{ display: 'flex', height: '100%', position: 'relative', flex: 'none', width: '100%' }} className="lg-w-auto">
          {/* Main nav logo + links area */}
          <div style={{ flex: 'none', height: '100%', padding: '0 3.5rem', position: 'relative', width: '100%' }} className="lg-w-auto">
            <Frame
              enableBackdropBlur
              className="fn-shadow"
              paths={[
                {
                  show: true,
                  style: { strokeWidth: "1", stroke: primaryStroke, fill: primaryFill },
                  path: [["M", "6", "0"], ["L", "100% - 6.5", "0"], ["L", "100% + 0", "0% + 9"], ["L", "100% - 28", "100% - 15"], ["L", "162", "100% - 15"], ["L", "164", "100% - 30"], ["L", "153", "100% - 15"], ["L", "27", "100% - 15"], ["L", "0", "0% + 8"], ["L", "6", "0"]]
                },
                {
                  show: true,
                  style: { strokeWidth: "1", stroke: `${primaryStroke}91`, fill: "transparent" },
                  path: [["M", "32", "100% - 15"], ["L", "0% + 152.5", "100% - 15"], ["L", "0% + 163.5", "100% - 29"], ["L", "0% + 161.5", "100% - 15"], ["L", "100% - 32.5", "100% - 15"], ["L", "100% - 36.5", "100% - 7"], ["L", "0% + 163.5", "100% - 7"], ["L", "0% + 165.5", "100% - 23"], ["L", "0% + 152.5", "100% - 7"], ["L", "37", "100% - 7"], ["L", "32", "100% - 15"]]
                },
                {
                  show: true,
                  style: { strokeWidth: "1", stroke: `${primaryStroke}3B`, fill: "transparent" },
                  path: [["M", "0", "0% + 33"], ["M", "4", "0% + 33"], ["L", "0% + 18.5", "100% - 12"], ["L", "0% + 23.5", "100% - 12"], ["L", "29", "100% + 0"], ["L", "155", "100% - 0"], ["L", "160", "100% - 8"], ["L", "161", "100% - 0"], ["L", "100% - 28", "100% + 0"], ["L", "100% - 23", "100% - 11"], ["L", "100% - 17", "100% - 11"], ["L", "100% - 14", "100% - 14"], ["L", "100% + 0", "100% - 14"]]
                }
              ]}
            />
            
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.625rem', position: 'relative' }}>
              <Link to="/" style={{ marginRight: '4rem', fontWeight: 'bold', textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e2e8f0', letterSpacing: '-0.02em', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>&lt;/IHatePDF&gt;</span>
              </Link>
              
              <div className="fn-hidden lg-flex" style={{ gap: '2rem', fontWeight: 500 }}>
                <a href="#features" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Features</a>
                <a href="#tools" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Tools</a>
              </div>
              
              <div
                onClick={() => setShowMenu(true)}
                className="fn-hidden" /* Mobile menu trigger is hidden, using lg-flex equivalent for mobile is complex, falling back to simple logic */
                style={{ cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, color: 'white' }}
              >
                <Zap size={16} />
                Menu
              </div>
            </div>
          </div>

          {/* Right End Graphic & Search (Hidden on Mobile) */}
          <div className="fn-hidden lg-flex" style={{ width: '100%', position: 'relative', marginLeft: '-25px', justifyContent: 'flex-end', paddingRight: '2rem' }}>
            <Frame
              enableBackdropBlur
              className="fn-shadow"
              paths={[
                {
                  show: true,
                  style: { strokeWidth: "1", stroke: `${primaryStroke}80`, fill: "rgba(79,70,229,0.1)" },
                  path: [["M", "19", "0"], ["L", "100% - 5", "0"], ["L", "100% + 0", "0% + 7"], ["L", "100% - 36", "100% - 20"], ["L", "0", "100% - 20"], ["L", "25", "8.999992370605469"], ["L", "19", "1"]]
                },
                {
                  show: true,
                  style: { strokeWidth: "1", stroke: `${primaryStroke}3B`, fill: "transparent" },
                  path: [["M", "25", "100% - 14"], ["L", "100% - 32", "100% - 13"], ["L", "100% - 15", "36"]]
                }
              ]}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '-0.875rem' }}>
              {/* Note: I'm converting the Search box to just a direct link to #tools as this app doesn't have docs/search yet */}
              <a href="#tools" style={{ textDecoration: 'none' }}>
                <FutureButton shape="flat" style={{ padding: '0.45rem 2.25rem', fontSize: '0.75rem', fontWeight: 'normal', color: 'white' }}>
                  <div style={{ display: 'flex', gap: '2.5rem' }}>
                    <span>Launch App</span>
                    <span>→</span>
                </div>
                </FutureButton>
              </a>
              <a target="_blank" href="https://github.com/Sarthak-Sahu-1409/ihatepdf" style={{ marginLeft: '4px', textDecoration: 'none' }}>
                <FutureButton shape="flat" style={{ padding: '0.45rem 1.5rem' }}>
                  <Github size={16} />
                </FutureButton>
              </a>
            </div>
          </div>
        </div>
        
        {/* Right Edge Tip Graphic (Hidden on mobile) */}
        <div className="fn-hidden lg-block" style={{ width: '100%', height: '100%', position: 'relative', marginLeft: '-18px' }}>
          <Frame
            paths={[
              {
                show: true,
                style: { strokeWidth: "1", stroke: `${primaryStroke}E6`, fill: "rgba(79,70,229,0.08)" },
                path: [["M", "12", "0"], ["L", "100% + 0", "0"], ["L", "100% + 0", "0% + 16"], ["L", "0", "100% - 42"], ["L", "18", "7"], ["L", "12", "0"]]
              },
              {
                show: true,
                style: { strokeWidth: "1", stroke: `${primaryStroke}3B`, fill: "transparent" },
                path: [["M", "3", "100% - 36"], ["L", "100% + 0", "20"]]
              }
            ]}
          />
        </div>
      </div>
    </MobileMenuContext.Provider>
  );
}
