import * as fs from 'fs/promises'
import * as path from 'path'

export type RepoType = 'ios' | 'android' | 'infra' | 'unknown'

/**
 * Detects the type of a repository by scanning its structure
 * @param repoPath Absolute path to the repository
 * @returns The detected repo type
 */
export async function detectRepoType(repoPath: string): Promise<RepoType> {
  try {
    // Check if path exists
    const stats = await fs.stat(repoPath)
    if (!stats.isDirectory()) {
      return 'unknown'
    }

    // Read directory contents
    const files = await fs.readdir(repoPath)
    const fileSet = new Set(files)

    // iOS Detection
    const hasXcodeProject = files.some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'))
    const hasIOSIndicators = fileSet.has('Podfile') ||
                             fileSet.has('Package.swift') ||
                             fileSet.has('Podfile.lock') ||
                             fileSet.has('ios')

    if (hasXcodeProject || hasIOSIndicators) {
      return 'ios'
    }

    // Android Detection
    const hasGradleBuild = fileSet.has('build.gradle') ||
                           fileSet.has('build.gradle.kts') ||
                           fileSet.has('settings.gradle') ||
                           fileSet.has('settings.gradle.kts')

    const hasAndroidManifest = fileSet.has('AndroidManifest.xml')
    const hasAndroidDir = fileSet.has('android')
    const hasGradleWrapper = fileSet.has('gradlew')

    if (hasGradleBuild || hasAndroidManifest || (hasAndroidDir && hasGradleWrapper)) {
      return 'android'
    }

    // Check subdirectories for Android/iOS projects (monorepo structure)
    for (const file of files) {
      const filePath = path.join(repoPath, file)
      try {
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
          // Check for ios/android subdirectories
          if (file === 'ios') {
            const iosFiles = await fs.readdir(filePath)
            if (iosFiles.some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'))) {
              return 'ios'
            }
          } else if (file === 'android') {
            const androidFiles = await fs.readdir(filePath)
            if (androidFiles.some(f => f === 'build.gradle' || f === 'build.gradle.kts')) {
              return 'android'
            }
          }
        }
      } catch {
        // Ignore errors reading subdirectories
        continue
      }
    }

    // Infra/shared detection (common patterns)
    const hasInfraIndicators = files.some(f =>
      f.includes('infra') ||
      f.includes('shared') ||
      f.includes('common') ||
      f === 'Package.swift' // Swift packages often used for shared code
    )

    if (hasInfraIndicators) {
      return 'infra'
    }

    return 'unknown'
  } catch (error) {
    console.error(`Error detecting repo type for ${repoPath}:`, error)
    return 'unknown'
  }
}

/**
 * Fallback detection based on repository name patterns
 * @param repoName Repository name
 * @returns The detected repo type based on name
 */
export function detectRepoTypeByName(repoName: string): RepoType {
  const lowerName = repoName.toLowerCase()

  if (lowerName.endsWith('.ios') || lowerName.includes('-ios') || lowerName.includes('_ios')) {
    return 'ios'
  }

  if (lowerName.endsWith('.android') || lowerName.includes('-android') || lowerName.includes('_android')) {
    return 'android'
  }

  if (lowerName.includes('infra') || lowerName.includes('shared') || lowerName.includes('common')) {
    return 'infra'
  }

  return 'unknown'
}

/**
 * Detects repo type with fallback to name-based detection
 * @param repoPath Absolute path to the repository
 * @param repoName Repository name (used as fallback)
 * @returns The detected repo type
 */
export async function detectRepoTypeWithFallback(repoPath: string, repoName: string): Promise<RepoType> {
  // First try structure-based detection
  const structureType = await detectRepoType(repoPath)

  if (structureType !== 'unknown') {
    return structureType
  }

  // Fallback to name-based detection
  return detectRepoTypeByName(repoName)
}
