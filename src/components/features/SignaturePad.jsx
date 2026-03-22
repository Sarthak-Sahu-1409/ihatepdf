import { useRef, useState, useEffect } from 'react';

// Input: penColor (stroke), onSignatureComplete, optional showClearButton.
// Renders a canvas signature pad; stroke color follows penColor for every new stroke.

export default function SignaturePad({
  penColor = '#0A0A0A',
  onSignatureComplete,
  showClearButton = true,
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [penColor]);

  const pointerPos = (e, rect) => {
    const t = e.touches?.[0];
    const x = t ? t.clientX : e.clientX;
    const y = t ? t.clientY : e.clientY;
    return { x: x - rect.left, y: y - rect.top };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const { x, y } = pointerPos(e, rect);
    ctx.strokeStyle = penColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const { x, y } = pointerPos(e, rect);
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (hasSignature) {
      const canvas = canvasRef.current;
      onSignatureComplete(canvas.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureComplete(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="border-2 border-gray-300 rounded-lg cursor-crosshair w-full"
        style={{ touchAction: 'none' }}
      />
      {showClearButton && (
        <button
          type="button"
          onClick={clear}
          className="mt-2 text-sm text-gray-600 hover:text-primary"
        >
          Clear Signature
        </button>
      )}
    </div>
  );
}