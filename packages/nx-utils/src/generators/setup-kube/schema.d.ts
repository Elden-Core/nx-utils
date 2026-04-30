export interface SetupKubeGeneratorSchema {
  project: string;
  namespace: string;
  port?: number;
  replicas?: number;
  registry: string;
  imageName?: string;
  withIngress?: boolean;
  ingressHost?: string;
  withTls?: boolean;
}
