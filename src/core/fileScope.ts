export function isExcludedPath(path: string, excludedFolders: string[]): boolean {
  return excludedFolders.some((folder) => path === folder || path.startsWith(folder + '/'));
}
