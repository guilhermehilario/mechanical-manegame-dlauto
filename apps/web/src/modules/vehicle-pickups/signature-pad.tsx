import { useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

/**
 * Simple mouse/touch signature pad (Fase 7). Emits a base64 PNG data URL of
 * the strokes, or null when cleared. Purely presentational — no crypto, no
 * legal claims; the receipt stores it as evidence only.
 */
export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Fix for HiDPI screens: scale the backing store by devicePixelRatio.
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>): void {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointFrom(event);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  }

  function endDraw(): void {
    drawing.current = false;
    emit();
  }

  function clear(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(null);
  }

  function emit(): void {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) {
      onChange(null);
      return;
    }
    onChange(canvas.toDataURL('image/png'));
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-32 w-full cursor-crosshair touch-none rounded-md border border-dashed border-slate-300 bg-slate-50"
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-slate-500 hover:underline"
        >
          Limpar assinatura
        </button>
      </div>
    </div>
  );
}
