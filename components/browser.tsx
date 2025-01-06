import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown, Table, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Papa from 'papaparse';
import _ from 'lodash';

interface Applicant {
  Applicant: string;
  Block?: string;
  Position: string[];
  Assessment?: string;
  Referral?: string;
  '[Editors Only] Vision'?: string;
}

interface HandleUpload {
  handleUploadSuccess: (data: Applicant[]) => void;
  handleUploadError: (error: string) => void;
}

const sanitizeHtml = (html: string | undefined): string => {
  return html?.replace(/script/gi, 'span') || '';
};

const HtmlContent: React.FC<{ content?: string }> = ({ content }) => {
  if (!content) return null;
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      className="prose prose-sm max-w-none"
    />
  );
};

const exportToPDF = async (applications: Applicant[]): Promise<void> => {
  const content = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .applicant { margin-bottom: 30px; page-break-inside: avoid; }
          .header { background: #f3f4f6; padding: 10px; margin-bottom: 10px; }
          .positions { margin: 10px 0; }
          .position-badge { 
            background: #e5e7eb; 
            padding: 4px 8px; 
            border-radius: 4px; 
            margin-right: 5px; 
            display: inline-block;
          }
          .section { margin: 10px 0; }
          .title { font-weight: bold; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <h1>Applicants Report</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        ${applications.map(app => `
          <div class="applicant">
            <div class="header">
              <h2>${app.Applicant || 'Unknown'}</h2>
              <div>Block: ${app.Block || 'Not assigned'}</div>
            </div>
            <div class="section">
              <div class="title">Positions:</div>
              <div class="positions">
                ${app.Position.map(pos => 
                  `<span class="position-badge">${pos}</span>`
                ).join(' ')}
              </div>
            </div>
            ${app.Assessment ? `
              <div class="section">
                <div class="title">Assessment:</div>
                <div>${sanitizeHtml(app.Assessment)}</div>
              </div>
            ` : ''}
            ${app.Referral ? `
              <div class="section">
                <div class="title">Referral:</div>
                <div>${app.Referral}</div>
              </div>
            ` : ''}
            ${app['[Editors Only] Vision'] ? `
              <div class="section">
                <div class="title">Vision Statement:</div>
                <div>${app['[Editors Only] Vision']}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  }
};

const exportToCSV = (applications: Applicant[]): void => {
  let csv = 'Applicant,Block,Positions,Assessment,Referral,Vision\n';
  
  applications.forEach(app => {
    const positions = app.Position.join('; ');
    const row = [
      app.Applicant,
      app.Block,
      positions,
      app.Assessment,
      app.Referral,
      app['[Editors Only] Vision']
    ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',');
    
    csv += row + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', 'applicants.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const ApplicantDetails: React.FC<{ applicant: Applicant | null }> = ({ applicant }) => {
  if (!applicant) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-sm font-medium">Block</p>
            <p className="text-sm text-muted-foreground">{applicant.Block || 'Not assigned'}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Applied Positions</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {applicant.Position.map((position, i) => (
                <Badge key={i} variant="secondary">{position}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {applicant.Assessment && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Assessment</h3>
          <div className="prose prose-sm max-w-none">
            <HtmlContent content={applicant.Assessment} />
          </div>
        </div>
      )}

      {applicant.Referral && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Referral</h3>
          <p className="text-sm text-muted-foreground">{applicant.Referral}</p>
        </div>
      )}

      {applicant['[Editors Only] Vision'] && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Vision Statement</h3>
          <p className="text-sm text-muted-foreground">{applicant['[Editors Only] Vision']}</p>
        </div>
      )}
    </div>
  );
};

const FileUpload: React.FC<HandleUpload> = ({ handleUploadSuccess, handleUploadError }) => {
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const apps = results.data.map((app: any) => ({
                ...app,
                Position: Array.isArray(app.Position) ? app.Position : 
                  typeof app.Position === 'string' ? 
                    JSON.parse(app.Position.replace(/'/g, '"')) : []
              }));
              handleUploadSuccess(apps as Applicant[]);
            } catch (error) {
              handleUploadError('Error processing file: Invalid format');
            }
          },
          error: ({ message }: { message: string }) => {
            handleUploadError(message);
          }
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Applications CSV</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="flex-1"
          />
        </div>
      </CardContent>
    </Card>
  );
};

const ApplicantDashboard: React.FC = () => {
  const [applications, setApplications] = useState<Applicant[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Applicant[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await window.fs.readFile('Applications2.csv', { encoding: 'utf8' });
        
        Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const apps = results.data.map((app: any) => ({
                ...app,
                Position: Array.isArray(app.Position) ? app.Position : 
                  typeof app.Position === 'string' ? 
                    JSON.parse(app.Position.replace(/'/g, '"')) : []
              }));

              const uniqueBlocks = _.uniq(apps.map(app => app.Block)).filter(Boolean);
              const uniquePositions = _.uniq(
                apps.flatMap(app => app.Position)
              ).filter(Boolean);

              setApplications(apps);
              setFilteredApplications(apps);
              setBlocks(uniqueBlocks);
              setPositions(uniquePositions);
              setError(null);
            } catch (error) {
              setError('Error processing data: Invalid format');
            }
          },
          error: (error) => {
            setError(`Error parsing CSV: ${error.message}`);
          }
        });
      } catch (error) {
        setError('Error reading file');
        console.error('Error reading file:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = [...applications];

    if (searchTerm) {
      filtered = filtered.filter(app => 
        app.Applicant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.Assessment?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedBlock) {
      filtered = filtered.filter(app => app.Block === selectedBlock);
    }

    if (selectedPosition) {
      filtered = filtered.filter(app => 
        app.Position.includes(selectedPosition)
      );
    }

    setFilteredApplications(filtered);
  }, [searchTerm, selectedBlock, selectedPosition, applications]);

  const handleApplicantClick = (applicant: Applicant) => {
    setSelectedApplicant(applicant);
    setIsModalOpen(true);
  };

  const handleUploadSuccess = (data: Applicant[]) => {
    setApplications(data);
    setFilteredApplications(data);
    setError(null);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <FileUpload 
        handleUploadSuccess={handleUploadSuccess} 
        handleUploadError={handleUploadError}
      />

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Applicant Management Dashboard</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(filteredApplications)}
                className="flex items-center gap-2"
              >
                <Table className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToPDF(filteredApplications)}
                className="flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applicants..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select 
                className="px-3 py-2 border rounded-md"
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
              >
                <option value="">All Blocks</option>
                {blocks.map(block => (
                  <option key={block} value={block}>Block {block}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border rounded-md"
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
              >
                <option value="">All Positions</option>
                {positions.map(position => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredApplications.map((app, index) => (
          <Card 
            key={index} 
            className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleApplicantClick(app)}
            >
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{app.Applicant}</span>
                <Badge>{app.Block ? `Block ${app.Block}` : 'No Block'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {app.Position.map((position, i) => (
                    <Badge key={i} variant="secondary">{position}</Badge>
                  ))}
                </div>
                {app.Assessment && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {app.Assessment}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              <span>{selectedApplicant?.Applicant}</span>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ApplicantDetails applicant={selectedApplicant} />
        </DialogContent>
      </Dialog>

      {filteredApplications.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No applicants found matching your filters.</p>
        </Card>
      )}
    </div>
  );
};

export default ApplicantDashboard;