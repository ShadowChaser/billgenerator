"use client";
import { useState, useCallback } from "react";
import { CanvasRenderer } from "./CanvasRenderer";

interface EditorCanvasProps {
  template: any;
  isEditing: boolean;
  zoom: number;
  onUpdateTemplate?: (template: any) => void;
}

export function EditorCanvas({ template, isEditing, zoom, onUpdateTemplate }: EditorCanvasProps) {
  const [selectedField, setSelectedField] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const getMousePos = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const hitTest = useCallback((x: number, y: number) => {
    if (!template?.fields) return null;
    for (let i = template.fields.length - 1; i >= 0; i--) {
      const field = template.fields[i];
      if (x >= field.x && x <= field.x + field.width && 
          y >= field.y && y <= field.y + field.height) {
        return field;
      }
    }
    return null;
  }, [template]);

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !template) return;
    const { x, y } = getMousePos(event);
    const field = hitTest(x, y);
    
    if (field) {
      setSelectedField(field);
      setIsDragging(true);
      setDragOffset({ x: x - field.x, y: y - field.y });
    } else {
      setSelectedField(null);
    }
  }, [isEditing, template, getMousePos, hitTest]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !template || !isDragging || !selectedField) return;
    const { x: curX, y: curY } = getMousePos(event);
    
    const nx = curX - dragOffset.x;
    const ny = curY - dragOffset.y;
    
    const constrainedX = Math.max(0, Math.min(nx, template.width - selectedField.width));
    const constrainedY = Math.max(0, Math.min(ny, template.height - selectedField.height));
    
    if (selectedField.x !== constrainedX || selectedField.y !== constrainedY) {
      const updatedField = { ...selectedField, x: constrainedX, y: constrainedY };
      const updatedFields = template.fields.map((f: any) => 
        f.id === selectedField.id ? updatedField : f
      );
      const updatedTemplate = { ...template, fields: updatedFields };
      
      if (onUpdateTemplate) {
        onUpdateTemplate(updatedTemplate);
      }
      setSelectedField(updatedField);
    }
  }, [isEditing, template, isDragging, selectedField, getMousePos, dragOffset, onUpdateTemplate]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <CanvasRenderer
      template={template}
      selectedField={selectedField}
      zoom={zoom}
      isEditing={isEditing}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
    />
  );
}
