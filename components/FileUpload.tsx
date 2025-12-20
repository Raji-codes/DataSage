
import React from 'react';
import { Dataset } from '../types';

interface FileUploadProps {
  onUpload: (dataset: Dataset) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload }) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (file.name.endsWith('.csv')) {
        parseCSV(text, file.name);
      } else if (file.name.endsWith('.json')) {
        parseJSON(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string, filename: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj: any = {};
      headers.forEach((h, i) => {
        const val = values[i]?.trim();
        obj[h] = isNaN(Number(val)) ? val : Number(val);
      });
      return obj;
    });

    onUpload({ name: filename, headers, rows });
  };

  const parseJSON = (text: string, filename: string) => {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        onUpload({
          name: filename,
          headers: Object.keys(data[0]),
          rows: data
        });
      }
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-slate-50 transition-all shadow-sm">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className="bg-indigo-100 p-4 rounded-full mb-4">
            <i className="fas fa-cloud-upload-alt text-3xl text-indigo-600"></i>
          </div>
          <p className="mb-2 text-sm text-slate-700 font-semibold uppercase tracking-wider">
            Drop your raw data
          </p>
          <p className="text-xs text-slate-500">
            CSV or JSON (Max 5MB for analysis sample)
          </p>
        </div>
        <input type="file" className="hidden" accept=".csv,.json" onChange={handleFileChange} />
      </label>
    </div>
  );
};
