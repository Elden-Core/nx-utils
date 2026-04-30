import {
  Tree,
  generateFiles,
  readProjectConfiguration,
  updateProjectConfiguration,
  logger,
  joinPathFragments,
} from '@nx/devkit';
import * as path from 'path';
import { SetupDockerGeneratorSchema } from './schema.d';

const DOCKER_IGNORE_CONTENT = `# Dependencies
node_modules

# Source (we copy from NX dist output)
.git
.nx
*.md

# Keep dist — Dockerfiles copy from dist/
`;

export default async function generator(
  tree: Tree,
  options: SetupDockerGeneratorSchema
): Promise<void> {
  const project = readProjectConfiguration(tree, options.project);
  const projectRoot = project.root;

  const dockerDir = joinPathFragments(projectRoot, 'src', 'docker');
  const port = options.port ?? (options.appType === 'nginx' ? 80 : 3000);

  generateFiles(
    tree,
    path.join(__dirname, 'files', options.appType),
    dockerDir,
    {
      tmpl: '',
      projectName: options.project,
      port,
    }
  );

  if (!tree.exists('.dockerignore')) {
    tree.write('.dockerignore', DOCKER_IGNORE_CONTENT);
    logger.info('Created .dockerignore at workspace root');
  }

  project.targets = {
    ...project.targets,
    'docker-build': {
      executor: '@elden-core/nx-utils:docker-build',
      dependsOn: ['build'],
      options: {
        imageName: options.project,
        tag: 'latest',
        ...(options.registry ? { registry: options.registry } : {}),
      },
    },
  };
  updateProjectConfiguration(tree, options.project, project);

  logger.info(`Generated Dockerfile at ${dockerDir}/Dockerfile`);
  logger.info(`Added docker-build target to project "${options.project}"`);
  logger.info(
    `Run: nx docker-build ${options.project}  (after nx build ${options.project})`
  );
}
