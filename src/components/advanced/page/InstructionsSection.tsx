"use client";

import React from "react";

const InstructionsSection: React.FC = () => {
  return (
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
  );
};

export default InstructionsSection;
