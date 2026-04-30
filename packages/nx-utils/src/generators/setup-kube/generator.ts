import {
  Tree,
  generateFiles,
  readProjectConfiguration,
  logger,
  joinPathFragments,
} from '@nx/devkit';
import * as path from 'path';
import { SetupKubeGeneratorSchema } from './schema.d';

export default async function generator(
  tree: Tree,
  options: SetupKubeGeneratorSchema
): Promise<void> {
  const project = readProjectConfiguration(tree, options.project);
  const projectRoot = project.root;

  const kubeDir = joinPathFragments(projectRoot, 'src', 'kube');
  const imageName = options.imageName ?? options.project;
  const port = options.port ?? 3000;
  const replicas = options.replicas ?? 1;

  const templateVars = {
    tmpl: '',
    projectName: options.project,
    namespace: options.namespace,
    registry: options.registry,
    imageName,
    port,
    replicas,
    withIngress: options.withIngress ?? true,
    ingressHost: options.ingressHost ?? `${options.project}.elden-core.fr`,
    withTls: options.withTls ?? false,
  };

  generateFiles(tree, path.join(__dirname, 'files'), kubeDir, templateVars);

  if (!(options.withIngress ?? true)) {
    const ingressPath = joinPathFragments(kubeDir, 'ingress.yaml');
    if (tree.exists(ingressPath)) {
      tree.delete(ingressPath);
    }
  }

  logger.info(`Generated Kubernetes manifests in ${kubeDir}/`);
  logger.info(`  - deployment.yaml  (${replicas} replica(s), port ${port})`);
  logger.info(`  - service.yaml`);
  if (options.withIngress ?? true) {
    logger.info(`  - ingress.yaml     (host: ${templateVars.ingressHost})`);
  }
  logger.info(`Image reference: ${options.registry}/${imageName}:latest`);
  logger.info('Tip: commit the manifests and let your GitOps pipeline apply them.');
}
