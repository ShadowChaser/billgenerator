"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface NewTemplateChooserModalProps {
  open: boolean;
  onClose: () => void;
  onCreateProfessional: () => void;
  onCreateEmpty: () => void;
}

const NewTemplateChooserModal: React.FC<NewTemplateChooserModalProps> = ({
  open,
  onClose,
  onCreateProfessional,
  onCreateEmpty,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-0 md:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-none md:rounded-xl p-4 md:p-6 w-full h-full md:h-auto md:max-w-2xl md:mx-4 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Create New Template</h3>
          <button
            aria-label="Close chooser"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
            onClick={onClose}
          >
            ✖
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Choose how you want to start your template.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 hover:border-blue-500 transition-colors">
            <CardHeader>
              <CardTitle>Professional Template</CardTitle>
              <CardDescription>Start from a polished, pre-filled invoice layout</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Includes company header, client details, itemized table, and payment terms.
              </p>
              <Button className="w-full" onClick={onCreateProfessional}>Use Professional</Button>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <CardTitle>Empty Canvas</CardTitle>
              <CardDescription>Start from scratch with a blank page</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Perfect if you want full control over layout and fields.
              </p>
              <Button className="w-full" variant="secondary" onClick={onCreateEmpty}>Start Empty</Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
};

export default NewTemplateChooserModal;
