import React from 'react';
import { HistoryItem } from '../types';
import { X, Trash2, FileText, Clock, ExternalLink } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

export const HistorySidebar: React.FC<Props> = ({ isOpen, onClose, history, onSelect, onDelete }) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="font-bold text-lg text-slate-800 flex items-center">
            <Clock size={20} className="mr-2 text-blue-600" />
            Article History (Log)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">
              <p>No history yet.</p>
              <p className="text-sm mt-2">Generated articles will appear here.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-md transition-shadow group relative">
                <div className="pr-8">
                  <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 mb-1">{item.keyword}</h3>
                  <p className="text-xs text-slate-400">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
                
                <div className="flex items-center mt-3 space-x-2">
                   <button 
                    onClick={() => onSelect(item)}
                    className="flex-1 flex items-center justify-center text-xs font-medium bg-blue-50 text-blue-600 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                   >
                     <ExternalLink size={12} className="mr-1" /> View Full
                   </button>
                   <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Log"
                   >
                     <Trash2 size={14} />
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};