import React, { useState } from "react";
import { Lock, Zap, Globe } from "lucide-react";
import { GlowingEffect } from "./glowing-effect";

// Native pure-JS class helper to avoid Tailwind cn dependency
const cn = (...classes) => classes.filter(Boolean).join(" ");

function GlowingCard({ item, index, isExpanded }) {
  return (
    <div 
      className={cn(
        "park_sec", 
        `park_sec${index + 1}`,
        isExpanded && "active"
      )}
      style={{
        border: '1px solid rgb(51, 65, 85)',
        background: 'rgb(30, 41, 59)',
        boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)'
      }}
    >
      <GlowingEffect
        spread={60}
        glow={true}
        disabled={false}
        proximity={96}
        inactiveZone={0.01}
        borderWidth={3}
        movementDuration={1.4}
      />
      <div className="park_inside">
        <span className="img" style={{ backgroundColor: item.color }}>
          {item.icon}
        </span>
        <div className="content_sec">
          <h2>{item.activity}</h2>
          <span>{item.location}</span>
        </div>
      </div>
    </div>
  );
}

export const StackedCards = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpand = () => setIsExpanded(!isExpanded);

  const activities = [
    {
      id: 1,
      activity: "100% Private",
      location: "End-to-end encrypted",
      icon: <Lock size={22} color="#fff" />,
      color: "#8b5cf6" // Purple
    },
    {
      id: 2,
      activity: "WASM Powered",
      location: "Lightning fast processing",
      icon: <Zap size={22} color="#fff" />,
      color: "#f59e0b" // Amber
    },
    {
      id: 3,
      activity: "Works Offline",
      location: "No internet required",
      icon: <Globe size={22} color="#fff" />,
      color: "#10b981" // Emerald
    }
  ];

  return (
    <div className="stacked-cards-container">
      <div className={cn("inner_container", isExpanded && "active-container")}>
        {activities.map((item, index) => (
          <GlowingCard 
            key={item.id}
            item={item}
            index={index}
            isExpanded={isExpanded}
          />
        ))}
      </div>
      
      <div className="btn_grp">
        <button 
          className={cn("btn", isExpanded && "active")} 
          onClick={toggleExpand}
        >
          {isExpanded ? "Hide Features" : "Show All"}
        </button>
      </div>

      <style>{`
        .shader-container-exploded canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          border-radius: 19px !important;
        }
        .stacked-cards-container {
          position: relative;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 5px 0 0px 0;
        }
        
        .inner_container {
          position: relative;
          width: 100%;
          max-width: 980px;
          height: 110px;
          transition: height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .park_sec {
          position: absolute;
          left: 50%;
          width: 100%;
          max-width: 310px;
          height: 78px;
          padding: 16px 20px;
          border-radius: 20px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          background: transparent;
          box-shadow: 0px 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.05);
          transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease;
        }
        
        .park_sec1 {
          z-index: 3;
          transform: translate(-50%, 14px) scale(1);
        }
        .park_sec2 {
          z-index: 2;
          transform: translate(-50%, 0px) scale(0.95);
        }
        .park_sec3 {
          z-index: 1;
          transform: translate(-50%, -14px) scale(0.9);
        }
        
        .park_sec1.active {
          transform: translate(calc(-150% - 16px), 0) scale(1);
          z-index: 1; 
        }
        .park_sec2.active {
          transform: translate(-50%, 0) scale(1) !important;
          z-index: 1; 
        }
        .park_sec3.active {
          transform: translate(calc(50% + 16px), 0) scale(1);
          z-index: 1; 
        }
        
        .park_inside {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          z-index: 2;
        }
        
        .img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          flex-shrink: 0;
        }
        
        .content_sec {
          margin-left: 14px;
          text-align: left;
        }
        .content_sec h2 {
          margin: 0 0 2px 0;
          font-size: 15px;
          font-weight: 600;
          color: #f8fafc;
          line-height: 1.2;
        }
        .content_sec span {
          color: #94a3b8;
          font-size: 13px;
          font-weight: 500;
        }
        
        .btn_grp {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          margin-top: 15px;
          transition: margin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .btn {
          position: relative;
          padding: 8px 38px 8px 22px;
          background: #1e293b;
          color: #e2e8f0;
          border-radius: 20px;
          border: 1px solid #334155;
          box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.4);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn:hover {
          transform: translateY(-2px);
          background: #334155;
          box-shadow: 0px 6px 15px rgba(0, 0, 0, 0.5);
        }
        
        .btn::after {
          position: absolute;
          content: "";
          border-top: 2px solid #94a3b8;
          border-left: 2px solid #94a3b8;
          width: 6px;
          height: 6px;
          right: 20px;
          top: 13px;
          transform: rotate(225deg);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn.active::after {
          transform: rotate(45deg);
          top: 16px;
        }
        
        @media (max-width: 800px) {
           .inner_container.active-container {
             height: 310px;
           }
           .park_sec1.active { transform: translate(-50%, 0) scale(1); }
           .park_sec2.active { transform: translate(-50%, 96px) scale(1) !important; }
           .park_sec3.active { transform: translate(-50%, 192px) scale(1); }
        }
      `}</style>
    </div>
  );
};
