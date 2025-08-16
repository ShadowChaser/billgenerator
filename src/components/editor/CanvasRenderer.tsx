"use client";
import { useRef, useEffect, useCallback } from "react";

interface CanvasRendererProps {
  template: any;
  selectedField: any;
  zoom: number;
  isEditing: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
}

export function CanvasRenderer({
  template,
  selectedField,
  zoom,
  isEditing,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderTemplateToCanvas = useCallback((canvas: HTMLCanvasElement, template: any) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = template.width;
    canvas.height = template.height;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, template.width, template.height);
    
    template.fields.forEach((field: any) => {
      ctx.fillStyle = field.backgroundColor || 'transparent';
      ctx.fillRect(field.x, field.y, field.width, field.height);
      
      if (field.borderWidth > 0) {
        ctx.strokeStyle = field.borderColor || '#000';
        ctx.lineWidth = field.borderWidth;
        ctx.strokeRect(field.x, field.y, field.width, field.height);
      }
      
      ctx.fillStyle = field.textColor || '#000';
      ctx.font = `${field.isBold ? 'bold ' : ''}${field.fontSize}px ${field.fontFamily || 'Arial'}`;
      ctx.textAlign = field.alignment || 'left';
      
      const text = field.value || field.placeholder || field.label || '';
      const textX = field.alignment === 'center' ? field.x + field.width / 2 : 
                   field.alignment === 'right' ? field.x + field.width - 5 : field.x + 5;
      const textY = field.y + field.fontSize + 5;
      
      ctx.fillText(text, textX, textY);
      
      // Highlight selected field
      if (selectedField && selectedField.id === field.id) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(field.x - 2, field.y - 2, field.width + 4, field.height + 4);
        ctx.setLineDash([]);
      }
    });
  }, [selectedField]);

  useEffect(() => {
    if (isEditing && template && canvasRef.current) {
      renderTemplateToCanvas(canvasRef.current, template);
    }
  }, [isEditing, template, selectedField, renderTemplateToCanvas]);

  if (!isEditing || !template) return null;

  return (
    <canvas
      ref={canvasRef}
      width={template.width}
      height={template.height}
      className="border border-gray-300 cursor-crosshair"
      style={{
        width: `${template.width}px`,
        height: `${template.height}px`,
        backgroundColor: '#fff'
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    />
  );
}
