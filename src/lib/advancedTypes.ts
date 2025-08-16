// Shared advanced bill generator types

export interface SubElement {
  id: string;
  type: "text" | "caption";
  content: string;
  position: "top" | "bottom" | "left" | "right";
  offsetX: number;
  offsetY: number;
  fontSize: number;
  textColor: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface TemplateField {
  id: string;
  label: string;
  value: string;
  type:
    | "text"
    | "number"
    | "date"
    | "amount"
    | "textarea"
    | "select"
    | "image"
    | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  alignment: "left" | "center" | "right";
  placeholder?: string;
  options?: string[];
  required: boolean;
  lockAspect?: boolean; // maintain aspect ratio during resize for image/signature
  subElements?: SubElement[]; // additional text elements like labels, captions
}

export interface Template {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  createdAt: Date;
  fields: TemplateField[];
}
