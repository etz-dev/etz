import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { getConfig } from '../config/parser';
import {
  BuildOptions,
  BuildPreCheckResult,
  BuildPreCondition,
  BuildResult,
  BuildProgress,
  Platform,
} from '../types';

// Track active build processes
interface ActiveBuild {
  label: string;
  type: 'pod_install' | 'build_infra_ios' | 'build_ios' | 'build_android';
  process: ChildProcess;
  startTime: number;
  outputBuffer: string[]; // Store last 500 lines of output
}

const activeBuilds = new Map<string, ActiveBuild>();
const MAX_OUTPUT_BUFFER_SIZE = 500; // Keep last 500 lines

/**
 * Validate that a label doesn't contain path traversal attempts
 */
function validateLabel(label: string): void {
  // Check for path traversal patterns
  if (label.includes('..') || label.includes('/') || label.includes('\\')) {
    throw new Error('Invalid label: cannot contain path separators or traversal sequences');
  }

  // Check for absolute paths
  if (path.isAbsolute(label)) {
    throw new Error('Invalid label: cannot be an absolute path');
  }

  // Check for empty or whitespace-only
  if (!label || label.trim().length === 0) {
    throw new Error('Invalid label: cannot be empty');
  }
}

/**
 * Validate repo name
 */
function validateRepoName(repo: string): void {
  // Check for path traversal patterns
  if (repo.includes('..') || repo.includes('/') || repo.includes('\\')) {
    throw new Error('Invalid repo name: cannot contain path separators or traversal sequences');
  }

  // Check for absolute paths
  if (path.isAbsolute(repo)) {
    throw new Error('Invalid repo name: cannot be an absolute path');
  }

  // Check for empty or whitespace-only
  if (!repo || repo.trim().length === 0) {
    throw new Error('Invalid repo name: cannot be empty');
  }
}

/**
 * Get the key for tracking a build
 */
function getBuildKey(label: string, type: string): string {
  return `${label}:${type}`;
}

/**
 * Configuration for a build process
 */
interface BuildProcessConfig {
  label: string;
  type: ActiveBuild['type'];
  command: string;
  args: string[];
  cwd: string;
  stage: string;
  startMessage: string;
  completeMessage: string;
  estimateProgress?: (output: string) => number;
}

/**
 * Generic function to run a build process with progress tracking
 * Eliminates code duplication across build functions
 */
async function runBuildProcess(
  config: BuildProcessConfig,
  onProgress?: (progress: BuildProgress) => void
): Promise<{ success: boolean; output: string; error?: string }> {
  // Validate label
  try {
    validateLabel(config.label);
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Invalid label'
    };
  }

  const buildKey = getBuildKey(config.label, config.type);

  // Check if already running
  if (activeBuilds.has(buildKey)) {
    return {
      success: false,
      output: '',
      error: `${config.type} already in progress`
    };
  }

  return new Promise((resolve) => {
    let output = '';
    let errorOutput = '';

    // Send initial progress
    onProgress?.({
      label: config.label,
      stage: config.stage,
      progress: 0,
      message: config.startMessage,
      timestamp: Date.now(),
    });

    // Spawn the process
    const childProcess = spawn(config.command, config.args, {
      cwd: config.cwd,
      shell: true,
    });

    // Track the process
    activeBuilds.set(buildKey, {
      label: config.label,
      type: config.type,
      process: childProcess,
      startTime: Date.now(),
      outputBuffer: [],
    });

    // Handle stdout
    childProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Add to output buffer
      const build = activeBuilds.get(buildKey);
      if (build) {
        const lines = text.trim().split('\n').filter((line: string) => line.length > 0);
        build.outputBuffer.push(...lines);
        // Keep only last MAX_OUTPUT_BUFFER_SIZE lines
        if (build.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
          build.outputBuffer = build.outputBuffer.slice(-MAX_OUTPUT_BUFFER_SIZE);
        }
      }

      // Estimate progress
      const progress = config.estimateProgress ? config.estimateProgress(text) : 50;

      // Send progress for each line
      const lines = text.trim().split('\n').filter((line: string) => line.length > 0);
      lines.forEach((line: string) => {
        onProgress?.({
          label: config.label,
          stage: config.stage,
          progress,
          message: line,
          timestamp: Date.now(),
        });
      });
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;

      // Add stderr to output buffer as well
      const build = activeBuilds.get(buildKey);
      if (build) {
        const lines = text.trim().split('\n').filter((line: string) => line.length > 0);
        build.outputBuffer.push(...lines);
        if (build.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
          build.outputBuffer = build.outputBuffer.slice(-MAX_OUTPUT_BUFFER_SIZE);
        }
      }

      // Many build tools (like Gradle) output to stderr
      const lines = text.trim().split('\n').filter((line: string) => line.length > 0);
      lines.forEach((line: string) => {
        const progress = config.estimateProgress ? config.estimateProgress(text) : 50;
        onProgress?.({
          label: config.label,
          stage: config.stage,
          progress,
          message: line,
          timestamp: Date.now(),
        });
      });
    });

    // Handle process completion
    childProcess.on('close', (code) => {
      // Remove from active builds
      activeBuilds.delete(buildKey);

      if (code === 0) {
        onProgress?.({
          label: config.label,
          stage: config.stage,
          progress: 100,
          message: config.completeMessage,
          timestamp: Date.now(),
        });
        resolve({ success: true, output });
      } else {
        resolve({
          success: false,
          output,
          error: errorOutput || `${config.type} failed with code ${code}`,
        });
      }
    });
  });
}

/**
 * Check if a build is currently in progress
 */
export function isBuildInProgress(label: string, type?: string): boolean {
  try {
    validateLabel(label);
  } catch {
    return false; // Invalid label means no build can be in progress
  }

  if (type) {
    return activeBuilds.has(getBuildKey(label, type));
  }
  // Check if ANY build is in progress for this label
  for (const key of activeBuilds.keys()) {
    if (key.startsWith(`${label}:`)) {
      return true;
    }
  }
  return false;
}

/**
 * Get active build info
 */
export function getActiveBuildInfo(label: string): { type: string; duration: number } | null {
  try {
    validateLabel(label);
  } catch {
    return null; // Invalid label means no build info
  }

  for (const [key, build] of activeBuilds.entries()) {
    if (key.startsWith(`${label}:`)) {
      return {
        type: build.type,
        duration: Date.now() - build.startTime,
      };
    }
  }
  return null;
}

/**
 * Get buffered output for an active build
 */
export function getBuildOutput(label: string, type?: string): string[] {
  try {
    validateLabel(label);
  } catch {
    return []; // Invalid label means no output
  }

  if (type) {
    const key = getBuildKey(label, type);
    const build = activeBuilds.get(key);
    return build?.outputBuffer || [];
  }

  // If no type specified, get output from any active build for this label
  for (const [key, build] of activeBuilds.entries()) {
    if (key.startsWith(`${label}:`)) {
      return build.outputBuffer;
    }
  }

  return [];
}

/**
 * Kill an active build process
 */
export function killBuild(label: string, type: string): boolean {
  try {
    validateLabel(label);
  } catch {
    return false; // Invalid label means can't kill build
  }

  const key = getBuildKey(label, type);
  const build = activeBuilds.get(key);
  if (build) {
    build.process.kill();
    activeBuilds.delete(key);
    return true;
  }
  return false;
}

/**
 * Kill all active builds for a label
 * Returns number of builds killed
 */
export function killAllBuildsForLabel(label: string): number {
  try {
    validateLabel(label);
  } catch {
    return 0;
  }

  let count = 0;
  for (const [key, build] of activeBuilds.entries()) {
    if (build.label === label) {
      build.process.kill();
      activeBuilds.delete(key);
      count++;
    }
  }
  return count;
}


/**
 * Check iOS pre-conditions before building
 */
async function checkIOSPreConditions(
  label: string,
  iosRepoPath: string,
  infraRepoPath: string
): Promise<BuildPreCondition[]> {
  const conditions: BuildPreCondition[] = [];

  // 1. Check if Pods directory exists and pods are up-to-date
  const podsDir = path.join(iosRepoPath, 'Pods');
  const podfileLockPath = path.join(iosRepoPath, 'Podfile.lock');
  const manifestLockPath = path.join(podsDir, 'Manifest.lock');
  const podfileExists = fs.existsSync(path.join(iosRepoPath, 'Podfile'));

  // Check if pod install is currently running
  const podInstallRunning = isBuildInProgress(label, 'pod_install');

  if (podfileExists) {
    if (podInstallRunning) {
      // Pod install is currently running
      conditions.push({
        id: 'ios_pods_installed',
        name: 'CocoaPods Dependencies',
        status: 'warning',
        message: 'Pod install is currently running...',
        canAutoFix: false,
      });
    } else if (fs.existsSync(podsDir) && fs.existsSync(podfileLockPath) && fs.existsSync(manifestLockPath)) {
      // Check if Podfile.lock matches Pods/Manifest.lock
      const podfileLock = fs.readFileSync(podfileLockPath, 'utf-8');
      const manifestLock = fs.readFileSync(manifestLockPath, 'utf-8');

      if (podfileLock === manifestLock) {
        conditions.push({
          id: 'ios_pods_installed',
          name: 'CocoaPods Dependencies',
          status: 'pass',
          message: 'Pods installed and up-to-date',
          canAutoFix: false,
        });
      } else {
        conditions.push({
          id: 'ios_pods_installed',
          name: 'CocoaPods Dependencies',
          status: 'warning',
          message: 'Podfile.lock and Manifest.lock mismatch. Run pod install.',
          canAutoFix: true,
          fixAction: 'pod_install',
        });
      }
    } else {
      conditions.push({
        id: 'ios_pods_installed',
        name: 'CocoaPods Dependencies',
        status: 'fail',
        message: 'Pods not installed. Run pod install first.',
        canAutoFix: true,
        fixAction: 'pod_install',
      });
    }
  }

  // 2. Check if Package.swift points to local infra
  const packageSwiftPath = path.join(iosRepoPath, 'Package.swift');
  if (fs.existsSync(packageSwiftPath)) {
    const packageContent = fs.readFileSync(packageSwiftPath, 'utf-8');
    const hasLocalInfraRef = packageContent.includes('../../project.mobile.infra');

    if (hasLocalInfraRef) {
      conditions.push({
        id: 'ios_local_infra_ref',
        name: 'Package.swift Local Reference',
        status: 'pass',
        message: 'Package.swift points to local infra (../../project.mobile.infra)',
        canAutoFix: false,
      });
    } else {
      conditions.push({
        id: 'ios_local_infra_ref',
        name: 'Package.swift Local Reference',
        status: 'warning',
        message: 'Package.swift may be pointing to remote infra instead of local',
        canAutoFix: false,
      });
    }
  }

  // 3. Check if project.mobile.infra worktree exists
  if (fs.existsSync(infraRepoPath)) {
    conditions.push({
      id: 'infra_worktree_exists',
      name: 'Infra Worktree',
      status: 'pass',
      message: 'project.mobile.infra worktree exists',
      canAutoFix: false,
    });

    // 4. Check if infra XCFrameworks are built by parsing Package.swift
    const packageSwiftPath = path.join(infraRepoPath, 'Package.swift');
    if (fs.existsSync(packageSwiftPath)) {
      const packageContent = fs.readFileSync(packageSwiftPath, 'utf-8');

      // Extract package names and their local URLs
      const packageNameRegex = /let\s+(\w+)_packageName\s+=\s+"([^"]+)"/g;
      const packageNames: { [key: string]: string } = {};

      let nameMatch;
      while ((nameMatch = packageNameRegex.exec(packageContent)) !== null) {
        packageNames[nameMatch[1]] = nameMatch[2];
      }

      const localUrlRegex = /let\s+(\w+)_localKotlinUrl\s+=\s+"([^"]+)"/g;
      const missingFrameworks: string[] = [];
      const foundFrameworks: string[] = [];

      let match;
      while ((match = localUrlRegex.exec(packageContent)) !== null) {
        const varPrefix = match[1]; // e.g., "ProjectShared" from "ProjectShared_localKotlinUrl"
        const pathTemplate = match[2]; // e.g., "./shared/mobile/build/XCFrameworks/debug/\(ProjectShared_packageName).xcframework"

        // Resolve the path by replacing \(packageName) with actual package name
        const packageName = packageNames[varPrefix] || varPrefix;
        const resolvedPath = pathTemplate.replace(/\\?\((\w+)_packageName\)/g, packageName);

        const xcframeworkPath = path.join(infraRepoPath, resolvedPath);

        if (fs.existsSync(xcframeworkPath)) {
          foundFrameworks.push(packageName);
        } else {
          missingFrameworks.push(packageName);
        }
      }

      if (missingFrameworks.length === 0 && foundFrameworks.length > 0) {
        conditions.push({
          id: 'ios_infra_built',
          name: 'Infra XCFramework',
          status: 'pass',
          message: `All XCFrameworks built: ${foundFrameworks.join(', ')}`,
          canAutoFix: false,
        });
      } else if (missingFrameworks.length > 0) {
        conditions.push({
          id: 'ios_infra_built',
          name: 'Infra XCFramework',
          status: 'fail',
          message: `Missing XCFrameworks: ${missingFrameworks.join(', ')}. Build infra first.`,
          canAutoFix: true,
          fixAction: 'build_infra_ios',
        });
      } else {
        // No local frameworks found in Package.swift
        conditions.push({
          id: 'ios_infra_built',
          name: 'Infra XCFramework',
          status: 'warning',
          message: 'No local XCFramework paths found in Package.swift. You can build infra to create them.',
          canAutoFix: true,
          fixAction: 'build_infra_ios',
        });
      }
    } else {
      conditions.push({
        id: 'ios_infra_built',
        name: 'Infra XCFramework',
        status: 'fail',
        message: 'Package.swift not found in infra worktree. Build infra first.',
        canAutoFix: true,
        fixAction: 'build_infra_ios',
      });
    }
  } else {
    conditions.push({
      id: 'infra_worktree_exists',
      name: 'Infra Worktree',
      status: 'fail',
      message: 'project.mobile.infra worktree not found',
      canAutoFix: false,
    });
  }

  return conditions;
}

/**
 * Check Android pre-conditions before building
 */
async function checkAndroidPreConditions(
  label: string,
  androidRepoPath: string,
  infraRepoPath: string
): Promise<BuildPreCondition[]> {
  const conditions: BuildPreCondition[] = [];

  // 1. Check if project.mobile.infra worktree exists
  if (fs.existsSync(infraRepoPath)) {
    conditions.push({
      id: 'infra_worktree_exists',
      name: 'Infra Worktree',
      status: 'pass',
      message: 'project.mobile.infra worktree exists',
      canAutoFix: false,
    });

    // 2. Check if Android infra is built
    // Adjust this path based on your actual Android build output
    const androidInfraBuilt = fs.existsSync(
      path.join(infraRepoPath, 'build', 'outputs')
    );

    if (androidInfraBuilt) {
      conditions.push({
        id: 'android_infra_built',
        name: 'Infra Android Build',
        status: 'pass',
        message: 'Android infra is built',
        canAutoFix: false,
      });
    } else {
      conditions.push({
        id: 'android_infra_built',
        name: 'Infra Android Build',
        status: 'fail',
        message: 'Android infra not built',
        canAutoFix: true,
        fixAction: 'build_infra_android',
      });
    }
  } else {
    conditions.push({
      id: 'infra_worktree_exists',
      name: 'Infra Worktree',
      status: 'fail',
      message: 'project.mobile.infra worktree not found',
      canAutoFix: false,
    });
  }

  // 3. Check Gradle wrapper
  const gradlewPath = path.join(androidRepoPath, 'gradlew');
  if (fs.existsSync(gradlewPath)) {
    conditions.push({
      id: 'android_gradle_exists',
      name: 'Gradle Wrapper',
      status: 'pass',
      message: 'Gradle wrapper found',
      canAutoFix: false,
    });
  } else {
    conditions.push({
      id: 'android_gradle_exists',
      name: 'Gradle Wrapper',
      status: 'fail',
      message: 'Gradle wrapper not found',
      canAutoFix: false,
    });
  }

  return conditions;
}

/**
 * Check build pre-conditions for a platform
 */
export async function checkBuildPreConditions(
  options: BuildOptions
): Promise<BuildPreCheckResult> {
  // Validate inputs
  try {
    validateLabel(options.label);
    validateRepoName(options.repo);
  } catch (error) {
    return {
      platform: options.platform,
      repo: options.repo,
      ready: false,
      conditions: [{
        id: 'validation_error',
        name: 'Input Validation',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Invalid input',
        canAutoFix: false,
      }],
    };
  }

  const config = getConfig();
  const worktreeDir = path.join(config.worktrees_dir, options.label);
  const repoPath = path.join(worktreeDir, options.repo);
  const infraPath = path.join(worktreeDir, 'project.mobile.infra');

  let conditions: BuildPreCondition[] = [];

  // Check if repo worktree exists
  if (!fs.existsSync(repoPath)) {
    conditions.push({
      id: 'repo_exists',
      name: 'Repository Worktree',
      status: 'fail',
      message: `${options.repo} worktree not found at ${repoPath}`,
      canAutoFix: false,
    });

    return {
      platform: options.platform,
      repo: options.repo,
      ready: false,
      conditions,
    };
  }

  conditions.push({
    id: 'repo_exists',
    name: 'Repository Worktree',
    status: 'pass',
    message: `${options.repo} worktree exists`,
    canAutoFix: false,
  });

  // Platform-specific checks
  if (options.platform === 'ios') {
    const iosConditions = await checkIOSPreConditions(
      options.label,
      repoPath,
      infraPath
    );
    conditions = conditions.concat(iosConditions);
  } else if (options.platform === 'android') {
    const androidConditions = await checkAndroidPreConditions(
      options.label,
      repoPath,
      infraPath
    );
    conditions = conditions.concat(androidConditions);
  }

  // Determine if ready to build
  const hasFailures = conditions.some((c) => c.status === 'fail');

  return {
    platform: options.platform,
    repo: options.repo,
    ready: !hasFailures,
    conditions,
  };
}

/**
 * Run pod install for iOS
 */
export async function runPodInstall(
  label: string,
  onProgress?: (progress: BuildProgress) => void
): Promise<{ success: boolean; output: string; error?: string }> {
  const config = getConfig();
  const worktreeDir = path.join(config.worktrees_dir, label);
  const iosRepoPath = path.join(worktreeDir, 'project.ios');

  return runBuildProcess(
    {
      label,
      type: 'pod_install',
      command: 'pod',
      args: ['install'],
      cwd: iosRepoPath,
      stage: 'pod_install',
      startMessage: 'Starting pod install...',
      completeMessage: 'Pod install completed',
      estimateProgress: (output: string) => {
        let progress = 10;
        if (output.includes('Analyzing dependencies')) progress = 20;
        if (output.includes('Downloading dependencies')) progress = 40;
        if (output.includes('Installing')) progress = 60;
        if (output.includes('Generating Pods project')) progress = 80;
        return progress;
      },
    },
    onProgress
  );
}

/**
 * Build iOS infra XCFramework
 */
export async function buildInfraIOS(
  label: string,
  onProgress?: (progress: BuildProgress) => void
): Promise<{ success: boolean; output: string; error?: string }> {
  const config = getConfig();
  const worktreeDir = path.join(config.worktrees_dir, label);
  const infraPath = path.join(worktreeDir, 'project.mobile.infra');

  return runBuildProcess(
    {
      label,
      type: 'build_infra_ios',
      command: './gradlew',
      args: ['spmDevBuild', '-PspmBuildTargets=ios_arm64', '--console=plain', '--info'],
      cwd: infraPath,
      stage: 'build_infra',
      startMessage: 'Building iOS infra XCFramework...',
      completeMessage: 'Infra build completed',
      estimateProgress: (output: string) => {
        let progress = 5;

        // Initialization phase
        if (output.includes('BUILD SUCCESSFUL')) return 100;
        if (output.includes('Scanning for')) return 5;
        if (output.includes('Parsing build file') || output.includes('Applying script')) return 8;

        // Configuration phase (10-25%)
        if (output.includes('Configuring project') || output.includes(':prepareKotlin')) return 12;
        if (output.includes('Resolving dependencies') || output.includes('Download')) return 18;
        if (output.includes('configuration complete')) return 25;

        // Kotlin compilation phase (25-60%)
        if (output.includes('compileKotlin') && output.includes('UP-TO-DATE')) return 30;
        if (output.includes('compileKotlinIos')) return 35;
        if (output.includes(':shared:') && output.includes('compileKotlin')) return 45;
        if (output.includes('Compiling') || output.includes('compiling')) return 50;

        // Linking phase (60-90%)
        if (output.includes('linkDebug') || output.includes(':link')) return 65;
        if (output.includes('Linking')) return 70;
        if (output.includes('linkReleaseStatic')) return 75;

        // SPM/XCFramework phase (80-95%)
        if (output.includes('assembleXCFramework') || output.includes('xcframework')) return 82;
        if (output.includes('copyFramework') || output.includes('Copying')) return 88;
        if (output.includes('spmDevBuild')) return 92;

        return progress;
      },
    },
    onProgress
  );
}

/**
 * Build iOS app (placeholder - needs actual xcodebuild command)
 */
export async function buildIOS(
  label: string,
  onProgress?: (progress: BuildProgress) => void
): Promise<BuildResult> {
  // Validate label
  try {
    validateLabel(label);
  } catch (error) {
    return {
      success: false,
      platform: 'ios',
      repo: 'project.ios',
      error: error instanceof Error ? error.message : 'Invalid label',
    };
  }

  const startTime = Date.now();
  const config = getConfig();
  const worktreeDir = path.join(config.worktrees_dir, label);
  const iosRepoPath = path.join(worktreeDir, 'project.ios');
  const buildKey = getBuildKey(label, 'build_ios');

  // Check if already building
  if (activeBuilds.has(buildKey)) {
    return {
      success: false,
      platform: 'ios',
      repo: 'project.ios',
      error: 'iOS build already in progress',
    };
  }

  return new Promise((resolve) => {
    let output = '';
    let errorOutput = '';

    onProgress?.({
      label,
      stage: 'build_ios',
      progress: 0,
      message: 'Starting iOS archive for Project-Staging...',
      timestamp: Date.now(),
    });

    // Archive the app for Project-Staging scheme
    // Output: Debug .ipa file in the root of the iOS repo
    const archivePath = path.join(iosRepoPath, 'build', 'Project.xcarchive');
    const exportPath = path.join(iosRepoPath, 'build', 'export');

    // xcodebuild archive command
    const process = spawn(
      'xcodebuild',
      [
        '-workspace', 'Project.xcworkspace',
        '-scheme', 'Project-Staging',
        '-configuration', 'Debug',
        '-archivePath', archivePath,
        'archive',
        '-allowProvisioningUpdates'
      ],
      {
        cwd: iosRepoPath,
        shell: false,
      }
    );

    // Track the process
    activeBuilds.set(buildKey, {
      label,
      type: 'build_ios',
      process,
      startTime: Date.now(),
      outputBuffer: [],
    });

    process.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Add to output buffer
      const build = activeBuilds.get(buildKey);
      if (build) {
        const lines = text.trim().split('\n').filter((line: string) => line.length > 0);
        build.outputBuffer.push(...lines);
        if (build.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
          build.outputBuffer = build.outputBuffer.slice(-MAX_OUTPUT_BUFFER_SIZE);
        }
      }

      // Better progress estimation based on xcodebuild output
      let progress = 10;
      if (text.includes('Building workspace')) progress = 20;
      if (text.includes('Compiling') || text.includes('Compile')) progress = 40;
      if (text.includes('Linking')) progress = 60;
      if (text.includes('Touching')) progress = 70;
      if (text.includes('ARCHIVE SUCCEEDED')) progress = 80;

      onProgress?.({
        label,
        stage: 'build_ios',
        progress,
        message: text.trim(),
        timestamp: Date.now(),
      });
    });

    process.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;

      // Add stderr to output buffer
      const build = activeBuilds.get(buildKey);
      if (build) {
        const lines = text.trim().split('\n').filter((line: string) => line.length > 0);
        build.outputBuffer.push(...lines);
        if (build.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
          build.outputBuffer = build.outputBuffer.slice(-MAX_OUTPUT_BUFFER_SIZE);
        }
      }
    });

    process.on('close', async (code) => {
      if (code === 0) {
        // Archive succeeded, now export to IPA
        onProgress?.({
          label,
          stage: 'build_ios',
          progress: 85,
          message: 'Exporting archive to IPA...',
          timestamp: Date.now(),
        });

        try {
          // Create export options plist for debug build
          const exportOptionsPlist = path.join(iosRepoPath, 'build', 'exportOptions.plist');
          const fs = require('fs');
          const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>`;
          fs.writeFileSync(exportOptionsPlist, exportOptions);

          // Export the archive using spawn to avoid command injection
          const { spawnSync } = require('child_process');
          const exportResult = spawnSync(
            'xcodebuild',
            [
              '-exportArchive',
              '-archivePath', archivePath,
              '-exportPath', exportPath,
              '-exportOptionsPlist', exportOptionsPlist
            ],
            {
              cwd: iosRepoPath,
              encoding: 'utf-8'
            }
          );

          if (exportResult.status !== 0) {
            throw new Error(`Export failed: ${exportResult.stderr || exportResult.error}`);
          }

          // Find the IPA file and move it to root
          const ipaFiles = fs.readdirSync(exportPath).filter((f: string) => f.endsWith('.ipa'));
          if (ipaFiles.length > 0) {
            const ipaPath = path.join(exportPath, ipaFiles[0]);
            const targetIpaPath = path.join(iosRepoPath, 'Project-Staging-Debug.ipa');
            fs.copyFileSync(ipaPath, targetIpaPath);

            // Remove from active builds
            activeBuilds.delete(buildKey);

            onProgress?.({
              label,
              stage: 'build_ios',
              progress: 100,
              message: `✅ IPA saved to: ${targetIpaPath}`,
              timestamp: Date.now(),
            });

            resolve({
              success: true,
              platform: 'ios',
              repo: 'project.ios',
              duration: (Date.now() - startTime) / 1000,
              output: output + `\n\n✅ IPA saved to: ${targetIpaPath}`,
            });
          } else {
            throw new Error('No IPA file found in export directory');
          }
        } catch (exportError: any) {
          // Remove from active builds
          activeBuilds.delete(buildKey);

          onProgress?.({
            label,
            stage: 'build_ios',
            progress: 100,
            message: `Export failed: ${exportError.message}`,
            timestamp: Date.now(),
          });

          resolve({
            success: false,
            platform: 'ios',
            repo: 'project.ios',
            duration: (Date.now() - startTime) / 1000,
            output,
            error: `Export failed: ${exportError.message}`,
          });
        }
      } else {
        // Remove from active builds
        activeBuilds.delete(buildKey);

        onProgress?.({
          label,
          stage: 'build_ios',
          progress: 100,
          message: 'iOS archive failed',
          timestamp: Date.now(),
        });

        resolve({
          success: false,
          platform: 'ios',
          repo: 'project.ios',
          duration: (Date.now() - startTime) / 1000,
          output,
          error: errorOutput || `iOS archive failed with code ${code}`,
        });
      }
    });
  });
}

/**
 * Build Android app
 */
export async function buildAndroid(
  label: string,
  onProgress?: (progress: BuildProgress) => void
): Promise<BuildResult> {
  const startTime = Date.now();
  const config = getConfig();
  const worktreeDir = path.join(config.worktrees_dir, label);
  const androidRepoPath = path.join(worktreeDir, 'project.android');

  const result = await runBuildProcess(
    {
      label,
      type: 'build_android',
      command: './gradlew',
      args: ['assembleDebug'],
      cwd: androidRepoPath,
      stage: 'build_android',
      startMessage: 'Starting Android build...',
      completeMessage: 'Android build completed',
      estimateProgress: (output: string) => {
        if (output.includes('BUILD SUCCESSFUL')) return 100;
        if (output.includes('Configuring')) return 20;
        if (output.includes('Compiling')) return 50;
        return 10;
      },
    },
    onProgress
  );

  const duration = (Date.now() - startTime) / 1000;

  // Transform result to BuildResult format
  return {
    success: result.success,
    platform: 'android',
    repo: 'project.android',
    duration,
    output: result.output,
    error: result.error,
  };
}
