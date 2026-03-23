/* Custom loader from Uiverse.io by cohencoo — adapted to JSX */

const style = `
  .custom-loader {
    width: 70px;
    height: 70px;
    background: #ffa600;
    border-radius: 50px;
    -webkit-mask:
      radial-gradient(circle 31px at 50% calc(100% + 13px), #000 95%, #0000) top 4px left 50%,
      radial-gradient(circle 31px, #000 95%, #0000) center,
      radial-gradient(circle 31px at 50% -13px, #000 95%, #0000) bottom 4px left 50%,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    -webkit-mask-repeat: no-repeat;
    animation: cu10 2.5s infinite;
  }

  @keyframes cu10 {
    0%      { -webkit-mask-size: 0    18px, 0    18px, 0    18px, auto }
    16.67%  { -webkit-mask-size: 100% 18px, 0    18px, 0    18px, auto }
    33.33%  { -webkit-mask-size: 100% 18px, 100% 18px, 0    18px, auto }
    50%     { -webkit-mask-size: 100% 18px, 100% 18px, 100% 18px, auto }
    66.67%  { -webkit-mask-size: 0    18px, 100% 18px, 100% 18px, auto }
    83.33%  { -webkit-mask-size: 0    18px, 0    18px, 100% 18px, auto }
    100%    { -webkit-mask-size: 0    18px, 0    18px, 0    18px, auto }
  }
`;

/**
 * ProgressBar — animated loader using the custom CSS mask animation.
 *
 * Props:
 *  - color   {string}  Loader fill colour. Default: '#ffa600'
 *  - size    {number}  Width & height in px. Default: 70
 *  - label   {string}  Optional text shown below the loader
 */
export default function ProgressBar({ color = '#ffa600', size = 70, label }) {
  return (
    <>
      <style>{style}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div
          className="custom-loader"
          style={{
            width: size,
            height: size,
            background: color,
          }}
        />
        {label && (
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#a1a1aa',
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </>
  );
}