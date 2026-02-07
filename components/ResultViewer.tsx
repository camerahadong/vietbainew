import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Code, FileText, ChevronDown, ChevronUp, Download, Check, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  content: string;
  title: string;
  isCollapsible?: boolean;
  defaultOpen?: boolean;
  onRegenerateImage?: (src: string, alt: string) => Promise<void>;
}

export const ResultViewer: React.FC<Props> = ({ 
  content, 
  title, 
  isCollapsible = false, 
  defaultOpen = true,
  onRegenerateImage
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState<'md' | 'html' | null>(null);
  
  // Track which image is currently regenerating to show spinner
  const [regeneratingImg, setRegeneratingImg] = useState<string | null>(null);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  // Performance Check: If content is huge (likely due to Base64 images), disable Raw view to prevent freeze
  const isContentHuge = content.length > 50000;

  const handleCopy = (type: 'md' | 'html') => {
    if (type === 'md') {
      // For huge content, we must avoid reading from DOM if possible, but content prop is in memory
      navigator.clipboard.writeText(content);
    } else {
      const previewElement = document.getElementById(`preview-${title.replace(/\s/g, '-')}`);
      if (previewElement) {
        navigator.clipboard.writeText(previewElement.innerHTML);
      }
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadImage = (base64Data: string, altText: string) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = `${altText.replace(/\s+/g, '-').slice(0, 30)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerateClick = async (src: string, alt: string) => {
    if (!onRegenerateImage) return;
    setRegeneratingImg(src);
    try {
        await onRegenerateImage(src, alt);
    } finally {
        setRegeneratingImg(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden transition-all duration-300">
      {/* Header */}
      <div 
        className={`bg-slate-50 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors ${!isOpen && 'rounded-b-xl'}`}
        onClick={() => isCollapsible && setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3">
          {isCollapsible && (
            <div className="text-slate-400">
              {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          )}
          <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
        </div>
        
        {isOpen && (
          <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
            <div className="flex bg-slate-200 rounded-lg p-1 mr-4">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setViewMode('raw')}
                disabled={isContentHuge}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  isContentHuge 
                    ? 'text-slate-300 cursor-not-allowed'
                    : viewMode === 'raw' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title={isContentHuge ? "Disabled to prevent browser lag (Images detected)" : "View Code"}
              >
                Raw MD
              </button>
            </div>

            <button 
              onClick={() => handleCopy('md')}
              className="flex items-center space-x-1 text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg transition-colors font-medium"
              title="Copy Markdown"
            >
              {copied === 'md' ? <Check size={14} className="text-green-600" /> : <FileText size={14} />}
              <span>{copied === 'md' ? 'Copied' : 'Copy MD'}</span>
            </button>
            
            <button 
              onClick={() => handleCopy('html')}
              className="flex items-center space-x-1 text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg transition-colors font-medium"
              title="Copy HTML Code"
            >
              {copied === 'html' ? <Check size={14} className="text-green-600" /> : <Code size={14} />}
              <span>{copied === 'html' ? 'Copied' : 'Copy HTML'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isOpen && (
        <div className="p-8 border-t border-slate-200 bg-white">
          {viewMode === 'preview' ? (
            <div 
              id={`preview-${title.replace(/\s/g, '-')}`} 
              className="prose prose-slate prose-lg max-w-none 
                prose-headings:font-bold prose-headings:text-slate-800
                prose-h1:text-3xl prose-h1:mb-6 prose-h1:text-blue-800
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-blue-700 prose-h2:border-b prose-h2:border-blue-100 prose-h2:pb-2
                prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-indigo-700
                prose-p:leading-7 prose-p:text-slate-700 prose-p:mb-4
                prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:italic prose-blockquote:rounded-r-lg prose-blockquote:text-slate-700
                prose-ul:list-disc prose-ul:pl-6 prose-li:mb-2
                prose-img:rounded-xl prose-img:shadow-lg prose-img:mx-auto prose-img:border prose-img:border-slate-100
                prose-strong:text-slate-900 prose-strong:font-bold
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                /* Table Styling */
                prose-table:border-collapse prose-table:w-full prose-table:my-8 prose-table:shadow-sm prose-table:rounded-lg prose-table:overflow-hidden
                prose-thead:bg-slate-100
                prose-th:p-4 prose-th:text-left prose-th:font-bold prose-th:text-slate-700 prose-th:border prose-th:border-slate-300
                prose-td:p-4 prose-td:border prose-td:border-slate-300 prose-td:text-slate-600
                prose-tr:even:bg-slate-50
              "
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => url} // Allow data: images
                components={{
                  img: ({node, ...props}) => {
                    const src = props.src;
                    const isBase64 = typeof src === 'string' && src.startsWith('data:');
                    const isRegenerating = regeneratingImg === src;

                    return (
                      <div className="my-10 group relative inline-block w-full">
                        <figure>
                            {isRegenerating && (
                                <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl backdrop-blur-sm">
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                                        <span className="text-sm font-semibold text-blue-600">Regenerating...</span>
                                    </div>
                                </div>
                            )}
                          <img 
                            {...props} 
                            src={typeof src === 'string' ? src : undefined}
                            className="w-full max-h-[600px] object-cover rounded-xl shadow-lg border border-slate-100" 
                            alt={props.alt || "Generated Image"}
                          />
                          {props.alt && (
                            <figcaption className="mt-3 text-center text-sm text-slate-500 italic font-medium bg-slate-50 inline-block px-4 py-1 rounded-full mx-auto w-full">
                              {props.alt}
                            </figcaption>
                          )}
                        </figure>
                        
                        {isBase64 && !isRegenerating && onRegenerateImage && (
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                             {/* Regenerate Button */}
                             <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (typeof src === 'string') {
                                  handleRegenerateClick(src, props.alt || '');
                                }
                              }}
                              className="bg-white/90 hover:bg-blue-50 text-slate-800 p-2 rounded-full shadow-lg backdrop-blur-sm flex items-center space-x-2 px-4 font-medium text-sm transition-transform hover:scale-105 border border-slate-200"
                              title="Tạo lại ảnh khác"
                            >
                              <RefreshCw size={16} className="text-blue-600" />
                              <span>Regenerate</span>
                            </button>

                            {/* Download Button */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (typeof src === 'string') {
                                  handleDownloadImage(src, props.alt || 'image');
                                }
                              }}
                              className="bg-white/90 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg backdrop-blur-sm flex items-center space-x-2 px-4 font-medium text-sm transition-transform hover:scale-105 border border-slate-200"
                            >
                              <Download size={16} />
                              <span>Download</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  },
                  code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <div className="relative my-6 rounded-lg overflow-hidden bg-slate-800 shadow-md">
                         <div className="px-4 py-1 bg-slate-700 text-xs text-slate-300 font-mono border-b border-slate-600 flex justify-between">
                            <span>{match[1]}</span>
                         </div>
                         <pre className="p-4 overflow-x-auto text-sm text-slate-100 font-mono">
                           <code className={className} {...props}>
                             {children}
                           </code>
                         </pre>
                      </div>
                    ) : (
                      <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded font-mono text-sm" {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <>
                {isContentHuge ? (
                    <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50 border border-slate-200 border-dashed rounded-lg text-slate-500">
                        <AlertTriangle size={48} className="text-amber-500 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700">Raw View Disabled</h3>
                        <p className="max-w-md text-center mt-2">
                           Content contains high-quality images (Base64) which makes the text extremely long (>50,000 chars). 
                           Displaying raw text here causes browser lag.
                        </p>
                        <p className="mt-4 font-medium">Please use the "Copy MD" or "Download" buttons instead.</p>
                    </div>
                ) : (
                    <textarea
                        readOnly
                        className="w-full h-[500px] p-4 font-mono text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={content}
                    />
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
};