export interface DockerBuildExecutorSchema {
  registry?: string;
  imageName?: string;
  tag?: string;
  dockerfile?: string;
  context?: string;
  buildArgs?: Record<string, string>;
  platform?: string;
  push?: boolean;
  labels?: Record<string, string>;
}
