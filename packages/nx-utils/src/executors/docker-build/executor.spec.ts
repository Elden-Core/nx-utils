import { ExecutorContext } from '@nx/devkit';
import { ChildProcess } from 'child_process';

jest.mock('child_process');
jest.mock('@nx/devkit', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { spawn } from 'child_process';
import executor from './executor';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

function makeProcess(exitCode: number | null): Partial<ChildProcess> {
  return {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'close') handler(exitCode);
      return {} as ChildProcess;
    }) as ChildProcess['on'],
  };
}

function makeErrorProcess(error: Error): Partial<ChildProcess> {
  return {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'error') handler(error);
      return {} as ChildProcess;
    }) as ChildProcess['on'],
  };
}

function makeContext(projectName?: string): ExecutorContext {
  return {
    root: '/workspace',
    projectName,
    projectsConfigurations: {
      version: 2,
      projects: projectName
        ? { [projectName]: { root: `apps/${projectName}` } }
        : {},
    },
    nxJsonConfiguration: {},
    isVerbose: false,
    cwd: '/workspace',
    projectGraph: { nodes: {}, dependencies: {} },
  } as unknown as ExecutorContext;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('docker-build executor', () => {
  describe('missing project name', () => {
    it('returns failure when projectName is undefined', async () => {
      const result = await executor({}, makeContext(undefined));
      expect(result).toEqual({ success: false });
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('successful build', () => {
    beforeEach(() => {
      mockSpawn.mockReturnValue(makeProcess(0) as ChildProcess);
    });

    it('returns success on a clean build', async () => {
      const result = await executor({}, makeContext('my-api'));
      expect(result).toEqual({ success: true });
    });

    it('calls docker with --tag including project name when no registry', async () => {
      await executor({ tag: 'v1.0' }, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--tag');
      expect(args[args.indexOf('--tag') + 1]).toBe('my-api:v1.0');
    });

    it('prefixes registry when provided', async () => {
      await executor({ registry: 'registry.example.com' }, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      expect(args[args.indexOf('--tag') + 1]).toBe('registry.example.com/my-api:latest');
    });

    it('uses custom imageName', async () => {
      await executor({ imageName: 'custom-image', tag: 'prod' }, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      expect(args[args.indexOf('--tag') + 1]).toBe('custom-image:prod');
    });

    it('defaults dockerfile to projectRoot/src/docker/Dockerfile', async () => {
      await executor({}, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      const fileIdx = args.indexOf('--file');
      expect(args[fileIdx + 1]).toContain('apps/my-api/src/docker/Dockerfile');
    });

    it('uses custom dockerfile path', async () => {
      await executor({ dockerfile: 'custom/Dockerfile' }, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      const fileIdx = args.indexOf('--file');
      expect(args[fileIdx + 1]).toContain('custom/Dockerfile');
    });

    it('appends --platform when specified', async () => {
      await executor({ platform: 'linux/amd64' }, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--platform');
      expect(args[args.indexOf('--platform') + 1]).toBe('linux/amd64');
    });

    it('appends --build-arg for each entry', async () => {
      await executor({ buildArgs: { NODE_ENV: 'production', PORT: '3000' } }, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--build-arg');
      expect(args).toContain('NODE_ENV=production');
      expect(args).toContain('PORT=3000');
    });

    it('appends --label for each entry', async () => {
      await executor({ labels: { version: '1.0', team: 'backend' } }, makeContext('my-api'));
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--label');
      expect(args).toContain('version=1.0');
      expect(args).toContain('team=backend');
    });

    it('does not push when push option is absent', async () => {
      await executor({}, makeContext('my-api'));
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('build failure', () => {
    it('returns failure when docker build exits with non-zero code', async () => {
      mockSpawn.mockReturnValue(makeProcess(1) as ChildProcess);
      const result = await executor({}, makeContext('my-api'));
      expect(result).toEqual({ success: false });
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('returns failure when spawn emits an error event', async () => {
      mockSpawn.mockReturnValue(makeErrorProcess(new Error('ENOENT')) as ChildProcess);
      const result = await executor({}, makeContext('my-api'));
      expect(result).toEqual({ success: false });
    });
  });

  describe('push', () => {
    it('pushes after a successful build', async () => {
      mockSpawn.mockReturnValue(makeProcess(0) as ChildProcess);
      const result = await executor({ push: true }, makeContext('my-api'));
      expect(result).toEqual({ success: true });
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      const [, pushArgs] = mockSpawn.mock.calls[1];
      expect(pushArgs[0]).toBe('push');
    });

    it('returns failure when push exits with non-zero code', async () => {
      mockSpawn
        .mockReturnValueOnce(makeProcess(0) as ChildProcess)
        .mockReturnValueOnce(makeProcess(1) as ChildProcess);
      const result = await executor({ push: true }, makeContext('my-api'));
      expect(result).toEqual({ success: false });
    });
  });
});
