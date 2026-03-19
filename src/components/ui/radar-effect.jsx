"use client";
import { motion } from "framer-motion";
import React from "react";
import { GlowingEffect } from "./glowing-effect";

export const Circle = ({ className, children, idx, style: extraStyle, ...rest }) => {
  return (
    <motion.div
      {...rest}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: idx * 0.1, duration: 0.2 }}
      style={{
        position: 'absolute',
        inset: 0,
        left: '50%',
        top: '50%',
        height: '2.5rem',
        width: '2.5rem',
        transform: 'translate(-50%, -50%)',
        borderRadius: '9999px',
        border: '1px solid rgb(229, 229, 229)',
        ...extraStyle,
      }}
    />
  );
};

export const Radar = ({ style: extraStyle }) => {
  const circles = new Array(8).fill(1);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        height: '5rem',
        width: '5rem',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        ...extraStyle,
      }}
    >
      <style>{`
        @keyframes radar-spin {
          from { transform: rotate(20deg); }
          to   { transform: rotate(380deg); }
        }
        .animate-radar-spin {
          animation: radar-spin 10s linear infinite;
        }
      `}</style>
      {/* Rotating sweep line */}
      <div
        style={{
          transformOrigin: 'right center',
          position: 'absolute',
          right: '50%',
          top: '50%',
          zIndex: 40,
          display: 'flex',
          height: '5px',
          width: '400px',
          alignItems: 'flex-end',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'transparent',
        }}
        className="animate-radar-spin"
      >
        <div style={{
          position: 'relative',
          zIndex: 40,
          height: '1px',
          width: '100%',
          background: 'linear-gradient(to right, transparent, #0284c7, transparent)',
        }} />
      </div>
      {/* Concentric circles */}
      {circles.map((_, idx) => (
        <Circle
          style={{
            height: `${(idx + 1) * 5}rem`,
            width: `${(idx + 1) * 5}rem`,
            border: `1px solid rgba(148, 163, 184, ${0.35 - idx * 0.02})`,
          }}
          key={`circle-${idx}`}
          idx={idx}
        />
      ))}
    </div>
  );
};

export const IconContainer = ({ icon, text, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: delay ?? 0 }}
      style={{
        position: 'relative',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}
    >
      <div style={{
        position: 'relative',
        display: 'flex',
        height: '4.5rem',
        width: '4.5rem',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '1.25rem',
        border: '1px solid rgb(51, 65, 85)',
        background: 'rgb(30, 41, 59)',
        boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)',
      }}>
        <GlowingEffect
          spread={60}
          glow={true}
          disabled={false}
          proximity={96}
          inactiveZone={0.01}
          borderWidth={4.5}
          movementDuration={1.4}
        />
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon ? React.cloneElement(icon, { style: { ...icon.props?.style, width: '2.5rem', height: '2.5rem' }}) : (
            <svg style={{ height: '2.5rem', width: '2.5rem', color: 'rgb(71, 85, 105)' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      <div className="radar-label" style={{ borderRadius: '0.375rem', padding: '0.25rem 0.5rem' }}>
        <div style={{
          textAlign: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'rgb(148, 163, 184)',
        }}>
          {text || "Web Development"}
        </div>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .radar-label { display: none; }
        }
      `}</style>
    </motion.div>
  );
};
