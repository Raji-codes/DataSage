import React, { useState } from 'react';
import { Dataset } from '../types';

interface FileUploadProps {
  onUpload: (dataset: Dataset) => void;
  selectedDatasetName?: string;
}

export const SAMPLE_DATASETS: Dataset[] = [
  {
    name: 'Used_Car_Valuation_Market.csv',
    headers: ['Car_Model', 'Year', 'Price_USD', 'Mileage_km', 'Fuel_Type', 'Transmission', 'Owner_Type'],
    rows: [
      { Car_Model: 'Maruti Swift VXI', Year: 2017, Price_USD: 7500, Mileage_km: 24005, Fuel_Type: 'Petrol', Transmission: 'Manual', Owner_Type: 'First' },
      { Car_Model: 'Hyundai i20 Asta', Year: 2019, Price_USD: 9200, Mileage_km: 18500, Fuel_Type: 'Petrol', Transmission: 'Manual', Owner_Type: 'First' },
      { Car_Model: 'Honda City VX', Year: 2018, Price_USD: 11000, Mileage_km: 35000, Fuel_Type: 'Petrol', Transmission: 'Automatic', Owner_Type: 'First' },
      { Car_Model: 'Toyota Innova Crysta', Year: 2020, Price_USD: 21000, Mileage_km: 42000, Fuel_Type: 'Diesel', Transmission: 'Automatic', Owner_Type: 'First' },
      { Car_Model: 'Maruti Vitara Brezza', Year: 2018, Price_USD: 8800, Mileage_km: 29000, Fuel_Type: 'Diesel', Transmission: 'Manual', Owner_Type: 'First' },
      { Car_Model: 'Tata Nexon XZ+', Year: 2021, Price_USD: 10500, Mileage_km: 15000, Fuel_Type: 'Petrol', Transmission: 'Manual', Owner_Type: 'First' },
      { Car_Model: 'Ford EcoSport Titanium', Year: 2017, Price_USD: 7900, Mileage_km: 48000, Fuel_Type: 'Diesel', Transmission: 'Manual', Owner_Type: 'Second' },
      { Car_Model: 'Hyundai Creta SX', Year: 2019, Price_USD: 13500, Mileage_km: 31000, Fuel_Type: 'Petrol', Transmission: 'Automatic', Owner_Type: 'First' },
      { Car_Model: 'Kia Seltos HTX', Year: 2020, Price_USD: 14200, Mileage_km: 22000, Fuel_Type: 'Diesel', Transmission: 'Manual', Owner_Type: 'First' },
      { Car_Model: 'Volkswagen Polo GT TSI', Year: 2018, Price_USD: 8200, Mileage_km: 38000, Fuel_Type: 'Petrol', Transmission: 'Automatic', Owner_Type: 'Second' },
      { Car_Model: 'Mahindra Thar LX', Year: 2021, Price_USD: 16500, Mileage_km: 19000, Fuel_Type: 'Diesel', Transmission: 'Manual', Owner_Type: 'First' },
      { Car_Model: 'Honda Civic ZX', Year: 2019, Price_USD: 15800, Mileage_km: 27000, Fuel_Type: 'Petrol', Transmission: 'Automatic', Owner_Type: 'First' },
    ]
  },
  {
    name: 'Employee_Retention_Analytics.csv',
    headers: ['Employee_ID', 'Department', 'Salary_USD', 'Years_Experience', 'Performance_Rating', 'Remote_Work_Pct', 'Left_Company'],
    rows: [
      { Employee_ID: 'EMP-101', Department: 'Engineering', Salary_USD: 95000, Years_Experience: 5, Performance_Rating: 4.2, Remote_Work_Pct: 80, Left_Company: 'No' },
      { Employee_ID: 'EMP-102', Department: 'Sales', Salary_USD: 62000, Years_Experience: 2, Performance_Rating: 3.1, Remote_Work_Pct: 20, Left_Company: 'Yes' },
      { Employee_ID: 'EMP-103', Department: 'Marketing', Salary_USD: 78000, Years_Experience: 4, Performance_Rating: 4.5, Remote_Work_Pct: 50, Left_Company: 'No' },
      { Employee_ID: 'EMP-104', Department: 'Engineering', Salary_USD: 125000, Years_Experience: 8, Performance_Rating: 4.8, Remote_Work_Pct: 100, Left_Company: 'No' },
      { Employee_ID: 'EMP-105', Department: 'Support', Salary_USD: 48000, Years_Experience: 1, Performance_Rating: 2.8, Remote_Work_Pct: 0, Left_Company: 'Yes' },
      { Employee_ID: 'EMP-106', Department: 'Product', Salary_USD: 110000, Years_Experience: 6, Performance_Rating: 4.1, Remote_Work_Pct: 75, Left_Company: 'No' },
      { Employee_ID: 'EMP-107', Department: 'Sales', Salary_USD: 70000, Years_Experience: 3, Performance_Rating: 3.5, Remote_Work_Pct: 30, Left_Company: 'Yes' },
      { Employee_ID: 'EMP-108', Department: 'Engineering', Salary_USD: 88000, Years_Experience: 3, Performance_Rating: 3.9, Remote_Work_Pct: 90, Left_Company: 'No' },
    ]
  },
  {
    name: 'Customer_Segmentation_LTV.csv',
    headers: ['Customer_ID', 'Age', 'Annual_Income_K', 'Spending_Score', 'Total_Orders', 'Preferred_Category'],
    rows: [
      { Customer_ID: 'CUST-001', Age: 28, Annual_Income_K: 45, Spending_Score: 82, Total_Orders: 14, Preferred_Category: 'Electronics' },
      { Customer_ID: 'CUST-002', Age: 42, Annual_Income_K: 85, Spending_Score: 35, Total_Orders: 8, Preferred_Category: 'Home & Kitchen' },
      { Customer_ID: 'CUST-003', Age: 35, Annual_Income_K: 110, Spending_Score: 91, Total_Orders: 26, Preferred_Category: 'Fashion & Luxury' },
      { Customer_ID: 'CUST-004', Age: 22, Annual_Income_K: 30, Spending_Score: 78, Total_Orders: 11, Preferred_Category: 'Beauty' },
      { Customer_ID: 'CUST-005', Age: 55, Annual_Income_K: 95, Spending_Score: 22, Total_Orders: 5, Preferred_Category: 'Home & Kitchen' },
      { Customer_ID: 'CUST-006', Age: 31, Annual_Income_K: 72, Spending_Score: 65, Total_Orders: 18, Preferred_Category: 'Electronics' },
    ]
  }
];

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, selectedDatasetName }) => {
  const [activeName, setActiveName] = useState<string>(selectedDatasetName || '');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (file.name.toLowerCase().endsWith('.csv')) {
        parseCSV(text, file.name);
      } else if (file.name.toLowerCase().endsWith('.json')) {
        parseJSON(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const parseCSV = (text: string, filename: string) => {
    const rawLines = text.split(/\r?\n/).filter(line => line.trim());
    if (rawLines.length === 0) return;

    const headers = parseCSVLine(rawLines[0]);
    const rows = rawLines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const obj: any = {};
      headers.forEach((h, i) => {
        const val = values[i];
        if (val === undefined || val === '') {
          obj[h] = null;
        } else {
          obj[h] = isNaN(Number(val)) ? val : Number(val);
        }
      });
      return obj;
    });

    setActiveName(filename);
    onUpload({ name: filename, headers, rows });
  };

  const parseJSON = (text: string, filename: string) => {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        setActiveName(filename);
        onUpload({
          name: filename,
          headers,
          rows: data
        });
      }
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const selectSample = (dataset: Dataset) => {
    setActiveName(dataset.name);
    onUpload(dataset);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Drop Zone */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative glass-specular rounded-2xl p-6 transition-all text-center backdrop-blur-xl ${
          isDragOver 
            ? 'border-2 border-blue-500 bg-blue-50/70 shadow-[0_0_25px_rgba(59,130,246,0.15)]' 
            : activeName 
            ? 'border border-emerald-300/80 bg-emerald-50/40 shadow-sm' 
            : 'border-2 border-dashed border-slate-300/70 hover:border-blue-400/80 glass-subtle hover:bg-white/80 shadow-sm'
        }`}
      >
        <label className="flex flex-col items-center justify-center cursor-pointer">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all ${
            activeName 
              ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
              : 'bg-blue-500/10 text-blue-600 border border-blue-400/20 shadow-sm'
          }`}>
            <i className={`fas ${activeName ? 'fa-check' : 'fa-cloud-arrow-up'} text-lg`}></i>
          </div>
          
          {activeName ? (
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Ingestion Ready</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-2 font-mono">
                {activeName}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Drop another file or select an enterprise benchmark below
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Click to browse or drop a tabular dataset here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports standard comma-separated (.csv) and tabular array (.json)
              </p>
            </div>
          )}

          <input type="file" className="hidden" accept=".csv,.json" onChange={handleFileChange} />
        </label>
      </div>

      {/* Benchmark / Pre-loaded Datasets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <i className="fas fa-layer-group text-blue-600 text-[11px]"></i>
            <span>Or load benchmark dataset</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Instant evaluation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_DATASETS.map((sample) => {
            const isSelected = activeName === sample.name;
            const displayName = sample.name
              .replace('.csv', '')
              .replace(/_/g, ' ');

            return (
              <button
                key={sample.name}
                type="button"
                onClick={() => selectSample(sample)}
                className={`p-3.5 rounded-xl text-left transition-all flex flex-col justify-between backdrop-blur-md ${
                  isSelected 
                    ? 'bg-blue-50/80 border-2 border-blue-600/80 shadow-[0_4px_16px_rgba(37,99,235,0.12)]' 
                    : 'glass-card hover:bg-white/95 border border-white/70 shadow-sm text-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-mono tabular-nums text-[11px] font-medium text-slate-600 glass-pill px-2 py-0.5 rounded-md">
                      {sample.rows.length} rows · {sample.headers.length} cols
                    </span>
                    {isSelected && (
                      <span className="text-blue-700 text-xs font-bold flex items-center gap-1">
                        <i className="fas fa-check-circle text-[11px]"></i>
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900 leading-snug">
                    {displayName}
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500 truncate mt-2.5 pt-2 border-t border-slate-200/50">
                  {sample.headers.slice(0, 3).join(', ')}...
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
