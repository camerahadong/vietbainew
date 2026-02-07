import React from 'react';
import { AppStep } from '../types';
import { Check } from 'lucide-react';

interface Props {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.INPUT, label: 'Input' },
  { id: AppStep.IDEATION, label: 'Ideation' },
  { id: AppStep.OUTLINE, label: 'Outline' },
  { id: AppStep.WRITING, label: 'Writing' },
  { id: AppStep.PUBLISH, label: 'Publish' },
];

export const StepIndicator: React.FC<Props> = ({ currentStep }) => {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-center space-x-2 md:space-x-4">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center space-x-2 ${
                  isCompleted ? 'text-green-600' : isCurrent ? 'text-orange-600' : 'text-slate-400'
                }`}
              >
                <div 
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300
                    ${isCompleted 
                      ? 'bg-green-100 border-green-600' 
                      : isCurrent 
                        ? 'bg-orange-50 border-orange-500 shadow-[0_0_10px_rgba(255,165,0,0.3)]' 
                        : 'bg-slate-50 border-slate-300'
                    }
                  `}
                >
                  {isCompleted ? <Check size={16} /> : <span className="text-sm font-bold">{step.id}</span>}
                </div>
                <span className={`hidden sm:block text-sm font-medium ${isCurrent ? 'font-bold' : ''}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 md:w-12 h-0.5 mx-2 md:mx-4 transition-colors duration-300 ${
                  isCompleted ? 'bg-green-600' : isCurrent ? 'bg-gradient-to-r from-orange-400 to-slate-200' : 'bg-slate-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};