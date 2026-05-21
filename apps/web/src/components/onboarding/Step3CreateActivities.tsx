'use client';

import React, { useState } from 'react';

export function Step3CreateActivities({ templates, onNext }: { templates: any[], onNext: (templateIds: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleTemplate = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-4xl mx-auto w-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Let's document your first data processing activities</h2>
        <p className="text-gray-500">Based on your industry, we've prepared some standard processing activities. Select the ones you do.</p>
      </div>

      <div className="space-y-4 mb-8">
        {templates.map(template => (
          <div
            key={template.id}
            onClick={() => toggleTemplate(template.id)}
            className={`p-5 border rounded-xl cursor-pointer transition-all ${
              selected.includes(template.id)
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-1">{template.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                    <span className="font-medium">Basis:</span> {template.lawfulBasis}
                  </span>
                  <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                    <span className="font-medium">Data:</span> {template.dataCategories.length} categories
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                  selected.includes(template.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                }`}>
                  {selected.includes(template.id) && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center border-t pt-6">
        <button
          onClick={() => onNext([])}
          className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
        >
          Skip for now
        </button>
        <button
          onClick={() => onNext(selected)}
          className={`font-medium py-2 px-8 rounded-md transition ${
            selected.length > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          disabled={selected.length === 0}
        >
          Create {selected.length > 0 ? selected.length : ''} activities
        </button>
      </div>
    </div>
  );
}
