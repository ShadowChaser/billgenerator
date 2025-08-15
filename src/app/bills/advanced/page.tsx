"use client";
import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

interface TemplateField {
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
}

interface BillTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  width: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function AdvancedBillGeneratorPage() {
  const [templates, setTemplates] = useState<BillTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<BillTemplate | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(
    null
  );
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [fieldEditorData, setFieldEditorData] = useState<
    Partial<TemplateField>
  >({});
  const [isFieldEditorMode, setIsFieldEditorMode] = useState<"create" | "edit">(
    "create"
  );
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load saved templates
  useEffect(() => {
    const saved = localStorage.getItem("billTemplates");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTemplates(
          parsed.map((t: any) => ({
            ...t,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          }))
        );
      } catch (error) {
        console.error("Error loading templates:", error);
      }
    }
  }, []);

  const saveTemplates = (newTemplates: BillTemplate[]) => {
    localStorage.setItem("billTemplates", JSON.stringify(newTemplates));
  };

  const createNewTemplate = () => {
    const newTemplate: BillTemplate = {
      id: uuidv4(),
      name: "Advanced Bill Template",
      description: "Professional bill template with advanced features",
      fields: [
        {
          id: uuidv4(),
          label: "Company Logo",
          value: "🏢 COMPANY NAME",
          type: "text",
          x: 50,
          y: 50,
          width: 300,
          height: 60,
          fontSize: 28,
          isBold: true,
          isItalic: false,
          textColor: "#1f2937",
          backgroundColor: "#f3f4f6",
          borderColor: "#d1d5db",
          borderWidth: 2,
          borderRadius: 8,
          alignment: "center",
          required: true,
        },
        {
          id: uuidv4(),
          label: "Bill Title",
          value: "INVOICE",
          type: "text",
          x: 400,
          y: 50,
          width: 200,
          height: 60,
          fontSize: 32,
          isBold: true,
          isItalic: false,
          textColor: "#dc2626",
          backgroundColor: "#fef2f2",
          borderColor: "#fecaca",
          borderWidth: 3,
          borderRadius: 12,
          alignment: "center",
          required: true,
        },
        {
          id: uuidv4(),
          label: "Bill Number",
          value: "INV-2024-001",
          type: "text",
          x: 50,
          y: 150,
          width: 200,
          height: 40,
          fontSize: 16,
          isBold: true,
          isItalic: false,
          textColor: "#1f2937",
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 6,
          alignment: "left",
          required: true,
        },
        {
          id: uuidv4(),
          label: "Amount",
          value: "₹50,000.00",
          type: "amount",
          x: 500,
          y: 380,
          width: 150,
          height: 60,
          fontSize: 24,
          isBold: true,
          isItalic: false,
          textColor: "#059669",
          backgroundColor: "#ecfdf5",
          borderColor: "#a7f3d0",
          borderWidth: 2,
          borderRadius: 8,
          alignment: "center",
          required: true,
        },
      ],
      backgroundColor: "#ffffff",
      textColor: "#1f2937",
      borderColor: "#e5e7eb",
      borderWidth: 2,
      borderRadius: 12,
      width: 800,
      height: 600,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setCurrentTemplate(newTemplate);
    setIsEditing(true);
  };

  const saveTemplate = () => {
    if (!currentTemplate) return;

    const updatedTemplate = {
      ...currentTemplate,
      updatedAt: new Date(),
    };

    const existingIndex = templates.findIndex(
      (t) => t.id === currentTemplate.id
    );

    let newTemplates: BillTemplate[];
    if (existingIndex >= 0) {
      newTemplates = [...templates];
      newTemplates[existingIndex] = updatedTemplate;
    } else {
      newTemplates = [...templates, updatedTemplate];
    }

    setTemplates(newTemplates);
    saveTemplates(newTemplates);
    setIsEditing(false);
    alert("Template saved successfully!");
  };

  const openFieldEditor = (
    field?: TemplateField,
    mode: "create" | "edit" = "create"
  ) => {
    if (mode === "edit" && field) {
      setFieldEditorData({ ...field });
      setSelectedField(field);
    } else {
      setFieldEditorData({
        id: uuidv4(),
        label: "",
        value: "",
        type: "text",
        x: 100,
        y: 100,
        width: 150,
        height: 40,
        fontSize: 16,
        isBold: false,
        isItalic: false,
        textColor: "#000000",
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        borderRadius: 6,
        alignment: "left",
        required: false,
      });
      setSelectedField(null);
    }

    setIsFieldEditorMode(mode);
    setShowFieldEditor(true);
  };

  const saveField = () => {
    if (!currentTemplate || !fieldEditorData.label) return;

    const newField: TemplateField = {
      id: fieldEditorData.id || uuidv4(),
      label: fieldEditorData.label,
      value: fieldEditorData.value || "",
      type: fieldEditorData.type || "text",
      x: fieldEditorData.x || 100,
      y: fieldEditorData.y || 100,
      width: fieldEditorData.width || 150,
      height: fieldEditorData.height || 40,
      fontSize: fieldEditorData.fontSize || 16,
      isBold: fieldEditorData.isBold || false,
      isItalic: fieldEditorData.isItalic || false,
      textColor: fieldEditorData.textColor || "#000000",
      backgroundColor: fieldEditorData.backgroundColor || "#ffffff",
      borderColor: fieldEditorData.borderColor || "#e5e7eb",
      borderWidth: fieldEditorData.borderWidth || 1,
      borderRadius: fieldEditorData.borderRadius || 6,
      alignment: fieldEditorData.alignment || "left",
      placeholder: fieldEditorData.placeholder,
      options: fieldEditorData.options,
      required: fieldEditorData.required || false,
    };

    let newFields: TemplateField[];

    if (isFieldEditorMode === "edit" && selectedField) {
      newFields = currentTemplate.fields.map((f) =>
        f.id === selectedField.id ? newField : f
      );
    } else {
      newFields = [...currentTemplate.fields, newField];
    }

    setCurrentTemplate({
      ...currentTemplate,
      fields: newFields,
      updatedAt: new Date(),
    });

    setShowFieldEditor(false);
    setFieldEditorData({});
    setSelectedField(null);
  };

  const deleteField = (fieldId: string) => {
    if (!currentTemplate) return;

    const newFields = currentTemplate.fields.filter((f) => f.id !== fieldId);
    setCurrentTemplate({
      ...currentTemplate,
      fields: newFields,
      updatedAt: new Date(),
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if clicking on a field
    const clickedField = currentTemplate.fields.find(
      (field) =>
        x >= field.x &&
        x <= field.x + field.width &&
        y >= field.y &&
        y <= field.y + field.height
    );

    if (clickedField) {
      setSelectedField(clickedField);
      setIsDragging(true);
      setDragOffset({
        x: x - clickedField.x,
        y: y - clickedField.y,
      });
    } else {
      setSelectedField(null);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedField || !currentTemplate) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left - dragOffset.x;
    const y = event.clientY - rect.top - dragOffset.y;

    const newFields = currentTemplate.fields.map((f) =>
      f.id === selectedField.id ? { ...f, x, y } : f
    );

    setCurrentTemplate({
      ...currentTemplate,
      fields: newFields,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderTemplate = () => {
    if (!currentTemplate || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background
    ctx.fillStyle = currentTemplate.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = currentTemplate.borderColor;
    ctx.lineWidth = currentTemplate.borderWidth;
    ctx.beginPath();
    ctx.roundRect(
      10,
      10,
      canvas.width - 20,
      canvas.height - 20,
      currentTemplate.borderRadius
    );
    ctx.stroke();

    // Draw fields
    currentTemplate.fields.forEach((field) => {
      // Draw background
      ctx.fillStyle = field.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(
        field.x,
        field.y,
        field.width,
        field.height,
        field.borderRadius
      );
      ctx.fill();

      // Draw border
      ctx.strokeStyle = field.borderColor;
      ctx.lineWidth = field.borderWidth;
      ctx.stroke();

      // Draw text
      ctx.fillStyle = field.textColor;
      ctx.font = `${field.isBold ? "bold" : "normal"} ${
        field.isItalic ? "italic" : "normal"
      } ${field.fontSize}px Arial`;
      ctx.textAlign = field.alignment as CanvasTextAlign;

      let textX = field.x;
      if (field.alignment === "center") {
        textX = field.x + field.width / 2;
      } else if (field.alignment === "right") {
        textX = field.x + field.width;
      }

      // Draw label
      ctx.fillText(field.label, textX, field.y + field.fontSize);

      // Draw value
      ctx.fillText(field.value, textX, field.y + field.fontSize * 2 + 5);

      // Draw selection border
      if (selectedField?.id === field.id) {
        ctx.strokeStyle = "#007bff";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          field.x - 5,
          field.y - 5,
          field.width + 10,
          field.height + 10
        );
        ctx.setLineDash([]);
      }
    });
  };

  useEffect(() => {
    renderTemplate();
  }, [currentTemplate, selectedField]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentTemplate || !isEditing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked field
    const clickedField = currentTemplate.fields.find(
      (field) =>
        x >= field.x &&
        x <= field.x + field.width &&
        y >= field.y &&
        y <= field.y + field.height
    );

    setSelectedField(clickedField || null);
  };

  const generateBill = (template: BillTemplate) => {
    const billData = template.fields.reduce((acc, field) => {
      acc[field.label] = field.value;
      return acc;
    }, {} as Record<string, string>);

    console.log("Generated bill data:", billData);
    alert("Bill generated! Check console for data.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🚀 Advanced Template Builder
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Create professional bill templates with advanced styling,
            positioning, and customization options!
          </p>
        </div>

        {/* Template Management */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Your Templates
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTemplateSettings(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
              >
                ⚙️ Template Settings
              </button>
              <button
                onClick={createNewTemplate}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
              >
                ✨ Create New Template
              </button>
            </div>
          </div>

          {/* Templates List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {template.description}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {template.fields.length} fields • Created{" "}
                  {template.createdAt.toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentTemplate(template)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => generateBill(template)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    Generate Bill
                  </button>
                  <button
                    onClick={() => deleteField(template.id)}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No templates yet. Create your first advanced template to get
              started!
            </div>
          )}
        </div>

        {/* Template Editor */}
        {currentTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentTemplate.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {currentTemplate.fields.length} fields • Advanced styling
                  enabled
                </p>
              </div>

              <div className="flex gap-3">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                  >
                    ✏️ Edit Template
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openFieldEditor(undefined, "create")}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                    >
                      ➕ Add Field
                    </button>
                    <button
                      onClick={saveTemplate}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                    >
                      💾 Save Template
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                    >
                      ❌ Cancel Editing
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Template Canvas */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={currentTemplate.width}
                  height={currentTemplate.height}
                  className="border-2 border-gray-300 rounded-lg cursor-move"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onClick={handleCanvasClick}
                  style={{ cursor: isEditing ? "move" : "default" }}
                />

                {isEditing && (
                  <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      💡 Drag fields to reposition • Click to select
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Fields Panel */}
            {isEditing && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Template Fields ({currentTemplate.fields.length})
                  </h4>
                  <button
                    onClick={() => openFieldEditor(undefined, "create")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-lg transition-colors duration-300"
                  >
                    ➕ Add New Field
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {currentTemplate.fields.map((field) => (
                    <div
                      key={field.id}
                      className={`p-4 border-2 rounded-lg transition-all duration-300 ${
                        selectedField?.id === field.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {field.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {field.type}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {field.value}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 space-y-1">
                        <div>
                          Position: ({field.x}, {field.y})
                        </div>
                        <div>
                          Size: {field.width} × {field.height}
                        </div>
                        <div>
                          Font: {field.fontSize}px {field.isBold ? "Bold" : ""}{" "}
                          {field.isItalic ? "Italic" : ""}
                        </div>
                        <div>Align: {field.alignment}</div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => openFieldEditor(field, "edit")}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded transition-colors duration-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteField(field.id)}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition-colors duration-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Field Editor Modal */}
        {showFieldEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {isFieldEditorMode === "create"
                  ? "Add New Field"
                  : "Edit Field"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={fieldEditorData.label || ""}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          label: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Enter field label"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Field Type
                    </label>
                    <select
                      value={fieldEditorData.type || "text"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          type: e.target.value as any,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="amount">Amount</option>
                      <option value="textarea">Text Area</option>
                      <option value="select">Select</option>
                      <option value="image">Image</option>
                      <option value="signature">Signature</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Value
                    </label>
                    <input
                      type="text"
                      value={fieldEditorData.value || ""}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          value: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Enter default value"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Alignment
                    </label>
                    <select
                      value={fieldEditorData.alignment || "left"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          alignment: e.target.value as any,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                {/* Position & Size */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        X Position
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.x || 100}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            x: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Y Position
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.y || 100}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            y: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.width || 150}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            width: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Height
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.height || 40}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            height: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Font Size
                    </label>
                    <input
                      type="number"
                      value={fieldEditorData.fontSize || 16}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          fontSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Styling Options */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Styling Options
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Text Color
                    </label>
                    <input
                      type="color"
                      value={fieldEditorData.textColor || "#000000"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          textColor: e.target.value,
                        })
                      }
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Background Color
                    </label>
                    <input
                      type="color"
                      value={fieldEditorData.backgroundColor || "#ffffff"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Border Color
                    </label>
                    <input
                      type="color"
                      value={fieldEditorData.borderColor || "#e5e7eb"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          borderColor: e.target.value,
                        })
                      }
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Border Width
                    </label>
                    <input
                      type="number"
                      value={fieldEditorData.borderWidth || 1}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          borderWidth: parseInt(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Border Radius
                    </label>
                    <input
                      type="number"
                      value={fieldEditorData.borderRadius || 6}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          borderRadius: parseInt(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.isBold || false}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            isBold: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Bold
                    </label>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.isItalic || false}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            isItalic: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Italic
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveField}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                >
                  Save Field
                </button>
                <button
                  onClick={() => setShowFieldEditor(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!currentTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Advanced Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎨</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Advanced Styling
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Custom colors, fonts, borders, and positioning
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🖱️</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Drag & Drop
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Visual field positioning and resizing
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Professional
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Create business-ready bill templates
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
