export interface Applicant {
    Applicant: string;
    Block: string;
    Position: string[];
    Assessment: string;
    Referral?: string;
    '[Editors Only] Vision'?: string;
    [key: string]: any;
  }
  
  export interface PrintWindow extends Window {
    print: () => void;
  }
  
  declare global {
    interface Window {
      fs: {
        readFile: (path: string, options?: { encoding?: string }) => Promise<any>;
      };
    }
  }