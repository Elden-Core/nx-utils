export type AppType = 'node' | 'nextjs' | 'nginx';

export interface SetupDockerGeneratorSchema {
  project: string;
  appType: AppType;
  port?: number;
  registry?: string;
}
