// Match the workflow's account allowlist for EVERY imported source, including
// issue bodies. author_association alone is not authorization to publish code.
export function authorizedSource(source) {
  return source?.user?.login === 'I-am-drunk' && source?.user?.type === 'User';
}
