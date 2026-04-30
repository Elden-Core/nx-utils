import { Tree, addProjectConfiguration } from '@nx/devkit';
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
    targets: {},
  });
}

const BASE_OPTIONS = {
  project: 'my-api',
  namespace: 'production',
  registry: 'registry.example.com',
};

describe('setup-kube generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProject(tree, 'my-api', 'apps/my-api');
  });

  describe('manifest generation', () => {
    it('creates deployment.yaml', async () => {
      await generator(tree, BASE_OPTIONS);
      expect(tree.exists('apps/my-api/src/kube/deployment.yaml')).toBe(true);
    });

    it('creates service.yaml', async () => {
      await generator(tree, BASE_OPTIONS);
      expect(tree.exists('apps/my-api/src/kube/service.yaml')).toBe(true);
    });

    it('creates ingress.yaml when withIngress is true (default)', async () => {
      await generator(tree, BASE_OPTIONS);
      expect(tree.exists('apps/my-api/src/kube/ingress.yaml')).toBe(true);
    });

    it('does not create ingress.yaml when withIngress is false', async () => {
      await generator(tree, { ...BASE_OPTIONS, withIngress: false });
      expect(tree.exists('apps/my-api/src/kube/ingress.yaml')).toBe(false);
    });
  });

  describe('deployment.yaml content', () => {
    it('sets the project name in metadata and selector', async () => {
      await generator(tree, BASE_OPTIONS);
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('name: my-api');
      expect(content).toContain('app: my-api');
    });

    it('sets the correct namespace', async () => {
      await generator(tree, BASE_OPTIONS);
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('namespace: production');
    });

    it('uses the default replica count of 1', async () => {
      await generator(tree, BASE_OPTIONS);
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('replicas: 1');
    });

    it('uses a custom replica count', async () => {
      await generator(tree, { ...BASE_OPTIONS, replicas: 3 });
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('replicas: 3');
    });

    it('builds the image reference from registry and project name', async () => {
      await generator(tree, BASE_OPTIONS);
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('registry.example.com/my-api:latest');
    });

    it('uses a custom imageName when provided', async () => {
      await generator(tree, { ...BASE_OPTIONS, imageName: 'custom-image' });
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('registry.example.com/custom-image:latest');
    });

    it('exposes the correct container port (default 3000)', async () => {
      await generator(tree, BASE_OPTIONS);
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('containerPort: 3000');
    });

    it('exposes a custom container port', async () => {
      await generator(tree, { ...BASE_OPTIONS, port: 8080 });
      const content = tree.read('apps/my-api/src/kube/deployment.yaml', 'utf-8');
      expect(content).toContain('containerPort: 8080');
    });
  });

  describe('service.yaml content', () => {
    it('sets the correct project name and namespace', async () => {
      await generator(tree, BASE_OPTIONS);
      const content = tree.read('apps/my-api/src/kube/service.yaml', 'utf-8');
      expect(content).toContain('name: my-api');
      expect(content).toContain('namespace: production');
    });

    it('routes traffic to the correct targetPort', async () => {
      await generator(tree, { ...BASE_OPTIONS, port: 4000 });
      const content = tree.read('apps/my-api/src/kube/service.yaml', 'utf-8');
      expect(content).toContain('targetPort: 4000');
    });
  });

  describe('ingress.yaml content', () => {
    it('sets project name and namespace', async () => {
      await generator(tree, { ...BASE_OPTIONS, ingressHost: 'api.example.com' });
      const content = tree.read('apps/my-api/src/kube/ingress.yaml', 'utf-8');
      expect(content).toContain('name: my-api');
      expect(content).toContain('namespace: production');
    });

    it('uses the provided ingressHost', async () => {
      await generator(tree, { ...BASE_OPTIONS, ingressHost: 'api.example.com' });
      const content = tree.read('apps/my-api/src/kube/ingress.yaml', 'utf-8');
      expect(content).toContain('host: api.example.com');
    });

    it('defaults ingressHost to {project}.elden-core.fr', async () => {
      await generator(tree, BASE_OPTIONS);
      const content = tree.read('apps/my-api/src/kube/ingress.yaml', 'utf-8');
      expect(content).toContain('my-api.elden-core.fr');
    });

    it('adds cert-manager annotation when withTls is true', async () => {
      await generator(tree, { ...BASE_OPTIONS, withTls: true });
      const content = tree.read('apps/my-api/src/kube/ingress.yaml', 'utf-8');
      expect(content).toContain('cert-manager.io/cluster-issuer');
      expect(content).toContain('letsencrypt-prod');
    });

    it('adds TLS section when withTls is true', async () => {
      await generator(tree, { ...BASE_OPTIONS, withTls: true });
      const content = tree.read('apps/my-api/src/kube/ingress.yaml', 'utf-8');
      expect(content).toContain('tls:');
      expect(content).toContain('my-api-tls');
    });

    it('does not include TLS when withTls is false', async () => {
      await generator(tree, { ...BASE_OPTIONS, withTls: false });
      const content = tree.read('apps/my-api/src/kube/ingress.yaml', 'utf-8');
      expect(content).not.toContain('cert-manager.io/cluster-issuer');
      expect(content).not.toContain('tls:');
    });
  });
});
