import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/** Guard route links, browser Back/Forward, reload and tab closing. */
export function useUnsavedChanges(dirty: boolean, allowPath?: (path: string) => boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname && !allowPath?.(nextLocation.pathname)
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Há alterações não salvas. Sair sem salvar? Cancele para voltar e salvar.')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    const signOut = (event: Event) => {
      if (!window.confirm('Há alterações não salvas. Sair sem salvar? Cancele para voltar e salvar.'))
        event.preventDefault();
    };
    window.addEventListener('tedtronics:before-signout', signOut);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('tedtronics:before-signout', signOut);
    };
  }, [dirty]);
}
