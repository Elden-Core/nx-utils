import { ExecutorContext, logger } from '@nx/devkit';
import { spawn } from 'child_process';
import * as path from 'path';
import { DockerBuildExecutorSchema } from './schema.d';

function buildImageRef(options: DockerBuildExecutorSchema, projectName: string): string {
  const name = options.imageName ?? projectName;
  const tag = options.tag ?? 'latest';
  return options.registry ? `${options.registry}/${name}:${tag}` : `${name}:${tag}`;
}

function buildDockerArgs(
  options: DockerBuildExecutorSchema,
  imageRef: string,
  dockerfilePath: string,
  contextPath: string
): string[] {
  const args = ['build', '--tag', imageRef, '--file', dockerfilePath];

  if (options.platform) {
    args.push('--platform', options.platform);
  }

  if (options.buildArgs) {
    for (const [key, value] of Object.entries(options.buildArgs)) {
      args.push('--build-arg', `${key}=${value}`);
    }
  }

  if (options.labels) {
    for (const [key, value] of Object.entries(options.labels)) {
      args.push('--label', `${key}=${value}`);
    }
  }

  args.push(contextPath);
  return args;
}

function runCommand(command: string, args: string[], cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, stdio: 'inherit', shell: false });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', (err) => {
      logger.error(`Failed to run ${command}: ${err.message}`);
      resolve(false);
    });
  });
}

export default async function runExecutor(
  options: DockerBuildExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const projectName = context.projectName;
  if (!projectName) {
    logger.error('No project name found in executor context');
    return { success: false };
  }

  const projectRoot = context.projectsConfigurations?.projects[projectName]?.root ?? '';
  const workspaceRoot = context.root;

  const dockerfilePath =
    options.dockerfile ?? path.join(projectRoot, 'src', 'docker', 'Dockerfile');
  const contextPath = path.resolve(workspaceRoot, options.context ?? '.');
  const absoluteDockerfile = path.resolve(workspaceRoot, dockerfilePath);

  const imageRef = buildImageRef(options, projectName);
  logger.info(`Building Docker image: ${imageRef}`);
  logger.info(`  Dockerfile: ${dockerfilePath}`);
  logger.info(`  Context:    ${options.context ?? '.'}`);

  const buildArgs = buildDockerArgs(options, imageRef, absoluteDockerfile, contextPath);
  const buildSuccess = await runCommand('docker', buildArgs, workspaceRoot);

  if (!buildSuccess) {
    logger.error('Docker build failed');
    return { success: false };
  }

  if (options.push) {
    logger.info(`Pushing image: ${imageRef}`);
    const pushSuccess = await runCommand('docker', ['push', imageRef], workspaceRoot);
    if (!pushSuccess) {
      logger.error('Docker push failed');
      return { success: false };
    }
  }

  logger.info(`Successfully built ${imageRef}`);
  return { success: true };
}
