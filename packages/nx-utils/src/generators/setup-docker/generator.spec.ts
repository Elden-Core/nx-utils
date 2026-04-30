import { Tree, addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from './generator';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

function addProject(tree: Tree, name: string, root: string): void {
  addProjectConfiguration(tree, name, {
    root,
    projectType: 'application',
    targets: { build: { executor: '@nx/node:build', options: {} } },
  });
}

describe('setup-docker generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProject(tree, 'my-api', 'apps/my-api');
  });

  describe('node appType', () => {
    it('generates a Dockerfile in src/docker/', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      expect(tree.exists('apps/my-api/src/docker/Dockerfile')).toBe(true);
    });

    it('Dockerfile references node:24-alpine base image', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const content = tree.read('apps/my-api/src/docker/Dockerfile', 'utf-8');
      expect(content).toContain('node:24-alpine');
    });

    it('Dockerfile copies from the project dist path', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const content = tree.read('apps/my-api/src/docker/Dockerfile', 'utf-8');
      expect(content).toContain('dist/apps/my-api');
    });

    it('Dockerfile exposes the default port 3000', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const content = tree.read('apps/my-api/src/docker/Dockerfile', 'utf-8');
      expect(content).toContain('EXPOSE 3000');
    });

    it('Dockerfile exposes a custom port', async () => {
      await generator(tree, { project: 'my-api', appType: 'node', port: 8080 });
      const content = tree.read('apps/my-api/src/docker/Dockerfile', 'utf-8');
      expect(content).toContain('EXPOSE 8080');
    });
  });

  describe('nextjs appType', () => {
    it('generates a Dockerfile for Next.js', async () => {
      addProject(tree, 'my-next-app', 'apps/my-next-app');
      await generator(tree, { project: 'my-next-app', appType: 'nextjs' });
      expect(tree.exists('apps/my-next-app/src/docker/Dockerfile')).toBe(true);
    });

    it('Next.js Dockerfile copies .next/standalone', async () => {
      addProject(tree, 'my-next', 'apps/my-next');
      await generator(tree, { project: 'my-next', appType: 'nextjs' });
      const content = tree.read('apps/my-next/src/docker/Dockerfile', 'utf-8');
      expect(content).toContain('.next/standalone');
      expect(content).toContain('NEXT_TELEMETRY_DISABLED');
    });
  });

  describe('nginx appType', () => {
    it('generates Dockerfile and nginx.conf', async () => {
      addProject(tree, 'my-frontend', 'apps/my-frontend');
      await generator(tree, { project: 'my-frontend', appType: 'nginx' });
      expect(tree.exists('apps/my-frontend/src/docker/Dockerfile')).toBe(true);
      expect(tree.exists('apps/my-frontend/src/docker/nginx.conf')).toBe(true);
    });

    it('Dockerfile uses nginx:1.27-alpine', async () => {
      addProject(tree, 'my-frontend', 'apps/my-frontend');
      await generator(tree, { project: 'my-frontend', appType: 'nginx' });
      const content = tree.read('apps/my-frontend/src/docker/Dockerfile', 'utf-8');
      expect(content).toContain('nginx:1.27-alpine');
    });

    it('defaults port to 80 for nginx', async () => {
      addProject(tree, 'my-frontend', 'apps/my-frontend');
      await generator(tree, { project: 'my-frontend', appType: 'nginx' });
      const content = tree.read('apps/my-frontend/src/docker/Dockerfile', 'utf-8');
      expect(content).toContain('EXPOSE 80');
    });

    it('nginx.conf contains SPA fallback rule', async () => {
      addProject(tree, 'my-frontend', 'apps/my-frontend');
      await generator(tree, { project: 'my-frontend', appType: 'nginx' });
      const content = tree.read('apps/my-frontend/src/docker/nginx.conf', 'utf-8');
      expect(content).toContain('try_files');
      expect(content).toContain('/index.html');
    });
  });

  describe('project.json target wiring', () => {
    it('adds docker-build target to the project', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const config = readProjectConfiguration(tree, 'my-api');
      expect(config.targets?.['docker-build']).toBeDefined();
    });

    it('docker-build target uses the nx-utils executor', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const config = readProjectConfiguration(tree, 'my-api');
      expect(config.targets?.['docker-build']?.executor).toBe('@elden-core/nx-utils:docker-build');
    });

    it('docker-build target depends on build', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const config = readProjectConfiguration(tree, 'my-api');
      expect(config.targets?.['docker-build']?.dependsOn).toContain('build');
    });

    it('includes registry in target options when provided', async () => {
      await generator(tree, { project: 'my-api', appType: 'node', registry: 'registry.example.com' });
      const config = readProjectConfiguration(tree, 'my-api');
      expect(config.targets?.['docker-build']?.options?.registry).toBe('registry.example.com');
    });

    it('omits registry from target options when not provided', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const config = readProjectConfiguration(tree, 'my-api');
      expect(config.targets?.['docker-build']?.options?.registry).toBeUndefined();
    });

    it('preserves existing targets', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      const config = readProjectConfiguration(tree, 'my-api');
      expect(config.targets?.['build']).toBeDefined();
    });
  });

  describe('.dockerignore', () => {
    it('creates .dockerignore at workspace root when missing', async () => {
      await generator(tree, { project: 'my-api', appType: 'node' });
      expect(tree.exists('.dockerignore')).toBe(true);
    });

    it('does not overwrite existing .dockerignore', async () => {
      const original = 'node_modules\ncustom-entry';
      tree.write('.dockerignore', original);
      await generator(tree, { project: 'my-api', appType: 'node' });
      const content = tree.read('.dockerignore', 'utf-8');
      expect(content).toBe(original);
    });
  });
});
