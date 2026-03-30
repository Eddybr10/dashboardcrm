'use client';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  data: any[];
  filename: string;
  label?: string;
}

export default function ExportButton({ data, filename, label = 'Export CSV' }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    
    // Get columns from first item
    const headers = Object.keys(data[0]);
    
    // Create CSV rows
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(fieldName => {
          let value = row[fieldName];
          if (value === null || value === undefined) value = '';
          // Handle commas and quotes
          const strValue = String(value).replace(/"/g, '""');
          return strValue.includes(',') || strValue.includes('"') ? `"${strValue}"` : strValue;
        }).join(',')
      )
    ].join('\n');

    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button onClick={handleExport} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px' }}>
      <Download size={14} />
      {label}
    </button>
  );
}
