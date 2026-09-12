export function errorAfterSuccessfulRefresh(previousError: string, alreadyHadSnapshot: boolean): string {
  return alreadyHadSnapshot ? previousError : '';
}
