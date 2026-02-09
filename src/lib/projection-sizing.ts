import React, { createContext, useContext } from 'react';

export type ProjectionSizingMode = 'fixed' | 'intrinsic';

const ProjectionSizingContext = createContext<ProjectionSizingMode>('fixed');

interface ProjectionSizingProviderProps {
  mode: ProjectionSizingMode;
  children: React.ReactNode;
}

export function ProjectionSizingProvider({ mode, children }: ProjectionSizingProviderProps): React.JSX.Element {
  return React.createElement(ProjectionSizingContext.Provider, { value: mode }, children);
}

export function useProjectionSizingMode(): ProjectionSizingMode {
  return useContext(ProjectionSizingContext);
}
